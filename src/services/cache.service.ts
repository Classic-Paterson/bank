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
import { TransactionCache, AccountCache, AccountSummary, CachedDateRange } from '../types/index.js';

/**
 * Service for managing transaction and account caching with TTL support.
 * Uses in-memory caching to avoid repeated file I/O during a single CLI invocation.
 */
class CacheService {
  private cacheDir: string;
  private transactionCacheFile: string;
  private accountCacheFile: string;

  // In-memory cache to avoid repeated file reads within a single CLI invocation
  private transactionCacheMemory: TransactionCache | null = null;
  private accountCacheMemory: AccountCache | null = null;

  // Track last write failure for diagnostics
  private lastWriteError: string | null = null;

  /**
   * Tracks whether the cache file was corrupted or unreadable on load.
   * Commands can check this to warn users about potential issues.
   */
  public hadLoadError = false;
  private loadErrorMessage: string | null = null;

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
    // Return in-memory cache if available
    if (this.transactionCacheMemory !== null) {
      return this.transactionCacheMemory;
    }

    if (!fs.existsSync(this.transactionCacheFile)) {
      this.transactionCacheMemory = { lastUpdate: null, transactions: [], cachedRanges: [] };
      return this.transactionCacheMemory;
    }

    try {
      const data = fs.readFileSync(this.transactionCacheFile, 'utf8');
      const cache = JSON.parse(data) as TransactionCache;
      // Ensure cachedRanges exists for backward compatibility
      if (!cache.cachedRanges) {
        cache.cachedRanges = [];
      }
      this.transactionCacheMemory = cache;
      return cache;
    } catch (err) {
      // Cache file exists but is corrupted or unreadable
      this.hadLoadError = true;
      this.loadErrorMessage = err instanceof Error ? err.message : 'Unknown cache read error';
      this.transactionCacheMemory = { lastUpdate: null, transactions: [], cachedRanges: [] };
      return this.transactionCacheMemory;
    }
  }

  private loadAccountCache(): AccountCache {
    // Return in-memory cache if available
    if (this.accountCacheMemory !== null) {
      return this.accountCacheMemory;
    }

    if (!fs.existsSync(this.accountCacheFile)) {
      this.accountCacheMemory = { lastUpdate: null, accounts: [] };
      return this.accountCacheMemory;
    }

    try {
      const data = fs.readFileSync(this.accountCacheFile, 'utf8');
      this.accountCacheMemory = JSON.parse(data) as AccountCache;
      return this.accountCacheMemory;
    } catch (err) {
      // Cache file exists but is corrupted or unreadable
      this.hadLoadError = true;
      this.loadErrorMessage = err instanceof Error ? err.message : 'Unknown cache read error';
      this.accountCacheMemory = { lastUpdate: null, accounts: [] };
      return this.accountCacheMemory;
    }
  }

  private saveTransactionCache(cache: TransactionCache): boolean {
    this.ensureCacheDirectory();
    try {
      fs.writeFileSync(
        this.transactionCacheFile,
        JSON.stringify(cache, null, 2),
        { mode: SECURE_FILE_MODE }
      );
      // Update in-memory cache on successful write
      this.transactionCacheMemory = cache;
      this.lastWriteError = null;
      return true;
    } catch (err) {
      // Cache write failed - non-fatal, continue without caching
      this.lastWriteError = err instanceof Error ? err.message : 'Unknown cache write error';
      return false;
    }
  }

  private saveAccountCache(cache: AccountCache): boolean {
    this.ensureCacheDirectory();
    try {
      fs.writeFileSync(
        this.accountCacheFile,
        JSON.stringify(cache, null, 2),
        { mode: SECURE_FILE_MODE }
      );
      // Update in-memory cache on successful write
      this.accountCacheMemory = cache;
      this.lastWriteError = null;
      return true;
    } catch (err) {
      // Cache write failed - non-fatal, continue without caching
      this.lastWriteError = err instanceof Error ? err.message : 'Unknown cache write error';
      return false;
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
   * Check if a date range is fully covered by cached ranges
   */
  private isRangeCovered(requestedStart: string, requestedEnd: string, cachedRanges: CachedDateRange[]): boolean {
    if (!cachedRanges.length) return false;

    const reqStart = new Date(requestedStart).getTime();
    const reqEnd = new Date(requestedEnd).getTime();

    // Pre-parse all dates once to avoid repeated parsing in loops
    const parsedRanges = cachedRanges.map(range => ({
      start: new Date(range.start).getTime(),
      end: new Date(range.end).getTime(),
    }));

    // Sort ranges by start date
    parsedRanges.sort((a, b) => a.start - b.start);

    // Check if any single range covers the request (most common case)
    for (const range of parsedRanges) {
      if (range.start <= reqStart && range.end >= reqEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Merge overlapping or adjacent date ranges into a minimal set.
   * This keeps cache metadata efficient by consolidating ranges.
   */
  private mergeDateRanges(ranges: CachedDateRange[]): CachedDateRange[] {
    if (ranges.length <= 1) return ranges;

    // Pre-parse all dates once to avoid repeated parsing in loops
    const parsedRanges = ranges.map(range => ({
      start: range.start,
      end: range.end,
      startMs: new Date(range.start).getTime(),
      endMs: new Date(range.end).getTime(),
    }));

    // Sort by start date
    parsedRanges.sort((a, b) => a.startMs - b.startMs);

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const merged: CachedDateRange[] = [];
    let current = { ...parsedRanges[0] };

    for (let i = 1; i < parsedRanges.length; i++) {
      const next = parsedRanges[i];

      // Allow 1 day gap for adjacent ranges (e.g., Jan 1-15 and Jan 16-31)
      if (next.startMs <= current.endMs + ONE_DAY_MS) {
        // Ranges overlap or are adjacent - extend current range
        if (next.endMs > current.endMs) {
          current.end = next.end;
          current.endMs = next.endMs;
        }
      } else {
        // Gap between ranges - save current and start new
        merged.push({ start: current.start, end: current.end });
        current = { ...next };
      }
    }
    merged.push({ start: current.start, end: current.end });

    return merged;
  }

  /**
   * Check if transaction cache is valid for the given date range.
   * Returns true only if the requested range has been fully fetched and cached.
   */
  isTransactionCacheValid(startDate: string, endDate: string): boolean {
    const cache = this.loadTransactionCache();
    if (!this.isCacheValid(cache.lastUpdate, TRANSACTION_CACHE_TTL)) {
      return false;
    }

    // Check if the requested range is covered by cached ranges
    return this.isRangeCovered(startDate, endDate, cache.cachedRanges ?? []);
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
   * Get cached accounts as AccountSummary format
   */
  getCachedAccounts(): AccountSummary[] {
    const cache = this.loadAccountCache();
    return cache.accounts;
  }

  /**
   * Get cached accounts converted to Account-compatible format for API compatibility.
   * Use this when you need Account[] type but want to use cached data.
   */
  getCachedAccountsAsApiType(): Account[] {
    const cachedAccounts = this.getCachedAccounts();
    return cachedAccounts.map((acc: AccountSummary) => ({
      _id: acc.id ?? '',
      name: acc.name,
      formatted_account: acc.accountNumber,
      type: acc.type,
      connection: { name: acc.institution },
      balance: { current: acc.balance, available: acc.availableBalance },
    })) as unknown as Account[];
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
   * Get the last cache write error, if any.
   * Returns null if the last write was successful.
   */
  getLastWriteError(): string | null {
    return this.lastWriteError;
  }

  /**
   * Get the cache load error message, if any.
   * Returns null if cache loaded successfully.
   */
  getLoadErrorMessage(): string | null {
    return this.loadErrorMessage;
  }

  /**
   * Check if caching is currently working (last write succeeded).
   * This allows commands to warn users when cache writes are failing.
   */
  isCacheWritable(): boolean {
    return this.lastWriteError === null;
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
   * Update transaction cache with new transactions and date range.
   * Merges new data with existing cache, deduplicating transactions
   * and consolidating overlapping date ranges.
   * @param transactions The transactions to cache
   * @param startDate Optional start date of the fetched range (YYYY-MM-DD)
   * @param endDate Optional end date of the fetched range (YYYY-MM-DD)
   */
  setTransactionCache(transactions: EnrichedTransaction[], startDate?: string, endDate?: string): void {
    const existingCache = this.loadTransactionCache();

    // Build set of existing transaction keys for deduplication
    const existingKeys = new Set(
      existingCache.transactions.map(tx => this.buildTransactionKey(tx))
    );

    // Add only new transactions
    const newTransactions = transactions.filter(
      tx => !existingKeys.has(this.buildTransactionKey(tx))
    );
    const mergedTransactions = [...existingCache.transactions, ...newTransactions];

    // Merge date ranges
    let cachedRanges = existingCache.cachedRanges ?? [];
    if (startDate && endDate) {
      cachedRanges = this.mergeDateRanges([...cachedRanges, { start: startDate, end: endDate }]);
    }

    const cache: TransactionCache = {
      lastUpdate: new Date().toISOString(),
      transactions: mergedTransactions,
      cachedRanges,
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
    const emptyTxCache: TransactionCache = { lastUpdate: null, transactions: [], cachedRanges: [] };
    const emptyAccCache: AccountCache = { lastUpdate: null, accounts: [] };
    this.saveTransactionCache(emptyTxCache);
    this.saveAccountCache(emptyAccCache);
  }

  /**
   * Clear only transaction cache
   */
  clearTransactionCache(): void {
    const emptyCache: TransactionCache = { lastUpdate: null, transactions: [], cachedRanges: [] };
    this.saveTransactionCache(emptyCache);
  }

  /**
   * Clear only account cache
   */
  clearAccountCache(): void {
    const emptyCache: AccountCache = { lastUpdate: null, accounts: [] };
    this.saveAccountCache(emptyCache);
  }

  /**
   * Fetch accounts with automatic caching. Returns cached data if valid,
   * otherwise fetches from API and updates cache.
   * @param forceRefresh If true, bypass cache and fetch fresh data
   * @param cacheEnabled If false, skip caching entirely
   * @param fetchFn Function to fetch accounts from API
   * @returns Object containing accounts and whether they came from cache
   */
  async getAccountsWithCache(
    forceRefresh: boolean,
    cacheEnabled: boolean,
    fetchFn: () => Promise<Account[]>
  ): Promise<{ accounts: Account[]; fromCache: boolean; cacheAge: string | null }> {
    if (cacheEnabled && !forceRefresh && this.isAccountCacheValid()) {
      const cache = this.loadAccountCache();
      return { accounts: this.getCachedAccountsAsApiType(), fromCache: true, cacheAge: cache.lastUpdate };
    }

    const accounts = await fetchFn();
    if (cacheEnabled) {
      this.setAccountCache(accounts);
    }
    return { accounts, fromCache: false, cacheAge: null };
  }

  /**
   * Fetch transactions with automatic caching. Returns cached data if valid
   * for the specified date range, otherwise fetches from API and updates cache.
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @param forceRefresh If true, bypass cache and fetch fresh data
   * @param cacheEnabled If false, skip caching entirely
   * @param fetchFn Function to fetch transactions from API
   * @returns Object containing transactions and whether they came from cache
   */
  async getTransactionsWithCache(
    startDate: string,
    endDate: string,
    forceRefresh: boolean,
    cacheEnabled: boolean,
    fetchFn: () => Promise<EnrichedTransaction[]>
  ): Promise<{ transactions: EnrichedTransaction[]; fromCache: boolean; cacheAge: string | null }> {
    if (cacheEnabled && !forceRefresh && this.isTransactionCacheValid(startDate, endDate)) {
      const cache = this.loadTransactionCache();
      return { transactions: this.getCachedTransactions(startDate, endDate), fromCache: true, cacheAge: cache.lastUpdate };
    }

    const transactions = await fetchFn();
    if (cacheEnabled) {
      this.setTransactionCache(transactions, startDate, endDate);
    }
    return { transactions, fromCache: false, cacheAge: null };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
