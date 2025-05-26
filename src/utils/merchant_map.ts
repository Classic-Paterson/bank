import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

/*
 * Simple persistent merchant → category map.  Format:
 * {
 *   "merchant_key": {
 *      "parent": "food",
 *      "category": "groceries"
 *   }
 * }
 */

const dir = path.join(homedir(), '.bankcli');
const file = path.join(dir, 'merchant_map.json');

export interface MerchantCategory {
  parent: string;
  category: string;
}

export type MerchantMap = Record<string, MerchantCategory>;

function ensureDir() {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}

export function loadMerchantMap(): MerchantMap {
  ensureDir();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as MerchantMap;
  } catch {
    return {};
  }
}

export function saveMerchantMap(map: MerchantMap) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(map, null, 2), { mode: 0o600 });
}

export function upsertMerchantCategory(key: string, cat: MerchantCategory) {
  const map = loadMerchantMap();
  map[key] = cat;
  saveMerchantMap(map);
}
