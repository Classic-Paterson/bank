import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Account, EnrichedTransaction } from 'akahu';
import {
  CONFIG_DIR_NAME,
  CACHE_FILE_NAME,
  ACCOUNT_CACHE_FILE_NAME,
  SECURE_FILE_MODE,
  TRANSACTION_CACHE_TTL,
  ACCOUNT_CACHE_TTL,
} from '../constants/index.js';
import { TransactionCache, AccountCache, AccountSummary } from '../types/index.js';

/**
 * Service for managing transaction and account caching with TTL support
 */
class CacheService {
  private cacheDir: string;
  private transactionCacheFile: string;
  private accountCacheFile: string;

  constructor() {
    this.cacheDir = path.join(homedir(), CONFIG_DIR_NAME);
    this.transactionCacheFile = path.join(this.cacheDir, CACHE_FILE_NAME);
    this.accountCacheFile = path.join(this.cacheDir, ACCOUNT_CACHE_FILE_NAME);
    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private loadTransactionCache(): TransactionCache {
    if (!fs.existsSync(this.transactionCacheFile)) {
      return { lastUpdate: null, transactions: [] };
    }

    try {
      const data = fs.readFileSync(this.transactionCacheFile, 'utf8');
      return JSON.parse(data) as TransactionCache;
    } catch {
      return { lastUpdate: null, transactions: [] };
    }
  }

  private loadAccountCache(): AccountCache {
    if (!fs.existsSync(this.accountCacheFile)) {
      return { lastUpdate: null, accounts: [] };
    }

    try {
      const data = fs.readFileSync(this.accountCacheFile, 'utf8');
      return JSON.parse(data) as AccountCache;
    } catch {
      return { lastUpdate: null, accounts: [] };
    }
  }

  private saveTransactionCache(cache: TransactionCache): void {
    this.ensureCacheDirectory();
    try {
      fs.writeFileSync(
        this.transactionCacheFile,
        JSON.stringify(cache, null, 2),
        { mode: SECURE_FILE_MODE }
      );
    } catch (error) {
      console.warn(`Warning: Could not save transaction cache: ${error}`);
    }
  }

  private saveAccountCache(cache: AccountCache): void {
    this.ensureCacheDirectory();
    try {
      fs.writeFileSync(
        this.accountCacheFile,
        JSON.stringify(cache, null, 2),
        { mode: SECURE_FILE_MODE }
      );
    } catch (error) {
      console.warn(`Warning: Could not save account cache: ${error}`);
    }
  }

  private buildTransactionKey(tx: EnrichedTransaction): string {
    const data = JSON.stringify({
      _id: tx._id,
      _account: tx._account,
      amount: tx.amount,
      date: tx.date,
      description: tx.description,
      updated_at: tx.updated_at,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private isCacheValid(lastUpdate: string | null, ttl: number): boolean {
    if (!lastUpdate) return false;
    const cacheAge = Date.now() - new Date(lastUpdate).getTime();
    return cacheAge < ttl;
  }

  /**
   * Check if transaction cache is valid for the given date range
   */
  isTransactionCacheValid(startDate: string, endDate: string): boolean {
    const cache = this.loadTransactionCache();
    if (!this.isCacheValid(cache.lastUpdate, TRANSACTION_CACHE_TTL)) {
      return false;
    }

    // Check if cached transactions cover the requested date range
    if (cache.transactions.length === 0) return false;

    const cachedDates = cache.transactions.map(tx => new Date(tx.date).getTime());
    const minCachedDate = Math.min(...cachedDates);
    const maxCachedDate = Math.max(...cachedDates);
    const requestedStart = new Date(startDate).getTime();
    const requestedEnd = new Date(endDate).getTime();

    // Cache is valid if it covers the requested range
    return minCachedDate <= requestedStart && maxCachedDate >= requestedEnd;
  }

  /**
   * Check if account cache is valid
   */
  isAccountCacheValid(): boolean {
    const cache = this.loadAccountCache();
    return this.isCacheValid(cache.lastUpdate, ACCOUNT_CACHE_TTL) && cache.accounts.length > 0;
  }

  /**
   * Get cached transactions filtered by date range
   */
  getCachedTransactions(startDate: string, endDate: string): EnrichedTransaction[] {
    const cache = this.loadTransactionCache();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return cache.transactions.filter(tx => {
      const txDate = new Date(tx.date).getTime();
      return txDate >= start && txDate <= end;
    });
  }

  /**
   * Get cached accounts
   */
  getCachedAccounts(): AccountSummary[] {
    const cache = this.loadAccountCache();
    return cache.accounts;
  }

  /**
   * Get cache metadata for display
   */
  getCacheInfo(): { transactions: { lastUpdate: string | null; count: number }; accounts: { lastUpdate: string | null; count: number } } {
    const txCache = this.loadTransactionCache();
    const accCache = this.loadAccountCache();
    return {
      transactions: { lastUpdate: txCache.lastUpdate, count: txCache.transactions.length },
      accounts: { lastUpdate: accCache.lastUpdate, count: accCache.accounts.length },
    };
  }

  /**
   * Get raw transaction cache data (legacy compatibility)
   */
  getCacheData(): TransactionCache {
    return this.loadTransactionCache();
  }

  /**
   * Update transaction cache with new transactions (merges with existing)
   */
  updateCache(newTransactions: EnrichedTransaction[]): void {
    if (!newTransactions.length) return;

    const cache = this.loadTransactionCache();
    const existingKeys = new Set(
      cache.transactions.map(tx => this.buildTransactionKey(tx))
    );

    // Add only new transactions
    const uniqueNew = newTransactions.filter(
      tx => !existingKeys.has(this.buildTransactionKey(tx))
    );

    if (uniqueNew.length > 0) {
      cache.transactions.push(...uniqueNew);
    }

    // Always update timestamp when cache is refreshed
    cache.lastUpdate = new Date().toISOString();
    this.saveTransactionCache(cache);
  }

  /**
   * Replace transaction cache entirely (for fresh fetches)
   */
  setTransactionCache(transactions: EnrichedTransaction[]): void {
    const cache: TransactionCache = {
      lastUpdate: new Date().toISOString(),
      transactions,
    };
    this.saveTransactionCache(cache);
  }

  /**
   * Update account cache
   */
  setAccountCache(accounts: Account[]): void {
    const summaries: AccountSummary[] = accounts.map(account => ({
      id: account._id,
      accountNumber: account.formatted_account ?? '',
      name: account.name,
      type: account.type,
      institution: account.connection.name,
      balance: account.balance?.current ?? 0,
      availableBalance: account.balance?.available ?? (account.balance?.current ?? 0),
    }));

    const cache: AccountCache = {
      lastUpdate: new Date().toISOString(),
      accounts: summaries,
    };
    this.saveAccountCache(cache);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    const emptyTxCache: TransactionCache = { lastUpdate: null, transactions: [] };
    const emptyAccCache: AccountCache = { lastUpdate: null, accounts: [] };
    this.saveTransactionCache(emptyTxCache);
    this.saveAccountCache(emptyAccCache);
  }

  /**
   * Clear only transaction cache
   */
  clearTransactionCache(): void {
    const emptyCache: TransactionCache = { lastUpdate: null, transactions: [] };
    this.saveTransactionCache(emptyCache);
  }

  /**
   * Clear only account cache
   */
  clearAccountCache(): void {
    const emptyCache: AccountCache = { lastUpdate: null, accounts: [] };
    this.saveAccountCache(emptyCache);
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Legacy compatibility functions
export function getCacheData() {
  return cacheService.getCacheData();
}

export function updateCache(newTransactions: EnrichedTransaction[]) {
  return cacheService.updateCache(newTransactions);
}
