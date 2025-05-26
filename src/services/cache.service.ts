import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EnrichedTransaction } from 'akahu';
import {
  CONFIG_DIR_NAME,
  CACHE_FILE_NAME,
  SECURE_FILE_MODE,
} from '../constants/index.js';
import { TransactionCache } from '../types/index.js';

/**
 * Service for managing transaction cache
 */
class CacheService {
  private cacheDir: string;
  private cacheFile: string;

  constructor() {
    this.cacheDir = path.join(homedir(), CONFIG_DIR_NAME);
    this.cacheFile = path.join(this.cacheDir, CACHE_FILE_NAME);
    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private loadCache(): TransactionCache {
    if (!fs.existsSync(this.cacheFile)) {
      return { lastUpdate: null, transactions: [] };
    }

    try {
      const data = fs.readFileSync(this.cacheFile, 'utf8');
      return JSON.parse(data) as TransactionCache;
    } catch (error) {
      console.warn('Warning: Could not parse cache file. Starting fresh.');
      return { lastUpdate: null, transactions: [] };
    }
  }

  private saveCache(cache: TransactionCache): void {
    this.ensureCacheDirectory();
    try {
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify(cache, null, 2),
        { mode: SECURE_FILE_MODE }
      );
    } catch (error) {
      console.warn(`Warning: Could not save cache: ${error}`);
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

  getCacheData(): TransactionCache {
    return this.loadCache();
  }

  updateCache(newTransactions: EnrichedTransaction[]): void {
    if (!newTransactions.length) return;

    const cache = this.loadCache();
    const existingKeys = new Set(
      cache.transactions.map(tx => this.buildTransactionKey(tx))
    );

    // Add only new transactions
    const uniqueNew = newTransactions.filter(
      tx => !existingKeys.has(this.buildTransactionKey(tx))
    );

    if (uniqueNew.length > 0) {
      cache.transactions.push(...uniqueNew);
      cache.lastUpdate = new Date().toISOString();
      this.saveCache(cache);
    }
  }

  clearCache(): void {
    const emptyCache: TransactionCache = { lastUpdate: null, transactions: [] };
    this.saveCache(emptyCache);
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
