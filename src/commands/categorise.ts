import { Args, Command, Flags } from '@oclif/core';
import { EnrichedTransaction } from 'akahu';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { apiService } from '../services/api.service.js';
import { merchantMappingService, normaliseMerchantName } from '../services/merchant-mapping.service.js';
import { parseDate, validateDateRange, formatDateISO, daysAgo } from '../utils/date.js';
import { getErrorMessage } from '../utils/error.js';
import { warnIfConfigCorrupted } from '../utils/flags.js';
import { formatCurrency } from '../utils/output.js';
import { DEFAULT_CATEGORIZATION_DAYS_BACK } from '../constants/index.js';
import { NZFCCCategory, MerchantMap } from '../types/index.js';

// Load NZFCC categories data once, resolving path relative to project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const nzfccPath = path.join(projectRoot, 'nzfcc_categories.json');
let nzfcc: NZFCCCategory[] = [];
if (fs.existsSync(nzfccPath)) {
  try {
    nzfcc = JSON.parse(fs.readFileSync(nzfccPath, 'utf8')) as NZFCCCategory[];
  } catch {
    // Invalid JSON in categories file - continue without suggestions
  }
}

// Using centralized normalization from merchant-mapping.service for consistency

export default class Categorise extends Command {
  static description = 'Interactively assign categories to uncategorised transactions and store a merchant map';

  static examples = [
    '$ bank categorise --since 2024-01-01',
    '$ bank categorise --limit 20',
  ];

  static flags = {
    since: Flags.string({
      char: 's',
      description: 'Start date (YYYY-MM-DD) to scan for uncategorised transactions',
    }),
    until: Flags.string({
      char: 'u',
      description: 'End date (YYYY-MM-DD); defaults to today',
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Maximum number of transactions to process',
    }),
  };

  static args = {
    merchant: Args.string({ required: false, description: 'Force categorise only transactions whose merchant includes this string' }),
  } as const;

  private parseDateFlag(dateStr: string, flagName: string): Date {
    const result = parseDate(dateStr, flagName);
    if (!result.success) {
      this.error(result.error);
    }
    return result.date;
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Categorise);

    warnIfConfigCorrupted(this);

    // Validate and parse dates
    const sinceParsed = flags.since ? this.parseDateFlag(flags.since, 'since') : daysAgo(DEFAULT_CATEGORIZATION_DAYS_BACK);
    const untilParsed = flags.until ? this.parseDateFlag(flags.until, 'until') : new Date();

    // Validate date range ordering
    const rangeResult = validateDateRange(sinceParsed, untilParsed);
    if (!rangeResult.success) {
      this.error(rangeResult.error);
    }

    const since = formatDateISO(sinceParsed);
    const until = formatDateISO(untilParsed);

    this.log(`Scanning transactions ${since} → ${until} …`);

    let txs: EnrichedTransaction[];
    try {
      txs = await apiService.listAllTransactions(since, until);
    } catch (error) {
      this.error(`Error fetching transactions: ${getErrorMessage(error)}`);
    }

    const map = merchantMappingService.loadMerchantMap();

    // Filter to uncategorised & non-transfer
    let uncategorised = txs.filter((t: EnrichedTransaction) => t.type !== 'TRANSFER' && (!t.category?.name || !t.category?.groups?.['personal_finance']?.name));

    if (args.merchant) {
      const key = args.merchant.toLowerCase();
      uncategorised = uncategorised.filter((t: EnrichedTransaction) => (t.merchant?.name ?? '').toLowerCase().includes(key));
    }

    if (!uncategorised.length) {
      this.log('No uncategorised transactions found.');
      return;
    }

    const limit = flags.limit ?? uncategorised.length;
    uncategorised = uncategorised.slice(0, limit);

    for (const tx of uncategorised) {
      await this.processTx(tx, map);
    }

    this.log('All done. Future runs will auto-categorise these merchants.');
  }

  private async processTx(tx: EnrichedTransaction, map: MerchantMap): Promise<void> {
    const merchantKey = normaliseMerchantName(tx.merchant?.name ?? tx.description);
    if (map[merchantKey]) {
      // Already mapped; nothing to do.
      return;
    }

    this.log('\n');
    this.log(`${tx.date.split('T')[0]}  ${formatCurrency(tx.amount)}  ${tx.merchant?.name ?? ''}`);
    this.log(tx.description);

    // Build suggestions
    const suggestions = this.buildSuggestions(merchantKey);

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'Select a category for this transaction',
        choices: [
          ...suggestions.map(s => ({ name: `${s.parent} › ${s.category}`, value: s })),
          new inquirer.Separator(),
          { name: 'Skip', value: null },
          { name: 'Enter manually', value: 'manual' },
        ],
      },
      {
        type: 'input',
        name: 'manualCategory',
        message: 'Enter parent>category (e.g., food>groceries)',
        when: (ans) => ans.choice === 'manual',
        validate: (input: string) => /.+>.+/.test(input) ? true : 'Format must be parent>category',
      },
    ]);

    let selected;
    if (answers.choice && answers.choice !== 'manual') {
      selected = answers.choice as { parent: string; category: string };
    } else if (answers.manualCategory) {
      const [parent, category] = answers.manualCategory.split('>').map((x: string) => x.trim());
      selected = { parent, category };
    }

    if (selected) {
      const saved = merchantMappingService.upsertMerchantCategory(merchantKey, selected);
      if (saved) {
        this.log(`Mapped '${tx.merchant?.name ?? merchantKey}' → ${selected.parent}/${selected.category}`);
      } else {
        this.warn(`Failed to save mapping for '${tx.merchant?.name ?? merchantKey}'. Check file permissions for ~/.bankcli/`);
      }
    } else {
      this.log('Skipped.');
    }
  }

  private buildSuggestions(merchantKey: string): { parent: string; category: string }[] {
    if (!nzfcc.length) return [];

    const suggestions: { parent: string; category: string; score: number }[] = [];

    const words = merchantKey.split(' ').filter(Boolean);
    for (const cat of nzfcc) {
      const name = cat.name.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (name.includes(w)) score += 1;
      }
      if (score) {
        suggestions.push({
          parent: cat.groups.personal_finance.name.toLowerCase(),
          category: cat.name.toLowerCase(),
          score,
        });
      }
    }

    // sort by score desc, take top 5
    suggestions.sort((a, b) => b.score - a.score);
    return suggestions.slice(0, 5);
  }
}
