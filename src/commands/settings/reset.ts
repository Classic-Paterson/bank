import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';

import { configService } from '../../services/config.service.js';
import { VALID_SETTINGS } from '../../utils/settings-config.js';

export default class SettingsReset extends Command {
  static description = 'Reset a setting to its default value';

  static override args = {
    key: Args.string({
      description: 'Setting key to reset',
      required: true,
      options: Object.keys(VALID_SETTINGS),
    }),
  };

  static override examples = [
    '<%= config.bin %> <%= command.id %> format',
    '<%= config.bin %> <%= command.id %> format -y  # Skip confirmation prompt',
  ];

  static override flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(SettingsReset);

    // Confirm before resetting (unless -y flag is provided)
    if (!flags.yes) {
      const defaultValue = VALID_SETTINGS[args.key]?.default;
      const defaultDisplay = defaultValue !== undefined
        ? ` to default value: ${Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue}`
        : '';

      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: `Reset setting '${args.key}'${defaultDisplay}?`,
        default: false,
      }]);

      if (!proceed) {
        this.log('Reset cancelled.');
        return;
      }
    }

    configService.reset(args.key);
    const defaultValue = VALID_SETTINGS[args.key]?.default;
    if (defaultValue !== undefined) {
      const displayDefault = Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue;
      this.log(`Setting '${args.key}' has been reset to default value: ${displayDefault}`);
    } else {
      this.log(`Setting '${args.key}' has been reset.`);
    }
  }
}
