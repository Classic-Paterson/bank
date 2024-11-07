import { Args, Command, Flags } from '@oclif/core';
import { formatOutput } from '../utils/output.js';
import { listAllTransactions } from '../utils/api.js';
import { EnrichedTransaction } from 'akahu/dist/index.js';
import { getConfig } from '../utils/config.js';

export default class Transactions extends Command {
  static description = 'Access transaction data';

  static override args = {
    transaction: Args.string({ description: 'Transaction ID or description to filter' }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --since 2023-01-01 --until 2023-01-31',
    '<%= config.bin %> <%= command.id %> --minAmount 100 --maxAmount 500',
    '<%= config.bin %> <%= command.id %> --account acc_12345',
    '<%= config.bin %> <%= command.id %> --category "Groceries"',
  ];

  static override flags = {
    format: Flags.string({
      char: 'f',
      description: 'Output format (json, csv, table)',
      options: ['json', 'csv', 'table'],
    }),
    account: Flags.string({
      char: 'a',
      description: 'Account ID to filter transactions',
    }),
    since: Flags.string({
      char: 's',
      description: 'Start date for transactions (YYYY-MM-DD)',
      required: true,
    }),
    until: Flags.string({
      char: 'u',
      description: 'End date for transactions (YYYY-MM-DD)',
      required: true,
    }),
    minAmount: Flags.integer({
      description: 'Minimum transaction amount',
    }),
    maxAmount: Flags.integer({
      description: 'Maximum transaction amount',
    }),
    category: Flags.string({
      char: 'c',
      description: 'Transaction category to filter',
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Transactions);

    const format = flags.format ?? getConfig('format') ?? 'json';

    try {
      // Fetch all transactions within the date range
      const transactionsData = await listAllTransactions(
        flags.since,
        flags.until,
      ) as EnrichedTransaction[];

      // Map transactions to desired output format
      const transactions = transactionsData.map(transaction => ({
        id: transaction._id,
        date: transaction.date,
        description: transaction.description,
        merchant: transaction.merchant?.name ?? '',
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category?.name ?? '',
        account_id: transaction._account,
        account_name: transaction._account ?? '',
      }));

      let filteredTransactions = transactions;

      // Filter by account ID if provided
      if (flags.account) {
        filteredTransactions = filteredTransactions.filter(transaction =>
          transaction.account_id === flags.account || transaction.account_name.toLowerCase() === (flags.account ?? '').toLowerCase()
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
          transaction.amount <= (flags.maxAmount ?? Infinity)
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
        formatOutput(filteredTransactions, format);
      } else {
        this.error('No transactions found matching your criteria.');
      }

    } catch (error: any) {
      this.error(`Error fetching transactions: ${error.message}`);
    }
  }
}