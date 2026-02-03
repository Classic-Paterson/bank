import { Args, Command, Flags } from '@oclif/core';
import { EnrichedTransaction } from 'akahu';

import { formatOutput } from '../utils/output.js';
import { parseDateRange, validateAmountRange } from '../utils/date.js';
import { getErrorMessage } from '../utils/error.js';
import { refreshFlag, quietFlag, formatFlag, amountFlag, dateFilterFlags, warnIfConfigCorrupted, resolveFormat, isCacheEnabled } from '../utils/flags.js';
import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { FormattedTransaction, TransactionFilter } from '../types/index.js';
import { DEFAULT_TRANSACTION_DAYS_BACK, PARENT_CATEGORIES, NZD_DECIMAL_PLACES } from '../constants/index.js';

export default class Transactions extends Command {
  static override args = {
    transaction: Args.string({ description: 'Transaction ID or description to filter' }),
  };

  static description = 'Access transaction data';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --days 30',
    '<%= config.bin %> <%= command.id %> --since 2023-01-01 --until 2023-01-31',
    '<%= config.bin %> <%= command.id %> --minAmount 100 --maxAmount 500',
    '<%= config.bin %> <%= command.id %> --account acc_12345',
    '<%= config.bin %> <%= command.id %> --category "Groceries"',
    '<%= config.bin %> <%= command.id %> --type "TRANSFER"',
    '<%= config.bin %> <%= command.id %> --parentCategory "Utilities"',
    '<%= config.bin %> <%= command.id %> --merchant "Amazon"',
    '<%= config.bin %> <%= command.id %> --parentCategory "Groceries" --merchant "Whole Foods"',
    '<%= config.bin %> <%= command.id %> --days 30 --count  # Get count of transactions',
    '<%= config.bin %> <%= command.id %> --merchant "Countdown" --days 30 --total  # Get total spent at merchant',
    '<%= config.bin %> <%= command.id %> --direction out  # Show only spending/expenses',
    '<%= config.bin %> <%= command.id %> --direction in   # Show only income',
    '<%= config.bin %> <%= command.id %> --relative       # Show relative dates (e.g., "2d ago")',
  ];

  static override flags = {
    ...dateFilterFlags(DEFAULT_TRANSACTION_DAYS_BACK),
    account: Flags.string({
      char: 'a',
      description: 'Account ID to filter transactions',
    }),
    category: Flags.string({
      char: 'c',
      description: 'Transaction category to filter',
    }),
    format: formatFlag,
    maxAmount: amountFlag({
      description: 'Maximum transaction amount (uses absolute value, works for both income and spending)',
    }),
    minAmount: amountFlag({
      description: 'Minimum transaction amount (uses absolute value, works for both income and spending)',
    }),
    type: Flags.string({
      char: 't',
      description: 'Transaction type to filter',
    }),
    parentCategory: Flags.string({
      char: 'p',
      description: 'Parent category to filter transactions',
      options: [...PARENT_CATEGORIES],
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
    refresh: refreshFlag,
    quiet: quietFlag,
    count: Flags.boolean({
      description: 'Output only the count of matching transactions (useful for scripting)',
      default: false,
    }),
    total: Flags.boolean({
      description: 'Output only the total amount of matching transactions (useful for scripting)',
      default: false,
    }),
    direction: Flags.string({
      description: 'Filter by direction: "in" for income, "out" for spending',
      options: ['in', 'out'],
    }),
    relative: Flags.boolean({
      char: 'r',
      description: 'Show relative dates (e.g., "2d ago") instead of absolute dates in table view',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Transactions);

    warnIfConfigCorrupted(this, flags.quiet);

    // Resolve and validate format early (normalized to lowercase)
    const format = resolveFormat(flags.format);

    // Parse and validate date range
    const dateResult = parseDateRange({
      since: flags.since,
      until: flags.until,
      days: flags.days,
      defaultDaysBack: DEFAULT_TRANSACTION_DAYS_BACK,
      extendSameDayRange: true,
    });
    if (!dateResult.success) {
      this.error(dateResult.error);
    }
    const { startDate: sinceDate, endDate: untilDate } = dateResult;

    // Validate amount filters
    const amountResult = validateAmountRange(flags.minAmount, flags.maxAmount);
    if (!amountResult.success) {
      this.error(amountResult.error);
    }

    // Validate mutually exclusive flags
    if (flags.count && flags.total) {
      this.error('Cannot use --count and --total together. Use one or the other.');
    }

    try {
      const cacheEnabled = isCacheEnabled();

      // Fetch transactions with caching
      const txResult = await cacheService.getTransactionsWithCache(
        sinceDate,
        untilDate,
        flags.refresh,
        cacheEnabled,
        () => apiService.listAllTransactions(sinceDate, untilDate)
      );

      // Filter transactions explicitly based on sinceDate
      // Pre-parse the sinceDate once to avoid repeated Date construction in the filter
      const sinceDateParsed = new Date(sinceDate);
      const transactionsDataFiltered = txResult.transactions.filter(
        (tx: EnrichedTransaction) => new Date(tx.date) >= sinceDateParsed
      );

      // Fetch accounts with caching
      const accResult = await cacheService.getAccountsWithCache(
        flags.refresh,
        cacheEnabled,
        () => apiService.listAccounts()
      );
      const accounts = accResult.accounts;
      const fromCache = txResult.fromCache || accResult.fromCache;

      if (fromCache && format === 'table' && !flags.quiet) {
        this.log('(using cached data)\n');
      }
      
      // Map transactions to desired output format using the service
      const transactions = transactionProcessingService.formatTransactions(transactionsDataFiltered, accounts);

      // Build filter object from flags
      const filters: TransactionFilter = {
        accountId: flags.account,
        category: flags.category,
        parentCategory: flags.parentCategory,
        merchant: flags.merchant,
        minAmount: flags.minAmount,
        maxAmount: flags.maxAmount,
        type: flags.type,
        search: args.transaction,
        direction: flags.direction as 'in' | 'out' | undefined,
      };

      // Apply all filters via service (also handles sorting)
      const filteredTransactions = transactionProcessingService.applyFilters(transactions, filters);

      if (filteredTransactions.length === 0) {
        // Empty results are not an error - just inform the user
        if (flags.count || flags.total) {
          this.log('0');
        } else if (!flags.quiet) {
          // Build a helpful message showing what was searched
          const appliedFilters: string[] = [];
          if (filters.merchant) appliedFilters.push(`merchant="${filters.merchant}"`);
          if (filters.category) appliedFilters.push(`category="${filters.category}"`);
          if (filters.parentCategory) appliedFilters.push(`parentCategory="${filters.parentCategory}"`);
          if (filters.accountId) appliedFilters.push(`account="${filters.accountId}"`);
          if (filters.type) appliedFilters.push(`type="${filters.type}"`);
          if (filters.minAmount !== undefined) appliedFilters.push(`minAmount=${filters.minAmount}`);
          if (filters.maxAmount !== undefined) appliedFilters.push(`maxAmount=${filters.maxAmount}`);
          if (filters.direction) appliedFilters.push(`direction=${filters.direction}`);
          if (filters.search) appliedFilters.push(`search="${filters.search}"`);

          this.log(`No transactions found between ${sinceDate} and ${untilDate}.`);
          if (appliedFilters.length > 0) {
            this.log(`Filters: ${appliedFilters.join(', ')}`);
          }
          this.log('');
          this.log('Tips:');
          this.log('  - Try a wider date range: --days 90');
          this.log('  - Check available merchants: bank transactions --days 30 --format json | jq -r ".[].merchant" | sort -u');
          if (filters.merchant) {
            this.log('  - Merchant names are case-insensitive but must match exactly');
          }
        }
        return;
      }

      // If --count flag is set, output only the count and exit
      if (flags.count) {
        this.log(String(filteredTransactions.length));
        return;
      }

      // If --total flag is set, output only the sum of amounts and exit
      if (flags.total) {
        const total = filteredTransactions.reduce((sum: number, tx: FormattedTransaction) => sum + Number(tx.amount), 0);
        this.log(total.toFixed(NZD_DECIMAL_PLACES));
        return;
      }

      // Generate display-ready data via service (handles date formatting and field selection)
      const displayData = transactionProcessingService.generateDisplayData(filteredTransactions, format, flags.details, flags.relative);

      formatOutput(displayData, format);

      // Show count summary for table format (always useful, doesn't require --details)
      if (format === 'table' && !flags.quiet) {
        this.log(`\n(${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? '' : 's'})`);
      }

      if (format === 'table' && flags.details && !flags.quiet) {
        // Summary stats
        const totalTransactions = filteredTransactions.length;
        const totalAmount = filteredTransactions.reduce((sum: number, tx: FormattedTransaction) => sum + Number(tx.amount), 0);
        this.log(`\nSummary: Total Transactions: ${totalTransactions} | Total Amount: $${totalAmount.toFixed(NZD_DECIMAL_PLACES)}`);

        // Category Breakdown summary, ignoring empty categories and transfers
        const categorySummary = filteredTransactions.reduce<Record<string, number>>((acc: Record<string, number>, tx: FormattedTransaction) => {
          // Skip transfer types; they net out across user accounts
          if (tx.type === 'TRANSFER') {
            return acc;
          }

          const category = tx.parentCategory.toLowerCase().trim();
          if (category) {
            acc[category] = (acc[category] || 0) + Number(tx.amount);
          } else {
            acc['Uncategorized'] = (acc['Uncategorized'] || 0) + Number(tx.amount);
          }
          return acc;
        }, {});

        // Only show category breakdown if there are non-transfer transactions
        if (Object.keys(categorySummary).length > 0) {
          const totalSpending = Object.values(categorySummary).reduce((sum: number, amt: number) => sum + Math.abs(amt), 0);
          this.log('\nCategory Breakdown:');
          Object.entries(categorySummary)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .forEach(([category, amount]) => {
              const pct = totalSpending ? ((Math.abs(amount) / totalSpending) * 100).toFixed(1) : '0.0';
              this.log(`  ${category}: $${amount.toFixed(NZD_DECIMAL_PLACES)} (${pct}%)`);
            });
        }
        this.log('');
      }

    } catch (error) {
      this.error(`Error fetching transactions: ${getErrorMessage(error)}`);
    }
  }
}