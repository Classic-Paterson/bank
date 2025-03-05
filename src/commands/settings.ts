import { Args, Command, Flags } from '@oclif/core';
import { getConfig, setConfig, resetConfig, getAllConfig } from '../utils/config.js';

// Define the interface for settings
interface SettingDefinition {
  description: string;
  type: string;
  options?: string[];
  default?: any;
}

// Define the valid settings that can be configured
const VALID_SETTINGS: Record<string, SettingDefinition> = {
  api_key: {
    description: 'API key for authentication',
    type: 'string'
  },
  app_token: {
    description: 'Application token for session management',
    type: 'string'
  },
  format: {
    description: 'Output format (json, table, csv)',
    type: 'string',
    options: ['json', 'table', 'csv'],
    default: 'json'
  },
  cacheData: {
    description: 'Whether to cache API responses locally',
    type: 'boolean',
    default: false
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
  };

  static description = 'Configure CLI preferences';

  static examples = [
    '$ bank settings list',
    '$ bank settings set api_key your_api_key',
    '$ bank settings set format table',
    '$ bank settings set cacheData true',
    '$ bank settings get api_key',
    '$ bank settings reset api_key',
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
            // Validate the key is a recognized setting
            if (!this.validateKey(key)) {
              return;
            }
            
            // Validate the value based on the setting type
            const processedValue = this.validateAndProcessValue(key, value);
            if (processedValue !== undefined) {
              setConfig(key, processedValue);
              this.log(`Setting '${key}' updated to '${processedValue}'.`);
            }
          }
          break;

        case 'get':
          if (!key) {
            this.error('Please provide a key for the get action.');
          } else {
            // Validate the key is a recognized setting
            if (!this.validateKey(key)) {
              return;
            }
            
            const configValue = getConfig(key);
            if (configValue !== undefined) {
              this.log(`${key}: ${configValue}`);
            } else {
              const defaultValue = VALID_SETTINGS[key]?.default;
              if (defaultValue !== undefined) {
                this.log(`${key}: ${defaultValue} (default)`);
              } else {
                this.log(`Setting '${key}' is not set.`);
              }
            }
          }
          break;

        case 'list': {
          const config = getAllConfig();
          this.log('Available settings:');
          
          // Display all valid settings with their current values or defaults
          for (const [settingKey, settingInfo] of Object.entries(VALID_SETTINGS)) {
            const currentValue = config[settingKey];
            const defaultValue = settingInfo.default;
            
            if (currentValue !== undefined) {
              this.log(`${settingKey}: ${currentValue} (${settingInfo.description})`);
            } else if (defaultValue !== undefined) {
              this.log(`${settingKey}: ${defaultValue} (default, ${settingInfo.description})`);
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
            // Validate the key is a recognized setting
            if (!this.validateKey(key)) {
              return;
            }
            
            resetConfig(key);
            const defaultValue = VALID_SETTINGS[key]?.default;
            if (defaultValue !== undefined) {
              this.log(`Setting '${key}' has been reset to default value: ${defaultValue}`);
            } else {
              this.log(`Setting '${key}' has been reset.`);
            }
          }
          break;

        default:
          this.error(`Unknown action '${action}'. Available actions are: set, get, list, reset.`);
          break;
      }
    } catch (error: any) {
      this.error(`Error performing '${action}' action: ${error.message}`);
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

  private validateKey(key: string): boolean {
    if (!Object.keys(VALID_SETTINGS).includes(key)) {
      this.error(`Invalid setting '${key}'. Run 'bank settings --help' to see available settings.`);
      return false;
    }
    return true;
  }

  private validateAndProcessValue(key: string, value: string): any {
    const setting = VALID_SETTINGS[key];
    
    if (setting.type === 'boolean') {
      // Handle boolean conversion
      const boolValue = value.toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(boolValue)) {
        return true;
      } else if (['false', '0', 'no', 'n'].includes(boolValue)) {
        return false;
      } else {
        this.error(`Invalid boolean value for '${key}'. Use true/false, yes/no, or 1/0.`);
        return undefined;
      }
    } else if (setting.type === 'string' && setting.options) {
      // Handle enum string values
      if (!setting.options.includes(value)) {
        this.error(`Invalid value for '${key}'. Valid options are: ${setting.options.join(', ')}`);
        return undefined;
      }
    }
    
    return value;
  }
}