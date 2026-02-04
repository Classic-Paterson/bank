import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';

import { queryService, validateQueryName } from '../../services/query.service.js';
import { validateAmountRange } from '../../utils/date.js';
import { amountFlag } from '../../utils/flags.js';
import { TransactionFilter } from '../../types/index.js';

export default class QuerySave extends Command {
  static description = 'Save a named transaction query';

  static override args = {
    name: Args.string({
      description: 'Query name',
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> groceries --merchant "Countdown,Pak N Save" --parentCategory food',
    '<%= config.bin %> <%= command.id %> large-purchases --minAmount 100 --description "Purchases over $100"',
  ];

  static override flags = {
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
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(QuerySave);

    // Validate query name format
    const nameValidation = validateQueryName(args.name);
    if (!nameValidation.valid) {
      this.error(nameValidation.error!);
    }

    // Check if query already exists
    if (queryService.exists(args.name)) {
      this.error(`Query "${args.name}" already exists. Delete it first or choose a different name.`);
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

    queryService.save(args.name, filter, flags.description);

    this.log('');
    this.log(chalk.green(`  Query "${args.name}" saved successfully.`));
    this.log('');
    this.log(`  Run it with: ${chalk.cyan(`bank query run ${args.name}`)}`);
    this.log('');
  }
}
