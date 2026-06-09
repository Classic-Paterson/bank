import { EnrichedTransaction } from 'akahu';

/**
 * Application-wide type definitions
 */

// Configuration types
export interface AppConfig {
  appToken?: string;
  userToken?: string;
  format?: OutputFormat;
  cacheData?: boolean;
  transferAllowlist?: string[];
  transferMaxAmount?: number;
  [key: string]: any;
}

// Output format types
export type OutputFormat = 'json' | 'csv' | 'table' | 'list' | 'ndjson';

// Transaction-related types
export interface FormattedTransaction {
  id: string;
  date: Date;
  accountName: string;
  accountNumber: string;
  amount: number;
  description: string;
  particulars: string;
  merchant: string;
  category: string;
  parentCategory: string;
  type: string;
}

export interface TransactionFilter {
  accountId?: string;
  category?: string;
  maxAmount?: number;
  minAmount?: number;
  since?: string;
  until?: string;
  type?: string;
  parentCategory?: string;
  merchant?: string;
  /** Search by transaction ID or description */
  search?: string;
  /** Filter by direction: 'in' for income (positive), 'out' for spending (negative) */
  direction?: 'in' | 'out';
}

// Cache types
export interface CachedDateRange {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
}

export interface TransactionCache {
  lastUpdate: string | null;
  transactions: EnrichedTransaction[];
  /** Date ranges that have been fully fetched and cached */
  cachedRanges?: CachedDateRange[];
}

export interface AccountCache {
  lastUpdate: string | null;
  accounts: AccountSummary[];
}

// Saved query types
export interface SavedQuery {
  name: string;
  description?: string;
  filters: TransactionFilter;
  createdAt: string;
  lastUsed?: string;
}

export type SavedQueryMap = Record<string, SavedQuery>;

// Merchant categorization types
export interface MerchantCategory {
  parent: string;
  category: string;
}

export type MerchantMap = Record<string, MerchantCategory>;

// Category analysis types
export interface CategoryAggregation {
  parent: string;
  category: string;
  [monthKey: string]: string | number;
}

// Settings types
export interface SettingDefinition {
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  options?: string[];
  default?: any;
  /** If true, value should be masked when displayed */
  sensitive?: boolean;
}

// OAuth types
export interface OAuthCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

export interface GoogleOAuthConfig {
  installed: OAuthCredentials;
}

// Account summary types
export interface AccountSummary {
  id?: string;
  accountNumber: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  availableBalance?: number;
  meta?: string;
}

// API response types
export interface TransactionQueryParams {
  start?: string;
  end?: string;
  cursor?: string;
}

// Error types
export interface ApiError extends Error {
  code?: string;
  statusCode?: number;
}

// Budget types
export type BudgetPeriod = 'annual' | 'monthly' | 'fortnightly' | 'weekly';

export type BudgetMatcherField =
  | 'parentCategory'
  | 'category'
  | 'merchant'
  | 'description'
  | 'particulars'
  | 'account'
  | 'type';

export interface BudgetMatcher {
  field: BudgetMatcherField;
  /** Case-insensitive substring match against the named field */
  pattern: string;
}

export interface BudgetLine {
  /** Stable identifier - normalised "category::subcategory" */
  id: string;
  /** Top-level group (e.g. "Cash Expenses") */
  category: string;
  /** Sub-line (e.g. "Groceries") */
  subcategory: string;
  /** Period the amount represents */
  period: BudgetPeriod;
  /** Amount in that period (positive number, NZD) */
  amount: number;
  /**
   * Direction: 'out' for expenses, 'in' for income, 'savings' for transfers
   * to savings sub-accounts (will be matched against the destination account
   * rather than against spending categories).
   */
  direction: 'out' | 'in' | 'savings';
  /** Free-text notes (mirrors the spreadsheet) */
  notes?: string;
  /** Matchers - ANY match assigns the transaction to this line */
  matchers: BudgetMatcher[];
}

export interface Budget {
  lines: BudgetLine[];
}

export interface BudgetActual {
  line: BudgetLine;
  /** Sum of matched transaction magnitudes for the queried window */
  actual: number;
  /** Expected amount over the queried window, derived from line.period */
  expected: number;
  /** Number of transactions matched */
  count: number;
  /** Pace ratio: actual/expected (1 = on pace, >1 over) */
  paceRatio: number;
}

// NZFCC Category types (from external categories JSON)
export interface NZFCCCategoryGroup {
  name: string;
}

export interface NZFCCCategory {
  name: string;
  groups: {
    personal_finance: NZFCCCategoryGroup;
    [key: string]: NZFCCCategoryGroup;
  };
}
