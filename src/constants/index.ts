/**
 * Application-wide constants
 */

// Configuration
export const CONFIG_DIR_NAME = '.bankcli';
export const CONFIG_FILE_NAME = 'config.json';
export const CACHE_FILE_NAME = 'transaction_cache.json';
export const MERCHANT_MAP_FILE_NAME = 'merchant_map.json';
export const OAUTH_TOKENS_FILE_NAME = '.bank-oauth-tokens.json';

// Default values
export const DEFAULT_FORMAT = 'json';
export const DEFAULT_CACHE_ENABLED = false;
export const DEFAULT_TRANSACTION_DAYS_BACK = 1;
export const DEFAULT_CATEGORIZATION_DAYS_BACK = 90;
export const DEFAULT_CATEGORY_MONTHS_BACK = 6;

// File permissions
export const SECURE_FILE_MODE = 0o600;

// Google Sheets OAuth scope
export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Output formats
export const OUTPUT_FORMATS = ['json', 'csv', 'table', 'ndjson'] as const;

// Valid parent categories
export const PARENT_CATEGORIES = [
  'professional services',
  'household',
  'lifestyle',
  'appearance',
  'transport',
  'food',
  'housing',
  'education',
  'health',
  'utilities',
] as const;

// Transaction types that should be filtered out from spending analysis
export const EXCLUDED_TRANSACTION_TYPES = ['TRANSFER'] as const;
