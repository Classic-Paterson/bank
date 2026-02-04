import { Command, Flags } from '@oclif/core';
import { Account, EnrichedTransaction } from 'akahu';

import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { formatOutput, formatCacheAge } from '../utils/output.js';
import { getErrorMessage } from '../utils/error.js';
import { parseDateRange } from '../utils/date.js';
import { refreshFlag, quietFlag, formatFlag, dateFilterFlags, warnIfConfigCorrupted, warnIfCacheCorrupted, resolveFormat, isCacheEnabled } from '../utils/flags.js';
import { DEFAULT_CATEGORY_DAYS_BACK, NZD_DECIMAL_PLACES, UNCATEGORIZED, isExcludedTransactionType } from '../constants/index.js';

export default class Categories extends Command {
  static description = 'Show spending by parent & detailed category over a time period';

  static examples = [
    '$ bank categories',
    '$ bank categories --days 90',
    '$ bank categories --since thisquarter            # This quarter spending',
    '$ bank categories --since lastquarter --until endoflastmonth  # Last quarter',
    '$ bank categories --since thisyear              # Year to date by category',
    '$ bank categories --since 2024-01-01 --until 2024-03-31',
    '$ bank categories --days 180 -f csv',
    '$ bank categories --account acc_12345           # Spending for a specific account',
  ];

  static flags = {
    ...dateFilterFlags(DEFAULT_CATEGORY_DAYS_BACK),
    account: Flags.string({
      char: 'a',
      description: 'Filter to a specific account (by ID or name)',
    }),
    format: formatFlag,
    refresh: refreshFlag,
    quiet: quietFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Categories);

    warnIfConfigCorrupted(this, flags.quiet);

    // Resolve and validate format early (normalized to lowercase)
    // Uses user's configured default format, not hardcoded 'table'
    const format = resolveFormat(flags.format);

    // Parse and validate date range using the standard utility
    const dateResult = parseDateRange({
      since: flags.since,
      until: flags.until,
      days: flags.days,
      defaultDaysBack: DEFAULT_CATEGORY_DAYS_BACK,
      extendSameDayRange: true,
      onWarning: flags.quiet ? undefined : (msg) => this.warn(msg),
    });
    if (!dateResult.success) {
      this.error(dateResult.error);
    }
    const { startDate: since, endDate: until, startParsed, endParsed } = dateResult;

    // Fetch all transactions in that window (with caching support)
    let transactions: EnrichedTransaction[];
    let accounts: Account[] = [];
    let fromCache = false;
    try {
      const cacheEnabled = isCacheEnabled();

      // Fetch accounts if filtering by account (needed for name resolution)
      if (flags.account) {
        const accResult = await cacheService.getAccountsWithCache(
          flags.refresh,
          cacheEnabled,
          () => apiService.listAccounts()
        );
        accounts = accResult.accounts;
      }

      const txResult = await cacheService.getTransactionsWithCache(
        since,
        until,
        flags.refresh,
        cacheEnabled,
        () => apiService.listAllTransactions(since, until)
      );
      transactions = txResult.transactions;
      fromCache = txResult.fromCache;
      if (fromCache && !flags.quiet) {
        this.log(`${formatCacheAge(txResult.cacheAge)}\n`);
      }
      // Warn if cache was corrupted on load
      warnIfCacheCorrupted(this, flags.quiet);
    } catch (error) {
      this.error(`Error fetching transactions: ${getErrorMessage(error)}`);
    }

    // Filter by account if specified
    if (flags.account) {
      const accountFilter = flags.account.toLowerCase();
      // Try to match by ID first, then by name (case-insensitive partial match)
      const matchedAccount = accounts.find((acc: Account) =>
        acc._id === flags.account ||
        acc.name.toLowerCase().includes(accountFilter)
      );

      if (!matchedAccount) {
        this.error(`Account "${flags.account}" not found. Use 'bank accounts --names' to list available accounts.`);
      }

      // Filter transactions to only include those from the matched account
      transactions = transactions.filter((tx: EnrichedTransaction) => tx._account === matchedAccount._id);

      if (!flags.quiet) {
        this.log(`Filtering by account: ${matchedAccount.name}\n`);
      }
    }

    // Prepare months list in chronological order YYYY-MM (derived from date range)
    const months: string[] = [];
    const current = new Date(startParsed.getFullYear(), startParsed.getMonth(), 1);
    const endMonth = new Date(endParsed.getFullYear(), endParsed.getMonth(), 1);
    while (current <= endMonth) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }

    // Aggregate spend (absolute debit amounts)
    interface CatAgg {
      parent: string;
      category: string;
      // month string -> amount
      [key: string]: string | number;
    }

    // parent -> category -> month -> amount
    const agg: Record<string, Record<string, Record<string, number>>> = {};

    for (const tx of transactions) {
      // Skip internal transfers entirely
      if (isExcludedTransactionType(tx.type)) continue;

      const amtNum = Number(tx.amount);
      if (amtNum >= 0) continue; // only outflows

      const monthKey = (() => {
        const d = new Date(tx.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      if (!months.includes(monthKey)) continue;

      const parent = (tx.category?.groups?.['personal_finance']?.name ?? UNCATEGORIZED).toLowerCase();
      const detailed = (tx.category?.name ?? UNCATEGORIZED).toLowerCase();

      agg[parent] = agg[parent] || {};
      agg[parent][detailed] = agg[parent][detailed] || Object.fromEntries(months.map(m => [m, 0]));
      agg[parent][detailed][monthKey] += Math.abs(amtNum);
    }

    // Convert to rows array
    const rows: CatAgg[] = [];
    const parentsSorted = Object.keys(agg).sort();

    // Handle empty results
    if (parentsSorted.length === 0) {
      if (!flags.quiet) {
        this.log(`No spending found between ${since} and ${until}.`);
        this.log('');
        this.log('This could be because:');
        this.log('  - No outgoing transactions exist in this date range');
        this.log('  - All transactions are internal transfers (excluded from spending)');
        this.log('');
        this.log('Tips:');
        this.log('  - Try a wider date range: --days 90');
        this.log('  - Check your transactions: bank transactions --since ' + since);
      }
      return;
    }

    for (const parent of parentsSorted) {
      const categories = Object.keys(agg[parent]).sort();
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row: CatAgg = {
          parent: i === 0 && format === 'table' ? parent : (format === 'table' ? '' : parent),
          category: cat,
        } as CatAgg;
        for (const m of months) {
          row[m] = Number((agg[parent][cat][m] ?? 0).toFixed(NZD_DECIMAL_PLACES));
        }
        rows.push(row);
      }
      // Insert a spacer row between parent groups in table mode
      if (format === 'table') {
        rows.push({ parent: '─'.repeat(5), category: '─'.repeat(5) } as CatAgg);
      }
    }

    // Remove last spacer if exists
    if (format === 'table' && rows.length && rows[rows.length - 1].parent.startsWith('─')) {
      rows.pop();
    }

    // Add grand total row (sum of all categories per month)
    if (rows.length > 0) {
      const totals: Record<string, number> = {};
      for (const m of months) {
        totals[m] = 0;
      }
      // Sum from non-spacer rows
      for (const row of rows) {
        if (typeof row.parent === 'string' && row.parent.startsWith('─')) continue;
        for (const m of months) {
          totals[m] += Number(row[m] ?? 0);
        }
      }

      // Add separator and total row for table format
      if (format === 'table') {
        rows.push({ parent: '═'.repeat(5), category: '═'.repeat(5) } as CatAgg);
      }
      const totalRow: CatAgg = {
        parent: format === 'table' ? 'TOTAL' : 'total',
        category: '',
      } as CatAgg;
      for (const m of months) {
        totalRow[m] = Number(totals[m].toFixed(NZD_DECIMAL_PLACES));
      }
      rows.push(totalRow);
    }

    formatOutput(rows, format, this.log.bind(this));
  }
}
