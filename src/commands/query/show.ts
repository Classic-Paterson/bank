import { Args, Command } from '@oclif/core';
import chalk from 'chalk';

import { queryService } from '../../services/query.service.js';
import { formatRelativeTime } from '../../utils/output.js';

export default class QueryShow extends Command {
  static description = 'Show details of a saved query';

  static override args = {
    name: Args.string({
      description: 'Query name to show',
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> groceries',
  ];

  public async run(): Promise<void> {
    const { args } = await this.parse(QueryShow);

    const query = queryService.get(args.name);
    if (!query) {
      this.error(`Query "${args.name}" not found.`);
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
