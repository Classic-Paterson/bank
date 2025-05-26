import { Args, Command, Flags } from '@oclif/core';

import { listAccounts, listAllTransactions } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { formatOutput } from '../utils/output.js';
import { getCacheData, updateCache } from '../utils/cache.js';

export default class Transactions extends Command {
  static override args = {
    transaction: Args.string({ description: 'Transaction ID or description to filter' }),
  };

  static description = 'Access transaction data';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --since 2023-01-01 --until 2023-01-31',
    '<%= config.bin %> <%= command.id %> --minAmount 100 --maxAmount 500',
    '<%= config.bin %> <%= command.id %> --account acc_12345',
    '<%= config.bin %> <%= command.id %> --category "Groceries"',
    '<%= config.bin %> <%= command.id %> --type "TRANSFER"',
    '<%= config.bin %> <%= command.id %> --parentCategory "Utilities"',
    '<%= config.bin %> <%= command.id %> --merchant "Amazon"',
    '<%= config.bin %> <%= command.id %> --parentCategory "Groceries" --merchant "Whole Foods"',
  ];

  static override flags = {
    account: Flags.string({
      char: 'a',
      description: 'Account ID to filter transactions',
    }),
    category: Flags.string({
      char: 'c',
      description: 'Transaction category to filter',
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format (json, csv, table)',
      options: ['json', 'csv', 'table'],
    }),
    maxAmount: Flags.integer({
      description: 'Maximum transaction amount',
    }),
    minAmount: Flags.integer({
      description: 'Minimum transaction amount',
    }),
    since: Flags.string({
      char: 's',
      description: 'Start date for transactions (YYYY-MM-DD)',
    }),
    until: Flags.string({
      char: 'u',
      default: new Date().toISOString().split('T')[0],
      description: 'End date for transactions (YYYY-MM-DD)',
    }),
    type: Flags.string({
      char: 't',
      description: 'Transaction type to filter',
    }),
    parentCategory: Flags.string({
      char: 'p',
      description: 'Parent category to filter transactions',
      options: ['professional services', 'household', 'lifestyle', 'appearance', 'transport', 'food', 'housing', 'education', 'health', 'utilities'],
    }),
    merchant: Flags.string({
      char: 'm',
      description: 'Merchant name to filter transactions',
    }),
    details: Flags.boolean({
      char: 'd',
      description: 'Show detailed transaction info',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Transactions);
    const format = flags.format ?? getConfig('format') ?? 'json';
    const { lastUpdate } = getCacheData();
    const sinceDate = flags.since ?? lastUpdate?.split('T')[0] ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const untilParsed = new Date(flags.until);
    const sinceParsed = new Date(sinceDate);

    // If start and end are the same, shift end by one day
    if (sinceParsed.toDateString() === untilParsed.toDateString()) {
      untilParsed.setDate(untilParsed.getDate() + 1);
    }

    const untilDate = untilParsed.toISOString().split('T')[0];

    try {
      // Fetch all transactions within the date range
      const transactionsData = await listAllTransactions(
        sinceDate,
        untilDate,
      );

      // Filter transactions explicitly based on sinceDate
      const transactionsDataFiltered = transactionsData.filter(tx => new Date(tx.date) >= new Date(sinceDate));

      const accounts = await listAccounts();
      
      // Map transactions to desired output format
      const transactions = transactionsDataFiltered.map(transaction => {
        let category = transaction.category?.name ?? '';
        category = category.replace(/,/g, '');
        const parentCategory = transaction.category?.groups['personal_finance']?.name ?? '';
      
        if (transaction.type === "TRANSFER") {
          category = 'Transfer';
        } else if (transaction.type === "STANDING ORDER") {
          category = 'Automatic Payment';
        } else if (transaction.type === "CREDIT" && (transaction.description.toLowerCase().includes("drawings") || transaction.description.toLowerCase().includes("salary"))) {
          category = 'Income';
        }
      
        return {
          date: new Date(transaction.date),
          accountName: accounts.find(account => account._id === transaction._account)?.name ?? '',
          amount: transaction.amount,
          particulars: transaction.meta?.particulars ?? '',
          description: transaction.description,
          merchant: transaction.merchant?.name ?? '',
          parentCategory: parentCategory,
          category: category,
          type: transaction.type,
          accountNumber: accounts.find(account => account._id === transaction._account)?.formatted_account ?? '',
          id: transaction._id,
        };
      });

      // Sort transactions by date
      transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      let filteredTransactions = transactions;

      // Filter by account ID if provided
      if (flags.account) {
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.accountNumber === flags.account || transaction.accountName.toLowerCase() === (flags.account ?? '').toLowerCase()
        );
      }

      // Filter by category if provided
      if (flags.category) {
        const categoryFilter = flags.category.toLowerCase();
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.category.toLowerCase().includes(categoryFilter)
        );
      }

      // Filter by minimum amount if provided
      if (flags.minAmount !== undefined) {
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.amount >= (flags.minAmount ?? 0)
        );
      }

      // Filter by maximum amount if provided
      if (flags.maxAmount !== undefined) {
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.amount <= (flags.maxAmount ?? Number.POSITIVE_INFINITY)
        );
      }

      // Filter by transaction type if provided
      if (flags.type) {
        const typeFilter = flags.type.toLowerCase();
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.type.toLowerCase() === typeFilter
        );
      }

      // New filter: filter by parentCategory if provided
      if (flags.parentCategory) {
        const parentCategoryFilter = flags.parentCategory.toLowerCase();
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.parentCategory.toLowerCase().includes(parentCategoryFilter)
        );
      }

      // New filter: filter by merchant if provided
      if (flags.merchant) {
        const merchantFilter = flags.merchant.toLowerCase();
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.merchant.toLowerCase().includes(merchantFilter)
        );
      }

      // Filter by transaction ID or description if provided as an argument
      if (args.transaction) {
        const transactionFilter = args.transaction.toLowerCase();
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.id === args.transaction ||
          transaction.description.toLowerCase().includes(transactionFilter)
        );
      }

      if (filteredTransactions.length > 0) {
        // Format the date for display
        const formattedTransactions = filteredTransactions.map(transaction => ({
          ...transaction,
          date: transaction.date.toLocaleDateString(),
        }));
        
        // If output is table and details is false, show a lean view
        const displayData = (format.toLowerCase() === 'table' && !flags.details)
          ? formattedTransactions.map(t => ({
              date: t.date,
              account: t.accountName,
              amount: t.amount,
              description: t.description,
              category: t.category,
            }))
          : formattedTransactions;
        
        formatOutput(displayData, format);
        
        if (format.toLowerCase() === 'table' && flags.details) {
          // Existing summary
          const totalTransactions = filteredTransactions.length;
          const totalAmount = filteredTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
          console.log(`\nSummary: Total Transactions: ${totalTransactions} | Total Amount: $${totalAmount.toFixed(2)}\n`);
          
          // New: Category Breakdown summary (enhanced), ignoring empty categories
          const categorySummary = filteredTransactions.reduce<Record<string, number>>((acc, tx) => {
            // Skip transfer types; they net out across user accounts
            if (tx.type === 'TRANSFER') {
              return acc;
            }

            const category = tx.parentCategory.toLowerCase().trim();
            if (category) {
              acc[category] = (acc[category] || 0) + Number(tx.amount);
            } else {
              // if no category then add to 'Uncategorized'
              acc['Uncategorized'] = (acc['Uncategorized'] || 0) + Number(tx.amount);
            }
            return acc;
          }, {});
          // Calculate total spending (absolute amounts)
          const totalSpending = Object.values(categorySummary).reduce((sum, amt) => sum + Math.abs(amt), 0);
          console.log('Category Breakdown:');
          // Sort categories by absolute amount descending
          Object.entries(categorySummary)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .forEach(([category, amount]) => {
              const pct = totalSpending ? ((Math.abs(amount) / totalSpending) * 100).toFixed(1) : '0.0';
              console.log(`  ${category}: $${amount.toFixed(2)} (${pct}%)`);
            });
          console.log('');
        }
      } else {
        this.error('No transactions found matching your criteria.');
      }

      updateCache(transactionsData);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.error(`Error fetching transactions: ${error.message}`);
    }
  }
}