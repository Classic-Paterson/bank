import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';

import { cacheService } from '../services/cache.service.js';
import { formatRelativeTime } from '../utils/output.js';

export default class Cache extends Command {
  static override args = {
    action: Args.string({
      required: true,
      description: 'Action to perform',
      options: ['clear', 'info'],
    }),
  };

  static description = 'Manage local cache for accounts and transactions';

  static override examples = [
    '<%= config.bin %> <%= command.id %> info',
    '<%= config.bin %> <%= command.id %> clear',
    '<%= config.bin %> <%= command.id %> clear --accounts',
    '<%= config.bin %> <%= command.id %> clear --transactions',
    '<%= config.bin %> <%= command.id %> clear -y  # Skip confirmation prompt',
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
    const { args, flags } = await this.parse(Cache);

    switch (args.action) {
      case 'info':
        this.showCacheInfo();
        break;
      case 'clear':
        await this.clearCache(flags.accounts, flags.transactions, flags.yes);
        break;
      default:
        this.error(`Unknown action '${args.action}'.`);
    }
  }

  private showCacheInfo(): void {
    const info = cacheService.getCacheInfo();
    const writeError = cacheService.getLastWriteError();

    this.log('Cache Status:');
    this.log('');

    // Transactions
    if (info.transactions.lastUpdate) {
      const txAge = formatRelativeTime(info.transactions.lastUpdate);
      this.log(`  Transactions: ${info.transactions.count} cached (updated ${txAge})`);
    } else {
      this.log('  Transactions: empty');
    }

    // Accounts
    if (info.accounts.lastUpdate) {
      const accAge = formatRelativeTime(info.accounts.lastUpdate);
      this.log(`  Accounts: ${info.accounts.count} cached (updated ${accAge})`);
    } else {
      this.log('  Accounts: empty');
    }

    // Show write error if present
    if (writeError) {
      this.log('');
      this.warn(`Cache write error: ${writeError}`);
    }

    // Show load error if present
    const loadError = cacheService.getLoadErrorMessage();
    if (loadError) {
      this.log('');
      this.warn(`Cache load error: ${loadError}`);
      this.log('  Run `bank cache clear` to reset the cache.');
    }
  }

  private async clearCache(accountsOnly: boolean, transactionsOnly: boolean, skipConfirmation: boolean): Promise<void> {
    // If neither flag is set, clear both
    const clearBoth = !accountsOnly && !transactionsOnly;

    // Determine what will be cleared for the confirmation message
    let clearDescription: string;
    if (clearBoth) {
      clearDescription = 'all cached data (accounts and transactions)';
    } else if (accountsOnly && transactionsOnly) {
      clearDescription = 'both account and transaction caches';
    } else if (accountsOnly) {
      clearDescription = 'account cache';
    } else {
      clearDescription = 'transaction cache';
    }

    // Confirm before clearing
    if (!skipConfirmation) {
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
      if (accountsOnly) {
        cacheService.clearAccountCache();
        this.log('Cleared account cache.');
      }
      if (transactionsOnly) {
        cacheService.clearTransactionCache();
        this.log('Cleared transaction cache.');
      }
    }
  }
}
