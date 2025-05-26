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
 * Service for managing merchant categorization mappings
 */
class MerchantMappingService {
  private configDir: string;
  private mapFile: string;

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

  loadMerchantMap(): MerchantMap {
    this.ensureDirectory();
    if (!fs.existsSync(this.mapFile)) {
      return {};
    }

    try {
      const data = fs.readFileSync(this.mapFile, 'utf8');
      return JSON.parse(data) as MerchantMap;
    } catch (error) {
      console.warn('Warning: Could not parse merchant map file. Starting fresh.');
      return {};
    }
  }

  saveMerchantMap(map: MerchantMap): void {
    this.ensureDirectory();
    try {
      fs.writeFileSync(
        this.mapFile,
        JSON.stringify(map, null, 2),
        { mode: SECURE_FILE_MODE }
      );
    } catch (error) {
      console.warn(`Warning: Could not save merchant map: ${error}`);
    }
  }

  upsertMerchantCategory(key: string, category: MerchantCategory): void {
    const map = this.loadMerchantMap();
    map[key] = category;
    this.saveMerchantMap(map);
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
}

// Export singleton instance
export const merchantMappingService = new MerchantMappingService();

// Legacy compatibility functions
export function loadMerchantMap() {
  return merchantMappingService.loadMerchantMap();
}

export function saveMerchantMap(map: MerchantMap) {
  return merchantMappingService.saveMerchantMap(map);
}

export function upsertMerchantCategory(key: string, category: MerchantCategory) {
  return merchantMappingService.upsertMerchantCategory(key, category);
}
