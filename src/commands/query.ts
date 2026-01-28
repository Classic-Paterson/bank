import { Args, Command, Flags } from '@oclif/core';
import { Account, EnrichedTransaction } from 'akahu';
import chalk from 'chalk';

import { formatOutput } from '../utils/output.js';
import { apiService } from '../services/api.service.js';
import { configService } from '../services/config.service.js';
import { cacheService } from '../services/cache.service.js';
import { queryService } from '../services/query.service.js';
import { transactionProcessingService } from '../services/transaction-processing.service.js';
import { FormattedTransaction, TransactionFilter, AccountSummary } from '../types/index.js';

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
    '<%= config.bin %> <%= command.id %> run groceries --since 2024-01-01',
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
    maxAmount: Flags.integer({
      description: 'Maximum transaction amount',
    }),
    minAmount: Flags.integer({
      description: 'Minimum transaction amount',
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
    format: Flags.string({
      char: 'f',
      description: 'Output format (json, csv, table, ndjson)',
      options: ['json', 'csv', 'table', 'ndjson'],
    }),
    details: Flags.boolean({
      char: 'd',
      description: 'Show detailed transaction info',
      default: false,
    }),
  };

  private formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Query);

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
      console.log(chalk.dim('No saved queries. Create one with: bank query save <name> --merchant "..."'));
      return;
    }

    console.log('');
    console.log(chalk.bold('  SAVED QUERIES'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log('');

    for (const query of queries) {
      const filters = Object.entries(query.filters)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      console.log(`  ${chalk.bold(query.name)}`);
      if (query.description) {
        console.log(`    ${chalk.dim(query.description)}`);
      }
      console.log(`    ${chalk.cyan(filters || '(no filters)')}`);
      console.log(`    ${chalk.dim(`created ${this.formatRelativeTime(query.createdAt)}`)}${query.lastUsed ? chalk.dim(` | last used ${this.formatRelativeTime(query.lastUsed)}`) : ''}`);
      console.log('');
    }
  }

  private async saveQuery(name: string | undefined, flags: any): Promise<void> {
    if (!name) {
      this.error('Query name is required. Usage: bank query save <name> --merchant "..."');
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

    // Check if any filters were provided
    const hasFilters = Object.values(filter).some(v => v !== undefined);
    if (!hasFilters) {
      this.error('At least one filter is required. Use --merchant, --category, --parentCategory, etc.');
    }

    queryService.save(name, filter, flags.description);

    console.log('');
    console.log(chalk.green(`  Query "${name}" saved successfully.`));
    console.log('');
    console.log(`  Run it with: ${chalk.cyan(`bank query run ${name}`)}`);
    console.log('');
  }

  private async runQuery(name: string | undefined, flags: any): Promise<void> {
    if (!name) {
      this.error('Query name is required. Usage: bank query run <name>');
    }

    const query = queryService.get(name);
    if (!query) {
      this.error(`Query "${name}" not found. List available queries with: bank query list`);
    }

    // Mark as used
    queryService.markUsed(name);

    const format = flags.format ?? configService.get('format') ?? 'table';
    const cacheEnabled = configService.get<boolean>('cacheData') ?? false;

    // Use date overrides or defaults
    const endDate = flags.until ?? new Date().toISOString().split('T')[0];
    const startDate = flags.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      let transactionsData: EnrichedTransaction[];
      let accounts: Account[];

      // Fetch transactions
      if (cacheEnabled && cacheService.isTransactionCacheValid(startDate, endDate)) {
        transactionsData = cacheService.getCachedTransactions(startDate, endDate);
      } else {
        transactionsData = await apiService.listAllTransactions(startDate, endDate);
        if (cacheEnabled) {
          cacheService.setTransactionCache(transactionsData);
        }
      }

      // Fetch accounts
      if (cacheEnabled && cacheService.isAccountCacheValid()) {
        const cachedAccounts = cacheService.getCachedAccounts();
        accounts = cachedAccounts.map((acc: AccountSummary) => ({
          _id: acc.id ?? '',
          name: acc.name,
          formatted_account: acc.accountNumber,
          type: acc.type,
          connection: { name: acc.institution },
          balance: { current: acc.balance, available: acc.availableBalance },
        })) as unknown as Account[];
      } else {
        accounts = await apiService.listAccounts();
        if (cacheEnabled) {
          cacheService.setAccountCache(accounts);
        }
      }

      // Format transactions
      let transactions = transactionProcessingService.formatTransactions(transactionsData, accounts);

      // Apply saved filters
      const filter = query.filters;

      if (filter.accountId) {
        transactions = transactions.filter((tx: FormattedTransaction) =>
          tx.accountNumber === filter.accountId ||
          tx.accountName.toLowerCase() === filter.accountId?.toLowerCase()
        );
      }

      if (filter.category) {
        const categoryFilter = filter.category.toLowerCase();
        transactions = transactions.filter((tx: FormattedTransaction) =>
          tx.category.toLowerCase().includes(categoryFilter)
        );
      }

      if (filter.minAmount !== undefined) {
        transactions = transactions.filter((tx: FormattedTransaction) =>
          tx.amount >= (filter.minAmount ?? 0)
        );
      }

      if (filter.maxAmount !== undefined) {
        transactions = transactions.filter((tx: FormattedTransaction) =>
          tx.amount <= (filter.maxAmount ?? Number.POSITIVE_INFINITY)
        );
      }

      if (filter.type) {
        const typeFilter = filter.type.toLowerCase();
        transactions = transactions.filter((tx: FormattedTransaction) =>
          tx.type.toLowerCase() === typeFilter
        );
      }

      if (filter.parentCategory) {
        const parentCategoryFilter = filter.parentCategory.toLowerCase();
        transactions = transactions.filter((tx: FormattedTransaction) =>
          tx.parentCategory.toLowerCase().includes(parentCategoryFilter)
        );
      }

      if (filter.merchant) {
        // Support comma-separated merchants
        const merchants = filter.merchant.split(',').map(m => m.trim().toLowerCase());
        transactions = transactions.filter((tx: FormattedTransaction) =>
          merchants.some(m => tx.merchant.toLowerCase().includes(m))
        );
      }

      // Sort by date
      transactions.sort((a: FormattedTransaction, b: FormattedTransaction) =>
        a.date.getTime() - b.date.getTime()
      );

      if (transactions.length > 0) {
        console.log('');
        console.log(chalk.dim(`  Running query: ${name}`));
        console.log(chalk.dim(`  Date range: ${startDate} to ${endDate}`));
        console.log('');

        const formattedTransactions = transactions.map((tx: FormattedTransaction) => ({
          ...tx,
          date: tx.date.toLocaleDateString(),
        }));

        const displayData = (format.toLowerCase() === 'table' && !flags.details)
          ? formattedTransactions.map((t) => ({
              date: t.date,
              account: t.accountName,
              amount: t.amount,
              description: t.description,
              category: t.category,
            }))
          : formattedTransactions;

        formatOutput(displayData, format);

        // Summary
        const totalAmount = transactions.reduce((sum: number, tx: FormattedTransaction) => sum + tx.amount, 0);
        console.log('');
        console.log(chalk.dim(`  ${transactions.length} transactions | Total: $${totalAmount.toFixed(2)}`));
        console.log('');
      } else {
        console.log(chalk.yellow(`  No transactions found for query "${name}" in the specified date range.`));
      }

    } catch (error: any) {
      this.error(`Error running query: ${error.message}`);
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
    console.log(chalk.green(`  Query "${name}" deleted.`));
  }

  private async showQuery(name: string | undefined): Promise<void> {
    if (!name) {
      this.error('Query name is required. Usage: bank query show <name>');
    }

    const query = queryService.get(name);
    if (!query) {
      this.error(`Query "${name}" not found.`);
    }

    console.log('');
    console.log(chalk.bold(`  Query: ${query.name}`));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));

    if (query.description) {
      console.log(`  Description: ${query.description}`);
    }

    console.log('');
    console.log(chalk.bold('  Filters:'));

    const filters = query.filters;
    if (filters.accountId) console.log(`    Account: ${filters.accountId}`);
    if (filters.category) console.log(`    Category: ${filters.category}`);
    if (filters.parentCategory) console.log(`    Parent Category: ${filters.parentCategory}`);
    if (filters.merchant) console.log(`    Merchant: ${filters.merchant}`);
    if (filters.type) console.log(`    Type: ${filters.type}`);
    if (filters.minAmount !== undefined) console.log(`    Min Amount: $${filters.minAmount}`);
    if (filters.maxAmount !== undefined) console.log(`    Max Amount: $${filters.maxAmount}`);

    console.log('');
    console.log(chalk.dim(`  Created: ${this.formatRelativeTime(query.createdAt)}`));
    if (query.lastUsed) {
      console.log(chalk.dim(`  Last Used: ${this.formatRelativeTime(query.lastUsed)}`));
    }
    console.log('');
  }
}
