import { Command } from '@oclif/core';
import ora from 'ora';
import { apiService } from '../services/api.service.js';
import { getErrorMessage } from '../utils/error.js';
import { warnIfConfigCorrupted } from '../utils/flags.js';

export default class Refresh extends Command {
  static description = 'Trigger a data refresh for all linked accounts';

  static examples = [
    '$ bank refresh',
  ];

  async run() {
    warnIfConfigCorrupted(this);

    try {
      const spinner = ora('Refreshing account data...').start();
      await apiService.refreshUserData();
      spinner.stop();
      this.log('Data refresh initiated successfully.');
    } catch (error) {
      this.error(`Error initiating data refresh: ${getErrorMessage(error)}`);
    }
  }
}