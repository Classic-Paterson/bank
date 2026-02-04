import { Args, Command } from '@oclif/core';

import { configService } from '../../services/config.service.js';
import { maskSensitiveValue } from '../../utils/mask.js';
import { SENSITIVE_SETTINGS, VALID_SETTINGS } from '../../utils/settings-config.js';

export default class SettingsGet extends Command {
  static description = 'Get the value of a specific setting';

  static override args = {
    key: Args.string({
      description: 'Setting key to get',
      required: true,
      options: Object.keys(VALID_SETTINGS),
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> appToken',
    '<%= config.bin %> <%= command.id %> format',
  ];

  public async run(): Promise<void> {
    const { args } = await this.parse(SettingsGet);

    const configValue = configService.get(args.key);
    if (configValue !== undefined) {
      let displayValue = Array.isArray(configValue) ? configValue.join(', ') : String(configValue);
      if (SENSITIVE_SETTINGS.has(args.key) && typeof configValue === 'string') {
        displayValue = maskSensitiveValue(configValue);
      }
      this.log(`${args.key}: ${displayValue}`);
    } else {
      const defaultValue = VALID_SETTINGS[args.key]?.default;
      if (defaultValue !== undefined) {
        const displayDefault = Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue;
        this.log(`${args.key}: ${displayDefault} (default)`);
      } else {
        this.log(`Setting '${args.key}' is not set.`);
      }
    }
  }
}
