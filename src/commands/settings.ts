import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import * as fs from 'fs';

import { configService } from '../services/config.service.js';
import { merchantMappingService } from '../services/merchant-mapping.service.js';
import { getErrorMessage } from '../utils/error.js';
import { maskSensitiveValue } from '../utils/mask.js';
import { SettingDefinition, MerchantMap } from '../types/index.js';
import { OUTPUT_FORMATS } from '../constants/index.js';

// Sensitive settings that should be masked when displayed
const SENSITIVE_SETTINGS = new Set(['appToken', 'userToken']);

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
      description: 'Action to perform (set, get, list, reset, help, export-merchants, import-merchants)',
      options: ['set', 'get', 'list', 'reset', 'help', 'export-merchants', 'import-merchants']
    }),
    key: Args.string({
      required: false,
      description: 'Setting key or file path for import/export',
    }),
    value: Args.string({ required: false, description: 'Value to set' }),
  };

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt for reset/import',
      default: false,
    }),
    merge: Flags.boolean({
      char: 'm',
      description: 'Merge imported merchants with existing (default replaces all)',
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
    '$ bank settings help              # Show available settings and their types',
    '$ bank settings export-merchants                    # Export to stdout (pipe to file)',
    '$ bank settings export-merchants merchants.json     # Export to file',
    '$ bank settings import-merchants merchants.json     # Import from file (replaces existing)',
    '$ bank settings import-merchants merchants.json -m  # Merge with existing mappings',
    '$ bank settings import-merchants merchants.json -y  # Skip confirmation prompt',
  ];

  async run() {
    const { args, flags } = await this.parse(Settings);

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

        case 'help':
          this.showSettingsHelp();
          break;

        case 'export-merchants':
          this.exportMerchants(key); // key is used as optional file path
          break;

        case 'import-merchants':
          await this.importMerchants(key, flags.yes, flags.merge);
          break;

        default:
          this.error(`Unknown action '${action}'. Available actions are: set, get, list, reset, help, export-merchants, import-merchants.`);
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

  /**
   * Export merchant mappings to stdout or a file.
   * Output format is JSON, suitable for piping or saving.
   */
  private exportMerchants(filePath?: string): void {
    const mappings = merchantMappingService.getAllMappings();
    const count = Object.keys(mappings).length;

    if (count === 0) {
      this.warn('No merchant mappings to export. Use "bank categorise" to create mappings.');
      return;
    }

    const json = JSON.stringify(mappings, null, 2);

    if (filePath) {
      // Write to file
      fs.writeFileSync(filePath, json);
      this.log(`Exported ${count} merchant mapping${count === 1 ? '' : 's'} to ${filePath}`);
    } else {
      // Output to stdout (for piping)
      console.log(json);
    }
  }

  /**
   * Import merchant mappings from a JSON file.
   * Can either replace all existing mappings or merge with them.
   */
  private async importMerchants(filePath: string | undefined, skipConfirm: boolean, merge: boolean): Promise<void> {
    if (!filePath) {
      this.error('Please provide a file path for import.\nUsage: bank settings import-merchants <file.json>');
    }

    // Check file exists
    if (!fs.existsSync(filePath)) {
      this.error(`File not found: ${filePath}`);
    }

    // Read and parse file
    let importData: MerchantMap;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      importData = JSON.parse(content) as MerchantMap;
    } catch (parseError) {
      this.error(`Invalid JSON file: ${getErrorMessage(parseError)}`);
    }

    // Validate structure
    const validationError = this.validateMerchantMapStructure(importData);
    if (validationError) {
      this.error(validationError);
    }

    const importCount = Object.keys(importData).length;
    if (importCount === 0) {
      this.warn('The import file contains no merchant mappings.');
      return;
    }

    const existingMappings = merchantMappingService.getAllMappings();
    const existingCount = Object.keys(existingMappings).length;

    // Confirm before importing
    if (!skipConfirm) {
      const message = merge
        ? `Merge ${importCount} mapping${importCount === 1 ? '' : 's'} with ${existingCount} existing?`
        : existingCount > 0
          ? `Replace ${existingCount} existing mapping${existingCount === 1 ? '' : 's'} with ${importCount} from file?`
          : `Import ${importCount} merchant mapping${importCount === 1 ? '' : 's'}?`;

      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message,
        default: false,
      }]);

      if (!proceed) {
        this.log('Import cancelled.');
        return;
      }
    }

    // Perform import
    let finalMappings: MerchantMap;
    if (merge) {
      finalMappings = { ...existingMappings, ...importData };
    } else {
      finalMappings = importData;
    }

    const success = merchantMappingService.saveMerchantMap(finalMappings);
    if (!success) {
      this.error('Failed to save merchant mappings.');
    }

    const finalCount = Object.keys(finalMappings).length;
    if (merge) {
      const newCount = finalCount - existingCount;
      const updatedCount = importCount - newCount;
      this.log(`Imported ${importCount} mapping${importCount === 1 ? '' : 's'} (${newCount} new, ${updatedCount} updated). Total: ${finalCount}`);
    } else {
      this.log(`Imported ${finalCount} merchant mapping${finalCount === 1 ? '' : 's'}.`);
    }
  }

  /**
   * Validate that imported data has the expected MerchantMap structure.
   * Returns an error message if invalid, undefined if valid.
   */
  private validateMerchantMapStructure(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return 'Invalid format: expected a JSON object with merchant mappings.';
    }

    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'object' || value === null) {
        return `Invalid mapping for "${key}": expected object with parent and category.`;
      }

      const mapping = value as Record<string, unknown>;
      if (typeof mapping.parent !== 'string' || typeof mapping.category !== 'string') {
        return `Invalid mapping for "${key}": must have "parent" and "category" string properties.`;
      }
    }

    return undefined;
  }
}