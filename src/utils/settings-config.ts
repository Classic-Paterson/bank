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
    description: 'Default output format (json, csv, table, list, ndjson). Unset = table in a terminal, json when piped',
    type: 'string',
    options: [...OUTPUT_FORMATS],
    default: 'auto'
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
  },
  excludeInternalTransfers: {
    description: 'Default --noTransfers behaviour: exclude internal transfers from overview and stats',
    type: 'boolean',
    default: false
  },
  selfPatterns: {
    description: 'Description patterns marking transactions as internal (e.g. account-holder names on standing orders). Comma-separated.',
    type: 'array',
    default: []
  }
};
