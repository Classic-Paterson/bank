import { Args, Command } from '@oclif/core';
import chalk from 'chalk';

import { queryService } from '../../services/query.service.js';

export default class QueryDelete extends Command {
  static description = 'Delete a saved query';

  static override args = {
    name: Args.string({
      description: 'Query name to delete',
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> groceries',
  ];

  public async run(): Promise<void> {
    const { args } = await this.parse(QueryDelete);

    if (!queryService.exists(args.name)) {
      this.error(`Query "${args.name}" not found.`);
    }

    queryService.delete(args.name);
    this.log(chalk.green(`  Query "${args.name}" deleted.`));
  }
}
