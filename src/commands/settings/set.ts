import { Args, Command } from '@oclif/core';

import { configService } from '../../services/config.service.js';
import { VALID_SETTINGS } from '../../utils/settings-config.js';

export default class SettingsSet extends Command {
  static description = 'Set a configuration value';

  static override args = {
    key: Args.string({
      description: 'Setting key to set',
      required: true,
      options: Object.keys(VALID_SETTINGS),
    }),
    value: Args.string({
      description: 'Value to set',
      required: true,
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> appToken your_app_token',
    '<%= config.bin %> <%= command.id %> userToken your_user_token',
    '<%= config.bin %> <%= command.id %> format table',
    '<%= config.bin %> <%= command.id %> cacheData true',
    '<%= config.bin %> <%= command.id %> transferMaxAmount 100000',
  ];

  public async run(): Promise<void> {
    const { args } = await this.parse(SettingsSet);

    // Validate the value based on the setting type (throws on invalid)
    const processedValue = this.validateAndProcessValue(args.key, args.value);
    configService.set(args.key, processedValue);
    const displayValue = Array.isArray(processedValue) ? processedValue.join(', ') : processedValue;
    this.log(`Setting '${args.key}' updated to '${displayValue}'.`);
  }

  private validateAndProcessValue(key: string, value: string): string | boolean | number | string[] {
    const setting = VALID_SETTINGS[key];

    if (setting.type === 'boolean') {
      // Handle boolean conversion
      const boolValue = value.toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(boolValue)) {
        return true;
      } else if (['false', '0', 'no', 'n'].includes(boolValue)) {
        return false;
      }
      this.error(`Invalid boolean value for '${key}'. Use true/false, yes/no, or 1/0.`);
    } else if (setting.type === 'number') {
      // Handle number conversion
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        this.error(`Invalid number value for '${key}'. Please enter a valid number.`);
      }
      if (numValue < 0) {
        this.error(`Invalid value for '${key}'. Value must be non-negative.`);
      }
      return numValue;
    } else if (setting.type === 'array') {
      // Handle array conversion (comma-separated values)
      if (value.trim() === '') {
        return [];
      }
      return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    } else if (setting.type === 'string' && setting.options) {
      // Handle enum string values
      if (!setting.options.includes(value)) {
        this.error(`Invalid value for '${key}'. Valid options are: ${setting.options.join(', ')}`);
      }
    }

    return value;
  }
}
