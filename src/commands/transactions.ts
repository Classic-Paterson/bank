import { Args, Command, Flags } from '@oclif/core';
import { EnrichedTransaction } from 'akahu';

import { formatOutput, formatCurrency, formatCacheAge } from '../utils/output.js';
import { parseDateRange, validateAmountRange } from '../utils/date.js';
import { getErrorMessage } from '../utils/error.js';
import { refreshFlag, quietFlag, formatFlag, amountFlag, dateFilterFlags, warnIfConfigCorrupted, warnIfCacheCorrupted, resolveFormat, isCacheEnabled, checkMutuallyExclusiveFlags } from '../utils/flags.js';
import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { FormattedTransaction, TransactionFilter } from '../types/index.js';
import { DEFAULT_TRANSACTION_DAYS_BACK, PARENT_CATEGORIES, NZD_DECIMAL_PLACES, UNCATEGORIZED, isExcludedTransactionType } from '../constants/index.js';

export default class Transactions extends Command {
  static override args = {
    transaction: Args.string({ description: 'Transaction ID or description to filter' }),
  };

  static description = 'Access transaction data';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --days 30',
    '<%= config.bin %> <%= command.id %> --since thismonth       # This month so far',
    '<%= config.bin %> <%= command.id %> --since lastmonth --until endoflastmonth  # Full last month',
    '<%= config.bin %> <%= command.id %> --since thisweek        # This week (Mon-today)',
    '<%= config.bin %> <%= command.id %> --since thisweek --until endofthisweek  # Full week (Mon-Sun)',
    '<%= config.bin %> <%= command.id %> --since lastweek --until endoflastweek  # Full last week (Mon-Sun)',
    '<%= config.bin %> <%= command.id %> --since thisquarter     # This quarter so far',
    '<%= config.bin %> <%= command.id %> --since thisyear        # Year to date',
    '<%= config.bin %> <%= command.id %> --since 2023-01-01 --until 2023-01-31',
    '<%= config.bin %> <%= command.id %> --minAmount 100 --maxAmount 500',
    '<%= config.bin %> <%= command.id %> --account acc_12345',
    '<%= config.bin %> <%= command.id %> --category "Groceries"',
    '<%= config.bin %> <%= command.id %> --type "TRANSFER"',
    '<%= config.bin %> <%= command.id %> --parentCategory "Utilities"',
    '<%= config.bin %> <%= command.id %> --merchant "Amazon"',
    '<%= config.bin %> <%= command.id %> --parentCategory "Groceries" --merchant "Whole Foods"',
    '<%= config.bin %> <%= command.id %> --days 30 --count       # Get count of transactions',
    '<%= config.bin %> <%= command.id %> --merchant "Countdown" --days 30 --total  # Total spent at merchant',
    '<%= config.bin %> <%= command.id %> --direction out         # Show only spending/expenses',
    '<%= config.bin %> <%= command.id %> --direction in          # Show only income',
    '<%= config.bin %> <%= command.id %> --direction out --minAmount 50 --maxAmount 200  # Spending between $50-$200',
    '<%= config.bin %> <%= command.id %> --relative              # Show relative dates (e.g., "2d ago")',
    '<%= config.bin %> <%= command.id %> --days 30 --summary     # Show transactions with spending summary',
    '<%= config.bin %> <%= command.id %> --days 30 --merchants   # List unique merchants',
    '<%= config.bin %> <%= command.id %> --parentCategory "Utilities" --merchants  # Merchants in a category',
    '<%= config.bin %> <%= command.id %> --days 30 --top 10       # Top 10 merchants by spending',
    '<%= config.bin %> <%= command.id %> --since thismonth --top 5 --direction out  # Top 5 spending merchants this month',
    '<%= config.bin %> <%= command.id %> --days 30 --topCategories 5  # Top 5 spending categories',
    '<%= config.bin %> <%= command.id %> --since thismonth --topCategories 3  # Top 3 categories this month',
    '<%= config.bin %> <%= command.id %> --days 30 --stats        # Quick statistics for last 30 days',
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
      description: 'Maximum transaction amount (filters by magnitude, e.g., 100 matches both -$100 and +$100)',
    }),
    minAmount: amountFlag({
      description: 'Minimum transaction amount (filters by magnitude, e.g., 50 matches both -$50 and +$50)',
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
    summary: Flags.boolean({
      description: 'Show spending summary after transaction list (income, spending, net)',
      default: false,
    }),
    direction: Flags.string({
      description: 'Filter by direction: "in" for income (positive), "out" for spending (negative). Combine with --minAmount/--maxAmount to find transactions in a specific range.',
      options: ['in', 'out'],
    }),
    relative: Flags.boolean({
      description: 'Show relative dates (e.g., "2d ago") instead of absolute dates in table view',
      default: false,
    }),
    merchants: Flags.boolean({
      description: 'List unique merchants from matching transactions (sorted alphabetically)',
      default: false,
    }),
    top: Flags.integer({
      description: 'Show top N merchants by spending amount (e.g., --top 10)',
      default: undefined,
    }),
    topCategories: Flags.integer({
      description: 'Show top N categories by spending amount (e.g., --topCategories 5)',
      default: undefined,
    }),
    stats: Flags.boolean({
      description: 'Show statistics only (count, total, average, date range) without listing transactions',
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
      onWarning: flags.quiet ? undefined : (msg) => this.warn(msg),
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

    // Validate --top flag
    if (flags.top !== undefined && flags.top < 1) {
      this.error('Invalid --top value. Must be at least 1.');
    }

    // Validate --topCategories flag
    if (flags.topCategories !== undefined && flags.topCategories < 1) {
      this.error('Invalid --topCategories value. Must be at least 1.');
    }

    // Validate mutually exclusive output mode flags
    const flagConflict = checkMutuallyExclusiveFlags([
      ['--count', flags.count],
      ['--total', flags.total],
      ['--merchants', flags.merchants],
      ['--top', flags.top],
      ['--topCategories', flags.topCategories],
      ['--stats', flags.stats],
    ]);
    if (flagConflict) {
      this.error(flagConflict);
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
      // Use the oldest cache age for display (whichever was cached longer ago)
      const cacheAge = txResult.cacheAge || accResult.cacheAge;

      // Warn if cache was corrupted on load
      warnIfCacheCorrupted(this, flags.quiet);

      if (fromCache && format === 'table' && !flags.quiet) {
        this.log(`${formatCacheAge(cacheAge)}\n`);
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
        if (flags.count) {
          this.log('0');
          return;
        }
        if (flags.total) {
          this.log((0).toFixed(NZD_DECIMAL_PLACES));
          return;
        }
        if (flags.merchants) {
          // No merchants to list - output count in quiet mode, helpful message otherwise
          if (flags.quiet) {
            this.log('0');
          } else {
            this.log('(0 unique merchants)');
          }
          return;
        }
        if (flags.top !== undefined) {
          // No merchants to rank - output nothing in quiet mode, helpful message otherwise
          if (!flags.quiet) {
            this.log('No merchants to rank - no transactions found.');
          }
          return;
        }
        if (flags.stats) {
          // Show zeroed stats for empty results
          this.log('Transaction Statistics');
          this.log('─────────────────────────────────────');
          this.log(`Period:          ${sinceDate} to ${untilDate}`);
          this.log(`Count:           0 transactions`);
          this.log(`Income:          ${formatCurrency(0)}`);
          this.log(`Spending:        ${formatCurrency(0)}`);
          this.log(`Net:             ${formatCurrency(0)}`);
          this.log('─────────────────────────────────────');
          this.log(`Total:           ${formatCurrency(0)}`);
          this.log(`Average:         ${formatCurrency(0)}`);
          this.log(`Min:             ${formatCurrency(0)}`);
          this.log(`Max:             ${formatCurrency(0)}`);
          this.log('─────────────────────────────────────');
          this.log(`Merchants:       0`);
          this.log(`Categories:      0`);
          return;
        }
        if (!flags.quiet) {
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
          this.log('  - List available merchants: bank transactions --days 30 --merchants');
          if (filters.merchant) {
            this.log('  - Merchant filter is case-insensitive and matches substrings (e.g., "pak" matches "Pak N Save")');
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

      // If --merchants flag is set, output unique merchants alphabetically
      if (flags.merchants) {
        const merchants = [...new Set(
          filteredTransactions
            .map((tx: FormattedTransaction) => tx.merchant)
            .filter((m: string) => m && m.trim())
        )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        for (const merchant of merchants) {
          this.log(merchant);
        }
        if (!flags.quiet) {
          this.log(`\n(${merchants.length} unique merchant${merchants.length === 1 ? '' : 's'})`);
        }
        return;
      }

      // If --top flag is set, show top N merchants by total spending
      if (flags.top !== undefined) {
        // Aggregate spending by merchant
        const merchantTotals = filteredTransactions.reduce((acc: Map<string, number>, tx: FormattedTransaction) => {
          const merchant = tx.merchant?.trim();
          if (!merchant) return acc;
          // Use absolute value of amount for ranking (spending is negative)
          const current = acc.get(merchant) || 0;
          acc.set(merchant, current + Math.abs(tx.amount));
          return acc;
        }, new Map<string, number>());

        // Sort by total amount descending and take top N
        const topMerchants = [...merchantTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, flags.top);

        // Find max merchant name length for alignment
        const maxNameLen = Math.max(...topMerchants.map(([name]) => name.length), 10);

        for (const [merchant, total] of topMerchants) {
          const padding = ' '.repeat(Math.max(1, maxNameLen - merchant.length + 2));
          this.log(`${merchant}${padding}${formatCurrency(total)}`);
        }
        if (!flags.quiet) {
          const totalSpending = topMerchants.reduce((sum, [, total]) => sum + total, 0);
          this.log(`\n(top ${topMerchants.length} merchant${topMerchants.length === 1 ? '' : 's'}, total: ${formatCurrency(totalSpending)})`);
        }
        return;
      }

      // If --topCategories flag is set, show top N categories by total spending
      if (flags.topCategories !== undefined) {
        // Aggregate spending by parent category (excluding transfers)
        const categoryTotals = filteredTransactions.reduce((acc: Map<string, number>, tx: FormattedTransaction) => {
          if (isExcludedTransactionType(tx.type)) return acc;
          if (tx.amount >= 0) return acc; // Only count spending (negative amounts)
          const category = tx.parentCategory?.trim() || UNCATEGORIZED;
          const current = acc.get(category) || 0;
          acc.set(category, current + Math.abs(tx.amount));
          return acc;
        }, new Map<string, number>());

        // Sort by total amount descending and take top N
        const topCategories = [...categoryTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, flags.topCategories);

        if (topCategories.length === 0) {
          if (!flags.quiet) {
            this.log('No spending categories found.');
          }
          return;
        }

        // Find max category name length for alignment
        const maxNameLen = Math.max(...topCategories.map(([name]) => name.length), 10);

        for (const [category, total] of topCategories) {
          const padding = ' '.repeat(Math.max(1, maxNameLen - category.length + 2));
          this.log(`${category}${padding}${formatCurrency(total)}`);
        }
        if (!flags.quiet) {
          const totalSpending = topCategories.reduce((sum, [, total]) => sum + total, 0);
          this.log(`\n(top ${topCategories.length} ${topCategories.length === 1 ? 'category' : 'categories'}, total: ${formatCurrency(totalSpending)})`);
        }
        return;
      }

      // If --stats flag is set, show statistical summary
      if (flags.stats) {
        const count = filteredTransactions.length;
        const total = filteredTransactions.reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);
        const income = filteredTransactions.filter((tx: FormattedTransaction) => tx.amount > 0 && !isExcludedTransactionType(tx.type)).reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);
        const spending = filteredTransactions.filter((tx: FormattedTransaction) => tx.amount < 0 && !isExcludedTransactionType(tx.type)).reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);
        const average = count > 0 ? total / count : 0;

        // Calculate amounts using absolute values for meaningful stats
        const amounts = filteredTransactions.map((tx: FormattedTransaction) => tx.amount);
        const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
        const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;

        // Get unique merchants and categories
        const uniqueMerchants = new Set(filteredTransactions.map((tx: FormattedTransaction) => tx.merchant).filter(Boolean)).size;
        const uniqueCategories = new Set(filteredTransactions.map((tx: FormattedTransaction) => tx.parentCategory).filter(Boolean)).size;

        // Date range from data
        const dates = filteredTransactions.map((tx: FormattedTransaction) => tx.date.getTime());
        const earliestDate = dates.length > 0 ? new Date(Math.min(...dates)).toISOString().split('T')[0] : sinceDate;
        const latestDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString().split('T')[0] : untilDate;

        this.log('Transaction Statistics');
        this.log('─────────────────────────────────────');
        this.log(`Period:          ${earliestDate} to ${latestDate}`);
        this.log(`Count:           ${count} transaction${count === 1 ? '' : 's'}`);
        this.log(`Income:          ${formatCurrency(income)}`);
        this.log(`Spending:        ${formatCurrency(spending)}`);
        this.log(`Net:             ${formatCurrency(income + spending)}`);
        this.log('─────────────────────────────────────');
        this.log(`Total:           ${formatCurrency(total)}`);
        this.log(`Average:         ${formatCurrency(average)}`);
        this.log(`Min:             ${formatCurrency(minAmount)}`);
        this.log(`Max:             ${formatCurrency(maxAmount)}`);
        this.log('─────────────────────────────────────');
        this.log(`Merchants:       ${uniqueMerchants}`);
        this.log(`Categories:      ${uniqueCategories}`);
        return;
      }

      // Generate display-ready data via service (handles date formatting and field selection)
      const displayData = transactionProcessingService.generateDisplayData(filteredTransactions, format, flags.details, flags.relative);

      formatOutput(displayData, format, this.log.bind(this));

      // Show count summary for table format (always useful, doesn't require --details)
      if (format === 'table' && !flags.quiet) {
        this.log(`\n(${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? '' : 's'})`);
      }

      // Show spending summary if --summary flag is set (works with any format)
      if (flags.summary && !flags.quiet) {
        // Calculate income (positive amounts, excluding transfers)
        const income = filteredTransactions
          .filter((tx: FormattedTransaction) => tx.amount > 0 && !isExcludedTransactionType(tx.type))
          .reduce((sum: number, tx: FormattedTransaction) => sum + Number(tx.amount), 0);

        // Calculate spending (negative amounts, excluding transfers)
        const spending = filteredTransactions
          .filter((tx: FormattedTransaction) => tx.amount < 0 && !isExcludedTransactionType(tx.type))
          .reduce((sum: number, tx: FormattedTransaction) => sum + Number(tx.amount), 0);

        const net = income + spending;

        this.log('');
        this.log('Summary:');
        this.log(`  Income:   ${formatCurrency(income)}`);
        this.log(`  Spending: ${formatCurrency(spending)}`);
        this.log(`  Net:      ${formatCurrency(net)}`);
      }

      if (format === 'table' && flags.details && !flags.quiet) {
        // Summary stats
        const totalTransactions = filteredTransactions.length;
        const totalAmount = filteredTransactions.reduce((sum: number, tx: FormattedTransaction) => sum + Number(tx.amount), 0);
        this.log(`\nSummary: Total Transactions: ${totalTransactions} | Total Amount: $${totalAmount.toFixed(NZD_DECIMAL_PLACES)}`);

        // Category Breakdown summary, ignoring empty categories and transfers
        const categorySummary = filteredTransactions.reduce<Record<string, number>>((acc: Record<string, number>, tx: FormattedTransaction) => {
          // Skip transfer types; they net out across user accounts
          if (isExcludedTransactionType(tx.type)) {
            return acc;
          }

          const category = tx.parentCategory.toLowerCase().trim();
          if (category) {
            acc[category] = (acc[category] || 0) + Number(tx.amount);
          } else {
            acc[UNCATEGORIZED] = (acc[UNCATEGORIZED] || 0) + Number(tx.amount);
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