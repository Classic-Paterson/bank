import { Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';

import { cacheService } from '../../services/cache.service.js';

export default class CacheClear extends Command {
  static description = 'Clear cached data';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --accounts',
    '<%= config.bin %> <%= command.id %> --transactions',
    '<%= config.bin %> <%= command.id %> -y  # Skip confirmation prompt',
  ];

  static override flags = {
    accounts: Flags.boolean({
      char: 'a',
      description: 'Clear only account cache',
      default: false,
    }),
    transactions: Flags.boolean({
      char: 't',
      description: 'Clear only transaction cache',
      default: false,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(CacheClear);

    // If neither flag is set, clear both
    const clearBoth = !flags.accounts && !flags.transactions;

    // Determine what will be cleared for the confirmation message
    let clearDescription: string;
    if (clearBoth) {
      clearDescription = 'all cached data (accounts and transactions)';
    } else if (flags.accounts && flags.transactions) {
      clearDescription = 'both account and transaction caches';
    } else if (flags.accounts) {
      clearDescription = 'account cache';
    } else {
      clearDescription = 'transaction cache';
    }

    // Confirm before clearing
    if (!flags.yes) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: `Clear ${clearDescription}?`,
        default: false,
      }]);

      if (!proceed) {
        this.log('Cache clear cancelled.');
        return;
      }
    }

    if (clearBoth) {
      cacheService.clearCache();
      this.log('Cleared all cached data.');
    } else {
      if (flags.accounts) {
        cacheService.clearAccountCache();
        this.log('Cleared account cache.');
      }
      if (flags.transactions) {
        cacheService.clearTransactionCache();
        this.log('Cleared transaction cache.');
      }
    }
  }
}
