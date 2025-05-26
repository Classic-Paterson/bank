import { Command } from '@oclif/core';
import { apiService } from '../services/api.service.js';

export default class Refresh extends Command {
  static description = 'Trigger a data refresh for all linked accounts';

  static examples = [
    '$ bank refresh',
  ];

  async run() {
    try {
      this.log('Initiating data refresh for all linked accounts...');
      await apiService.refreshUserData();
      this.log('Data refresh initiated successfully.');
    } catch (error: any) {
      this.error(`Error initiating data refresh: ${error.message}`);
    }
  }
}