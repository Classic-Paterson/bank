import { Command } from '@oclif/core';

import { cacheService } from '../../services/cache.service.js';
import { formatRelativeTime } from '../../utils/output.js';

export default class CacheInfo extends Command {
  static description = 'Show cache status and statistics';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    await this.parse(CacheInfo);
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
}
