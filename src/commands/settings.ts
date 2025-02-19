import { Args, Command } from '@oclif/core';
import { getConfig, setConfig, resetConfig, getAllConfig } from '../utils/config.js';

export default class Settings extends Command {
  static override args = {
    action: Args.string({ required: true, description: 'Action to perform (set, get, list, reset)' }),
    key: Args.string({ required: false, description: 'Setting key' }),
    value: Args.string({ required: false, description: 'Value to set' }),
  };


  static description = 'Configure CLI preferences';


  static examples = [
    '$ bank settings set api_key your_api_key',
    '$ bank settings get api_key',
    '$ bank settings list',
    '$ bank settings reset api_key',
  ];

  async run() {
    const { args } = await this.parse(Settings);

    const action = args.action.toLowerCase();
    const key = args.key;
    const value = args.value;

    try {
      switch (action) {
        case 'set':
          if (!key || !value) {
            this.error('Please provide both key and value for the set action.');
          } else {
            setConfig(key, value);
            this.log(`Setting '${key}' updated to '${value}'.`);
          }
          break;

        case 'get':
          if (!key) {
            this.error('Please provide a key for the get action.');
          } else {
            const configValue = getConfig(key);
            if (configValue !== undefined) {
              this.log(`${key}: ${configValue}`);
            } else {
              this.log(`Setting '${key}' is not set.`);
            }
          }
          break;

        case 'list': {
          const config = getAllConfig();
          if (Object.keys(config).length > 0) {
            this.log('Current settings:');
            for (const [configKey, configValue] of Object.entries(config)) {
              this.log(`${configKey}: ${configValue}`);
            }
          } else {
            this.log('No settings have been configured.');
          }
          break;
        }

        case 'reset':
          if (!key) {
            this.error('Please provide a key for the reset action.');
          } else {
            resetConfig(key);
            this.log(`Setting '${key}' has been reset.`);
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
}