import { EnrichedTransaction } from 'akahu';

/**
 * Application-wide type definitions
 */

// Configuration types
export interface AppConfig {
  api_key?: string;
  app_token?: string;
  userToken?: string;
  format?: OutputFormat;
  cacheData?: boolean;
  transferAllowlist?: string[];
  [key: string]: any;
}

// Output format types
export type OutputFormat = 'json' | 'csv' | 'table' | 'ndjson';

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
}

// Cache types
export interface TransactionCache {
  lastUpdate: string | null;
  transactions: EnrichedTransaction[];
}

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
