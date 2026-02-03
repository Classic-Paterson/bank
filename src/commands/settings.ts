import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';

import { configService } from '../services/config.service.js';
import { getErrorMessage } from '../utils/error.js';
import { SettingDefinition } from '../types/index.js';
import { OUTPUT_FORMATS, MASK_MIN_LENGTH_FOR_PARTIAL } from '../constants/index.js';

// Sensitive settings that should be masked when displayed
const SENSITIVE_SETTINGS = new Set(['appToken', 'userToken']);

/**
 * Masks a sensitive value, showing only first/last 4 chars for longer values.
 * Short values (< MASK_MIN_LENGTH_FOR_PARTIAL) are fully masked for security.
 */
function maskSensitiveValue(value: string): string {
  if (value.length < MASK_MIN_LENGTH_FOR_PARTIAL) {
    return '*'.repeat(value.length);
  }
  return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
}

// Define the valid settings that can be configured
const VALID_SETTINGS: Record<string, SettingDefinition> = {
  appToken: {
    description: 'Akahu app token for API authentication',
    type: 'string',
    sensitive: true
  },
  userToken: {
    description: 'Akahu user token for API authentication',
    type: 'string',
    sensitive: true
  },
  format: {
    description: 'Default output format (json, csv, table, list, ndjson)',
    type: 'string',
    options: [...OUTPUT_FORMATS],
    default: 'json'
  },
  cacheData: {
    description: 'Whether to cache API responses locally',
    type: 'boolean',
    default: false
  },
  transferAllowlist: {
    description: 'Comma-separated list of allowed destination account numbers for transfers (for safety)',
    type: 'array',
    default: []
  },
  transferMaxAmount: {
    description: 'Maximum transfer amount in NZD (safety limit)',
    type: 'number',
    default: 50000
  }
};

export default class Settings extends Command {
  static override args = {
    action: Args.string({ 
      required: true, 
      description: 'Action to perform (set, get, list, reset)',
      options: ['set', 'get', 'list', 'reset']
    }),
    key: Args.string({ 
      required: false, 
      description: 'Setting key',
      options: Object.keys(VALID_SETTINGS)
    }),
    value: Args.string({ required: false, description: 'Value to set' }),
  };

  static flags = {
    help: Flags.boolean({
      char: 'h',
      description: 'Show available settings',
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt for reset',
      default: false,
    }),
  };

  static description = 'Configure CLI preferences';

  static examples = [
    '$ bank settings list',
    '$ bank settings set appToken your_app_token',
    '$ bank settings set userToken your_user_token',
    '$ bank settings set format table',
    '$ bank settings set cacheData true',
    '$ bank settings set transferMaxAmount 100000',
    '$ bank settings get appToken',
    '$ bank settings reset format',
    '$ bank settings reset format -y  # Skip confirmation prompt',
    '$ bank settings --help',
  ];

  async run() {
    const { args, flags } = await this.parse(Settings);

    // Show settings help if requested
    if (flags.help) {
      this.showSettingsHelp();
      return;
    }

    const action = args.action.toLowerCase();
    const key = args.key;
    const value = args.value;

    try {
      switch (action) {
        case 'set':
          if (!key) {
            this.error('Please provide a key for the set action.');
          } else if (!value) {
            this.error('Please provide a value for the set action.');
          } else {
            // Validate the key is a recognized setting (throws on invalid)
            this.validateKey(key);

            // Validate the value based on the setting type (throws on invalid)
            const processedValue = this.validateAndProcessValue(key, value);
            configService.set(key, processedValue);
            const displayValue = Array.isArray(processedValue) ? processedValue.join(', ') : processedValue;
            this.log(`Setting '${key}' updated to '${displayValue}'.`);
          }
          break;

        case 'get':
          if (!key) {
            this.error('Please provide a key for the get action.');
          } else {
            // Validate the key is a recognized setting (throws on invalid)
            this.validateKey(key);

            const configValue = configService.get(key);
            if (configValue !== undefined) {
              let displayValue = Array.isArray(configValue) ? configValue.join(', ') : String(configValue);
              if (SENSITIVE_SETTINGS.has(key) && typeof configValue === 'string') {
                displayValue = maskSensitiveValue(configValue);
              }
              this.log(`${key}: ${displayValue}`);
            } else {
              const defaultValue = VALID_SETTINGS[key]?.default;
              if (defaultValue !== undefined) {
                const displayDefault = Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue;
                this.log(`${key}: ${displayDefault} (default)`);
              } else {
                this.log(`Setting '${key}' is not set.`);
              }
            }
          }
          break;

        case 'list': {
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
          break;
        }

        case 'reset':
          if (!key) {
            this.error('Please provide a key for the reset action.');
          } else {
            // Validate the key is a recognized setting (throws on invalid)
            this.validateKey(key);

            // Confirm before resetting (unless -y flag is provided)
            if (!flags.yes) {
              const defaultValue = VALID_SETTINGS[key]?.default;
              const defaultDisplay = defaultValue !== undefined
                ? ` to default value: ${Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue}`
                : '';

              const { proceed } = await inquirer.prompt([{
                type: 'confirm',
                name: 'proceed',
                message: `Reset setting '${key}'${defaultDisplay}?`,
                default: false,
              }]);

              if (!proceed) {
                this.log('Reset cancelled.');
                break;
              }
            }

            configService.reset(key);
            const defaultValue = VALID_SETTINGS[key]?.default;
            if (defaultValue !== undefined) {
              const displayDefault = Array.isArray(defaultValue) ? defaultValue.join(', ') : defaultValue;
              this.log(`Setting '${key}' has been reset to default value: ${displayDefault}`);
            } else {
              this.log(`Setting '${key}' has been reset.`);
            }
          }
          break;

        default:
          this.error(`Unknown action '${action}'. Available actions are: set, get, list, reset.`);
          break;
      }
    } catch (error) {
      this.error(`Error performing '${action}' action: ${getErrorMessage(error)}`);
    }
  }

  private showSettingsHelp(): void {
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

  private validateKey(key: string): void {
    const validKeys = Object.keys(VALID_SETTINGS);
    if (!validKeys.includes(key)) {
      const available = validKeys.join(', ');
      this.error(`Invalid setting '${key}'. Available settings: ${available}`);
    }
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