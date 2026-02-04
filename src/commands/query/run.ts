import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';

import { formatOutput } from '../../utils/output.js';
import { parseDateRange } from '../../utils/date.js';
import { getErrorMessage } from '../../utils/error.js';
import { refreshFlag, formatFlag, detailsFlag, quietFlag, warnIfConfigCorrupted, resolveFormat, isCacheEnabled } from '../../utils/flags.js';
import { apiService } from '../../services/api.service.js';
import { cacheService } from '../../services/cache.service.js';
import { queryService } from '../../services/query.service.js';
import { transactionProcessingService } from '../../services/transaction-processing.service.js';
import { FormattedTransaction } from '../../types/index.js';
import { DEFAULT_QUERY_DAYS_BACK, NZD_DECIMAL_PLACES } from '../../constants/index.js';

export default class QueryRun extends Command {
  static description = 'Run a saved query';

  static override args = {
    name: Args.string({
      description: 'Query name to run',
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> groceries',
    '<%= config.bin %> <%= command.id %> groceries --since thismonth',
    '<%= config.bin %> <%= command.id %> groceries --since lastquarter',
    '<%= config.bin %> <%= command.id %> groceries --refresh',
  ];

  static override flags = {
    since: Flags.string({
      char: 's',
      description: 'Start date override (YYYY-MM-DD)',
    }),
    until: Flags.string({
      char: 'u',
      description: 'End date override (YYYY-MM-DD)',
    }),
    format: formatFlag,
    details: detailsFlag,
    refresh: refreshFlag,
    quiet: quietFlag,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(QueryRun);

    warnIfConfigCorrupted(this, flags.quiet);

    const query = queryService.get(args.name);
    if (!query) {
      this.error(`Query "${args.name}" not found. List available queries with: bank query list`);
    }

    // Mark as used
    queryService.markUsed(args.name);

    // Resolve and validate format early (normalized to lowercase)
    const format = resolveFormat(flags.format, 'table');
    const cacheEnabled = isCacheEnabled();

    // Parse and validate date range
    const dateResult = parseDateRange({
      since: flags.since,
      until: flags.until,
      defaultDaysBack: DEFAULT_QUERY_DAYS_BACK,
    });
    if (!dateResult.success) {
      this.error(dateResult.error);
    }
    const { startDate, endDate } = dateResult;

    try {
      // Fetch transactions with caching
      const txResult = await cacheService.getTransactionsWithCache(
        startDate,
        endDate,
        flags.refresh,
        cacheEnabled,
        () => apiService.listAllTransactions(startDate, endDate)
      );

      // Fetch accounts with caching
      const accResult = await cacheService.getAccountsWithCache(
        flags.refresh,
        cacheEnabled,
        () => apiService.listAccounts()
      );
      const accounts = accResult.accounts;
      const fromCache = txResult.fromCache || accResult.fromCache;

      // Format transactions
      const formattedTx = transactionProcessingService.formatTransactions(txResult.transactions, accounts);

      // Apply saved filters using the centralized service (handles sorting by date)
      const transactions = transactionProcessingService.applyFilters(formattedTx, query.filters);

      if (transactions.length > 0) {
        if (!flags.quiet) {
          this.log('');
          this.log(chalk.dim(`  Running query: ${args.name}${fromCache ? ' (cached)' : ''}`));
          this.log(chalk.dim(`  Date range: ${startDate} to ${endDate}`));
          this.log('');
        }

        const formattedTransactions = transactions.map((tx: FormattedTransaction) => ({
          ...tx,
          date: tx.date.toLocaleDateString(),
        }));

        const displayData = (format === 'table' && !flags.details)
          ? formattedTransactions.map((t) => ({
              date: t.date,
              account: t.accountName,
              amount: t.amount,
              description: t.description,
              category: t.category,
            }))
          : formattedTransactions;

        formatOutput(displayData, format, this.log.bind(this));

        // Summary
        if (!flags.quiet) {
          const totalAmount = transactions.reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);
          this.log('');
          this.log(chalk.dim(`  ${transactions.length} transactions | Total: $${totalAmount.toFixed(NZD_DECIMAL_PLACES)}`));
          this.log('');
        }
      } else if (!flags.quiet) {
        // Show helpful empty result message with query details
        this.log('');
        this.log(chalk.yellow(`  No transactions found for query "${args.name}".`));
        this.log(chalk.dim(`  Date range: ${startDate} to ${endDate}`));
        this.log('');

        // Show the filters that were applied
        const filters = query.filters;
        const appliedFilters: string[] = [];
        if (filters.merchant) appliedFilters.push(`merchant="${filters.merchant}"`);
        if (filters.category) appliedFilters.push(`category="${filters.category}"`);
        if (filters.parentCategory) appliedFilters.push(`parentCategory="${filters.parentCategory}"`);
        if (filters.accountId) appliedFilters.push(`account="${filters.accountId}"`);
        if (filters.type) appliedFilters.push(`type="${filters.type}"`);
        if (filters.minAmount !== undefined) appliedFilters.push(`minAmount=${filters.minAmount}`);
        if (filters.maxAmount !== undefined) appliedFilters.push(`maxAmount=${filters.maxAmount}`);
        if (filters.direction) appliedFilters.push(`direction=${filters.direction}`);

        if (appliedFilters.length > 0) {
          this.log(chalk.dim(`  Filters: ${appliedFilters.join(', ')}`));
          this.log('');
        }

        this.log(chalk.dim('  Tips:'));
        this.log(chalk.dim('    - Try a wider date range: bank query run ' + args.name + ' --since 3m'));
        this.log(chalk.dim('    - View query details: bank query show ' + args.name));
        this.log('');
      }

    } catch (error) {
      this.error(`Error running query: ${getErrorMessage(error)}`);
    }
  }
}
