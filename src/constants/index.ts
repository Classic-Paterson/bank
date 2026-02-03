/**
 * Application-wide constants
 */

// Configuration
export const CONFIG_DIR_NAME = '.bankcli';
export const CONFIG_FILE_NAME = 'config.json';
export const CACHE_FILE_NAME = 'transaction_cache.json';
export const ACCOUNT_CACHE_FILE_NAME = 'account_cache.json';
export const SAVED_QUERIES_FILE_NAME = 'saved_queries.json';
export const MERCHANT_MAP_FILE_NAME = 'merchant_map.json';
export const OAUTH_TOKENS_FILE_NAME = '.bank-oauth-tokens.json';

// Default values
export const DEFAULT_FORMAT = 'json';
export const DEFAULT_CACHE_ENABLED = false;
export const DEFAULT_TRANSACTION_DAYS_BACK = 7;
export const DEFAULT_CATEGORIZATION_DAYS_BACK = 90;
export const DEFAULT_CATEGORY_DAYS_BACK = 180; // ~6 months, for consistency with other commands
export const DEFAULT_OVERVIEW_DAYS_BACK = 30;
export const DEFAULT_QUERY_DAYS_BACK = 30;
export const DEFAULT_TRANSFER_MAX_AMOUNT = 50000;

// Cache TTL (time-to-live) in milliseconds
export const TRANSACTION_CACHE_TTL = 60 * 60 * 1000; // 1 hour
export const ACCOUNT_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// File permissions
export const SECURE_FILE_MODE = 0o600;

// Display formatting
export const TABLE_MAX_COLUMN_WIDTH = 55;
export const MASK_MIN_LENGTH_FOR_PARTIAL = 9; // Values 8 chars or shorter are fully masked

// Currency formatting (NZD)
export const NZD_DECIMAL_PLACES = 2;

/**
 * NZ bank account number format regex.
 * Format: BB-bbbb-AAAAAAA-SS(S)
 * - BB: Bank code (2 digits)
 * - bbbb: Branch code (4 digits)
 * - AAAAAAA: Account number (7 digits)
 * - SS(S): Suffix (2-3 digits)
 */
export const NZ_ACCOUNT_PATTERN = /^\d{2}-\d{4}-\d{7}-\d{2,3}$/;

// Google Sheets OAuth scope
export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Output formats
export const OUTPUT_FORMATS = ['json', 'csv', 'table', 'list', 'ndjson'] as const;

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

/**
 * Type-safe check if a transaction type should be excluded from spending analysis.
 * This avoids the need for 'as any' casts when checking against the readonly tuple.
 */
export function isExcludedTransactionType(type: string): boolean {
  return (EXCLUDED_TRANSACTION_TYPES as readonly string[]).includes(type);
}
