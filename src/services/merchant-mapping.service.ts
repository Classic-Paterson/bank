import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_DIR_NAME,
  MERCHANT_MAP_FILE_NAME,
  SECURE_FILE_MODE,
} from '../constants/index.js';
import { MerchantCategory, MerchantMap } from '../types/index.js';

/**
 * Service for managing merchant categorization mappings.
 * Uses in-memory caching to reduce file I/O during batch operations
 * (e.g., processing many transactions in the categorise command).
 */
class MerchantMappingService {
  private configDir: string;
  private mapFile: string;
  /** In-memory cache of the merchant map, loaded on first access */
  private cache: MerchantMap | null = null;

  constructor() {
    this.configDir = path.join(homedir(), CONFIG_DIR_NAME);
    this.mapFile = path.join(this.configDir, MERCHANT_MAP_FILE_NAME);
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * Load the merchant map, using in-memory cache if available.
   * Call invalidateCache() if you need to force a reload from disk.
   */
  loadMerchantMap(): MerchantMap {
    if (this.cache !== null) {
      return this.cache;
    }

    this.ensureDirectory();
    if (!fs.existsSync(this.mapFile)) {
      this.cache = {};
      return this.cache;
    }

    try {
      const data = fs.readFileSync(this.mapFile, 'utf8');
      this.cache = JSON.parse(data) as MerchantMap;
      return this.cache;
    } catch {
      // File corrupted or unreadable - start fresh silently
      this.cache = {};
      return this.cache;
    }
  }

  saveMerchantMap(map: MerchantMap): boolean {
    this.ensureDirectory();
    try {
      fs.writeFileSync(
        this.mapFile,
        JSON.stringify(map, null, 2),
        { mode: SECURE_FILE_MODE }
      );
      // Update cache on successful write
      this.cache = map;
      return true;
    } catch {
      // Write failed - caller can check return value if needed
      return false;
    }
  }

  upsertMerchantCategory(key: string, category: MerchantCategory): boolean {
    const map = this.loadMerchantMap();
    map[key] = category;
    return this.saveMerchantMap(map);
  }

  getMerchantCategory(key: string): MerchantCategory | undefined {
    const map = this.loadMerchantMap();
    return map[key];
  }

  hasMerchantMapping(key: string): boolean {
    const map = this.loadMerchantMap();
    return key in map;
  }

  getAllMappings(): MerchantMap {
    return this.loadMerchantMap();
  }

  clearAllMappings(): void {
    this.saveMerchantMap({});
  }

  /**
   * Invalidate the in-memory cache, forcing the next read to load from disk.
   * Useful if external processes may have modified the file.
   */
  invalidateCache(): void {
    this.cache = null;
  }
}

// Export singleton instance
export const merchantMappingService = new MerchantMappingService();
