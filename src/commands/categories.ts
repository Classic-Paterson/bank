import { Command, Flags } from '@oclif/core';
import { EnrichedTransaction } from 'akahu';

import { apiService } from '../services/api.service.js';
import { formatOutput } from '../utils/output.js';

export default class Categories extends Command {
  static description = 'Show spending by parent & detailed category over the last N months';

  static examples = [
    '$ bank categories -m 6',
    '$ bank categories -m 3 -f csv',
  ];

  static flags = {
    months: Flags.integer({
      char: 'm',
      description: 'Number of months to include (starting with current month)',
      default: 6,
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format (json, csv, table)',
      options: ['json', 'csv', 'table'],
      default: 'table',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Categories);
    const monthsBack = Math.max(1, flags.months);
    const format = flags.format ?? 'table';

    // Determine date range covering the requested months
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

    const since = rangeStart.toISOString().split('T')[0];
    const untilDate = new Date(now);
    // include today by adding 1 day
    untilDate.setDate(now.getDate() + 1);
    const until = untilDate.toISOString().split('T')[0];

    // Fetch all transactions in that window
    let transactions: EnrichedTransaction[];
    try {
      transactions = await apiService.listAllTransactions(since, until);
    } catch (error: any) {
      this.error(`Error fetching transactions: ${error.message}`);
      return;
    }

    // Prepare months list in chronological order YYYY-MM
    const months: string[] = [];
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
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
      if (tx.type === 'TRANSFER') continue;

      const amtNum = Number(tx.amount);
      if (amtNum >= 0) continue; // only outflows

      const monthKey = (() => {
        const d = new Date(tx.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      if (!months.includes(monthKey)) continue;

      const parent = (tx.category?.groups?.['personal_finance']?.name ?? 'Uncategorized').toLowerCase();
      const detailed = (tx.category?.name ?? 'Uncategorized').toLowerCase();

      agg[parent] = agg[parent] || {};
      agg[parent][detailed] = agg[parent][detailed] || Object.fromEntries(months.map(m => [m, 0]));
      agg[parent][detailed][monthKey] += Math.abs(amtNum);
    }

    // Convert to rows array
    const rows: CatAgg[] = [];
    const parentsSorted = Object.keys(agg).sort();

    for (const parent of parentsSorted) {
      const categories = Object.keys(agg[parent]).sort();
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const row: CatAgg = {
          parent: i === 0 && format === 'table' ? parent : (format === 'table' ? '' : parent),
          category: cat,
        } as CatAgg;
        for (const m of months) {
          row[m] = Number((agg[parent][cat][m] ?? 0).toFixed(2));
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

    formatOutput(rows, format);
  }
}
