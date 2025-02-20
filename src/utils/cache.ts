import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { EnrichedTransaction } from "akahu";
import crypto from 'crypto';

const cacheDir = path.join(homedir(), '.bankcli');
const cacheFile = path.join(cacheDir, 'transaction_cache.json');

interface TransactionCache {
  lastUpdate: string | null;
  transactions: EnrichedTransaction[];
}

function loadCache(): TransactionCache {
  if (!fs.existsSync(cacheFile)) {
    return { lastUpdate: null, transactions: [] };
  }
  try {
    const data = fs.readFileSync(cacheFile, 'utf8');
    return JSON.parse(data) as TransactionCache;
  } catch {
    return { lastUpdate: null, transactions: [] };
  }
}

function saveCache(cache: TransactionCache) {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), { mode: 0o600 });
}

export function getCacheData() {
  return loadCache();
}

function buildTxKey(tx: EnrichedTransaction) {
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

export function updateCache(newTransactions: EnrichedTransaction[]) {
  const cache = loadCache();
  const allTransactions = [...cache.transactions, ...newTransactions];
  const uniqueTransactions = new Map<string, EnrichedTransaction>();

  for (const tx of allTransactions) {
    const key = buildTxKey(tx);
    uniqueTransactions.set(key, tx);
  }

  const mostRecent = newTransactions.reduce((acc, tx) => {
    const txDate = new Date(tx.date).getTime();
    return txDate > acc ? txDate : acc;
  }, 0);

  const updatedCache: TransactionCache = {
    lastUpdate: mostRecent ? new Date(mostRecent).toISOString() : cache.lastUpdate,
    transactions: Array.from(uniqueTransactions.values()),
  };

  saveCache(updatedCache);
}
