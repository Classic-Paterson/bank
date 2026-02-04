import { Command } from '@oclif/core';
import chalk from 'chalk';

import { queryService } from '../../services/query.service.js';
import { formatRelativeTime } from '../../utils/output.js';

export default class QueryList extends Command {
  static description = 'List all saved queries';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    await this.parse(QueryList);
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
}
