/* eslint-disable @typescript-eslint/no-explicit-any */
import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

import { listAllTransactions } from '../utils/api.js';
import { upsertMerchantCategory, loadMerchantMap } from '../utils/merchant_map.js';

// Load NZFCC categories data once
const nzfccPath = path.resolve('nzfcc_categories.json');
let nzfcc: any[] = [];
if (fs.existsSync(nzfccPath)) {
  nzfcc = JSON.parse(fs.readFileSync(nzfccPath, 'utf8'));
}

function normalise(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

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

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Categorise);

    const since = flags.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = flags.until ?? new Date().toISOString().split('T')[0];

    this.log(`Scanning transactions ${since} → ${until} …`);

    let txs;
    try {
      txs = await listAllTransactions(since, until);
    } catch (error: any) {
      this.error(`Error fetching transactions: ${error.message}`);
      return;
    }

    const map = loadMerchantMap();

    // Filter to uncategorised & non-transfer
    let uncategorised = txs.filter(t => t.type !== 'TRANSFER' && (!t.category?.name || !t.category?.groups?.['personal_finance']?.name));

    if (args.merchant) {
      const key = args.merchant.toLowerCase();
      uncategorised = uncategorised.filter(t => (t.merchant?.name ?? '').toLowerCase().includes(key));
    }

    if (!uncategorised.length) {
      this.log('No uncategorised transactions found! 🎉');
      return;
    }

    const limit = flags.limit ?? uncategorised.length;
    uncategorised = uncategorised.slice(0, limit);

    for (const tx of uncategorised) {
      await this.processTx(tx, map);
    }

    this.log('All done. Future runs will auto-categorise these merchants.');
  }

  private async processTx(tx: any, map: Record<string, any>) {
    const merchantKey = normalise(tx.merchant?.name ?? tx.description);
    if (map[merchantKey]) {
      // Already mapped; nothing to do.
      return;
    }

    this.log('\n');
    this.log(`${tx.date.split('T')[0]}  $${tx.amount.toFixed(2)}  ${tx.merchant?.name ?? ''}`);
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
      upsertMerchantCategory(merchantKey, selected);
      this.log(`Mapped '${tx.merchant?.name ?? merchantKey}' → ${selected.parent}/${selected.category}`);
    } else {
      this.log('Skipped.');
    }
  }

  private buildSuggestions(merchantKey: string): { parent: string; category: string }[] {
    if (!nzfcc.length) return [];

    const suggestions: { parent: string; category: string; score: number }[] = [];

    const words = merchantKey.split(' ').filter(Boolean);
    for (const cat of nzfcc) {
      const name = (cat.name as string).toLowerCase();
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
