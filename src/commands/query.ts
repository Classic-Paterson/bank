import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';

import { formatOutput, formatRelativeTime } from '../utils/output.js';
import { parseDateRange, validateAmountRange } from '../utils/date.js';
import { getErrorMessage } from '../utils/error.js';
import { refreshFlag, formatFlag, detailsFlag, amountFlag, quietFlag, warnIfConfigCorrupted, resolveFormat, isCacheEnabled } from '../utils/flags.js';
import { apiService } from '../services/api.service.js';
import { cacheService } from '../services/cache.service.js';
import { queryService, validateQueryName } from '../services/query.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { FormattedTransaction, TransactionFilter } from '../types/index.js';
import { DEFAULT_QUERY_DAYS_BACK, NZD_DECIMAL_PLACES } from '../constants/index.js';

/** Flags for save and run query commands - matches oclif parsed flag types */
interface QueryFlags {
  // Filter flags (for save)
  account?: string;
  category?: string;
  maxAmount?: number;
  minAmount?: number;
  type?: string;
  parentCategory?: string;
  merchant?: string;
  description?: string;
  direction?: string;
  // Runtime flags (for run)
  since?: string;
  until?: string;
  format?: string;
  details?: boolean;
  refresh: boolean;
  quiet: boolean;
}

export default class Query extends Command {
  static description = 'Save, list, and run named transaction queries';

  static override args = {
    action: Args.string({
      description: 'Action to perform (run, save, list, delete, show)',
      required: true,
      options: ['run', 'save', 'list', 'delete', 'show'],
    }),
    name: Args.string({
      description: 'Query name',
    }),
  };

  static override examples = [
    // List queries
    '<%= config.bin %> <%= command.id %> list',
    // Save a query
    '<%= config.bin %> <%= command.id %> save groceries --merchant "Countdown,Pak N Save" --parentCategory food',
    '<%= config.bin %> <%= command.id %> save large-purchases --minAmount 100 --description "Purchases over $100"',
    // Run a query
    '<%= config.bin %> <%= command.id %> run groceries',
    '<%= config.bin %> <%= command.id %> run groceries --since thismonth',
    '<%= config.bin %> <%= command.id %> run groceries --since lastquarter',
    '<%= config.bin %> <%= command.id %> run groceries --refresh',
    // Show query details
    '<%= config.bin %> <%= command.id %> show groceries',
    // Delete a query
    '<%= config.bin %> <%= command.id %> delete groceries',
  ];

  static override flags = {
    // Filters for saving queries
    account: Flags.string({
      char: 'a',
      description: 'Account ID or name to filter',
    }),
    category: Flags.string({
      char: 'c',
      description: 'Transaction category to filter',
    }),
    maxAmount: amountFlag({
      description: 'Maximum transaction amount (supports decimals, e.g., 99.50)',
    }),
    minAmount: amountFlag({
      description: 'Minimum transaction amount (supports decimals, e.g., 10.00)',
    }),
    type: Flags.string({
      char: 't',
      description: 'Transaction type to filter',
    }),
    parentCategory: Flags.string({
      char: 'p',
      description: 'Parent category to filter',
    }),
    merchant: Flags.string({
      char: 'm',
      description: 'Merchant name(s) to filter (comma-separated)',
    }),
    direction: Flags.string({
      description: 'Filter by direction: "in" for income, "out" for spending',
      options: ['in', 'out'],
    }),
    description: Flags.string({
      description: 'Description for the saved query',
    }),
    // Overrides when running
    since: Flags.string({
      char: 's',
      description: 'Start date override (YYYY-MM-DD)',
    }),
    until: Flags.string({
      char: 'u',
      description: 'End date override (YYYY-MM-DD)',
    }),
    // Output options
    format: formatFlag,
    details: detailsFlag,
    refresh: refreshFlag,
    quiet: quietFlag,
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Query);

    warnIfConfigCorrupted(this, flags.quiet);

    switch (args.action) {
      case 'list':
        await this.listQueries();
        break;
      case 'save':
        await this.saveQuery(args.name, flags);
        break;
      case 'run':
        await this.runQuery(args.name, flags);
        break;
      case 'delete':
        await this.deleteQuery(args.name);
        break;
      case 'show':
        await this.showQuery(args.name);
        break;
      default:
        this.error(`Unknown action: ${args.action}`);
    }
  }

  private async listQueries(): Promise<void> {
    const queries = queryService.list();

    if (queries.length === 0) {
      this.log(chalk.dim('No saved queries. Create one with: bank query save <name> --merchant "..."'));
      return;
    }

    this.log('');
    this.log(chalk.bold('  SAVED QUERIES'));
    this.log(chalk.dim('  ─────────────────────────────────────────────'));
    this.log('');

    for (const query of queries) {
      const filters = Object.entries(query.filters)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      this.log(`  ${chalk.bold(query.name)}`);
      if (query.description) {
        this.log(`    ${chalk.dim(query.description)}`);
      }
      this.log(`    ${chalk.cyan(filters || '(no filters)')}`);
      this.log(`    ${chalk.dim(`created ${formatRelativeTime(query.createdAt)}`)}${query.lastUsed ? chalk.dim(` | last used ${formatRelativeTime(query.lastUsed)}`) : ''}`);
      this.log('');
    }
  }

  private async saveQuery(name: string | undefined, flags: QueryFlags): Promise<void> {
    if (!name) {
      this.error('Query name is required. Usage: bank query save <name> --merchant "..."');
    }

    // Validate query name format
    const nameValidation = validateQueryName(name);
    if (!nameValidation.valid) {
      this.error(nameValidation.error!);
    }

    // Check if query already exists
    if (queryService.exists(name)) {
      this.error(`Query "${name}" already exists. Delete it first or choose a different name.`);
    }

    // Build filter from flags
    const filter: TransactionFilter = {};

    if (flags.account) filter.accountId = flags.account;
    if (flags.category) filter.category = flags.category;
    if (flags.maxAmount !== undefined) filter.maxAmount = flags.maxAmount;
    if (flags.minAmount !== undefined) filter.minAmount = flags.minAmount;
    if (flags.type) filter.type = flags.type;
    if (flags.parentCategory) filter.parentCategory = flags.parentCategory;
    if (flags.merchant) filter.merchant = flags.merchant;
    if (flags.direction) filter.direction = flags.direction as 'in' | 'out';

    // Validate amount filters before saving
    const amountResult = validateAmountRange(filter.minAmount, filter.maxAmount);
    if (!amountResult.success) {
      this.error(amountResult.error);
    }

    // Check if any filters were provided
    const hasFilters = Object.values(filter).some(v => v !== undefined);
    if (!hasFilters) {
      this.error('At least one filter is required. Use --merchant, --category, --parentCategory, etc.');
    }

    queryService.save(name, filter, flags.description);

    this.log('');
    this.log(chalk.green(`  Query "${name}" saved successfully.`));
    this.log('');
    this.log(`  Run it with: ${chalk.cyan(`bank query run ${name}`)}`);
    this.log('');
  }

  private async runQuery(name: string | undefined, flags: QueryFlags): Promise<void> {
    if (!name) {
      this.error('Query name is required. Usage: bank query run <name>');
    }

    const query = queryService.get(name);
    if (!query) {
      this.error(`Query "${name}" not found. List available queries with: bank query list`);
    }

    // Mark as used
    queryService.markUsed(name);

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
          this.log(chalk.dim(`  Running query: ${name}${fromCache ? ' (cached)' : ''}`));
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
        this.log(chalk.yellow(`  No transactions found for query "${name}".`));
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
        this.log(chalk.dim('    - Try a wider date range: bank query run ' + name + ' --since 3m'));
        this.log(chalk.dim('    - View query details: bank query show ' + name));
        this.log('');
      }

    } catch (error) {
      this.error(`Error running query: ${getErrorMessage(error)}`);
    }
  }

  private async deleteQuery(name: string | undefined): Promise<void> {
    if (!name) {
      this.error('Query name is required. Usage: bank query delete <name>');
    }

    if (!queryService.exists(name)) {
      this.error(`Query "${name}" not found.`);
    }

    queryService.delete(name);
    this.log(chalk.green(`  Query "${name}" deleted.`));
  }

  private async showQuery(name: string | undefined): Promise<void> {
    if (!name) {
      this.error('Query name is required. Usage: bank query show <name>');
    }

    const query = queryService.get(name);
    if (!query) {
      this.error(`Query "${name}" not found.`);
    }

    this.log('');
    this.log(chalk.bold(`  Query: ${query.name}`));
    this.log(chalk.dim('  ─────────────────────────────────────────────'));

    if (query.description) {
      this.log(`  Description: ${query.description}`);
    }

    this.log('');
    this.log(chalk.bold('  Filters:'));

    const filters = query.filters;
    if (filters.accountId) this.log(`    Account: ${filters.accountId}`);
    if (filters.category) this.log(`    Category: ${filters.category}`);
    if (filters.parentCategory) this.log(`    Parent Category: ${filters.parentCategory}`);
    if (filters.merchant) this.log(`    Merchant: ${filters.merchant}`);
    if (filters.type) this.log(`    Type: ${filters.type}`);
    if (filters.direction) this.log(`    Direction: ${filters.direction === 'in' ? 'income' : 'spending'}`);
    if (filters.minAmount !== undefined) this.log(`    Min Amount: $${filters.minAmount}`);
    if (filters.maxAmount !== undefined) this.log(`    Max Amount: $${filters.maxAmount}`);

    this.log('');
    this.log(chalk.dim(`  Created: ${formatRelativeTime(query.createdAt)}`));
    if (query.lastUsed) {
      this.log(chalk.dim(`  Last Used: ${formatRelativeTime(query.lastUsed)}`));
    }
    this.log('');
  }
}
