import { Command } from '@oclif/core';

import { VALID_SETTINGS } from '../../utils/settings-config.js';

export default class SettingsHelp extends Command {
  static description = 'Show available settings and their types';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    await this.parse(SettingsHelp);
    this.log('Available settings:');
    for (const [key, info] of Object.entries(VALID_SETTINGS)) {
      let description = info.description;

      if (info.options) {
        description += ` (options: ${info.options.join(', ')})`;
      }

      if (info.default !== undefined) {
        description += ` (default: ${info.default})`;
      }

      this.log(`  ${key}: ${description}`);
    }
  }
}
