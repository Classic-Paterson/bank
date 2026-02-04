import { SettingDefinition } from '../types/index.js';
import { OUTPUT_FORMATS } from '../constants/index.js';

// Sensitive settings that should be masked when displayed
export const SENSITIVE_SETTINGS = new Set(['appToken', 'userToken']);

// Define the valid settings that can be configured
export const VALID_SETTINGS: Record<string, SettingDefinition> = {
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
