import { Command } from '@oclif/core';

import { configService } from '../../services/config.service.js';
import { maskSensitiveValue } from '../../utils/mask.js';
import { SENSITIVE_SETTINGS, VALID_SETTINGS } from '../../utils/settings-config.js';

export default class SettingsList extends Command {
  static description = 'List all settings and their current values';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    await this.parse(SettingsList);
    const config = configService.getAll();
    this.log('Available settings:');

    // Display all valid settings with their current values or defaults
    for (const [settingKey, settingInfo] of Object.entries(VALID_SETTINGS)) {
      const currentValue = config[settingKey];
      const defaultValue = settingInfo.default;

      if (currentValue !== undefined) {
        let displayValue = Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue);
        if (SENSITIVE_SETTINGS.has(settingKey) && typeof currentValue === 'string') {
          displayValue = maskSensitiveValue(currentValue);
        }
        this.log(`${settingKey}: ${displayValue} (${settingInfo.description})`);
      } else if (defaultValue !== undefined) {
        const displayDefault = Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue;
        this.log(`${settingKey}: ${displayDefault} (default, ${settingInfo.description})`);
      } else {
        this.log(`${settingKey}: not set (${settingInfo.description})`);
      }
    }
  }
}
