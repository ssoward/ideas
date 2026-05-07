import type { BlockResult } from "../shared/types";
import { STORAGE_KEYS, CACHE_TTL_MS } from "../shared/constants";

export async function cacheGet(hash: string): Promise<BlockResult | null> {
  const key = STORAGE_KEYS.CACHE_PREFIX + hash;
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as BlockResult | undefined;
  if (!entry) return null;
  if (Date.now() - entry.analyzedAt > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry;
}

export async function cacheSet(hash: string, result: BlockResult): Promise<void> {
  const key = STORAGE_KEYS.CACHE_PREFIX + hash;
  await chrome.storage.local.set({ [key]: result });
}

export async function cacheClearExpired(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const expiredKeys: string[] = [];
  const now = Date.now();
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(STORAGE_KEYS.CACHE_PREFIX)) {
      const entry = value as BlockResult;
      if (now - entry.analyzedAt > CACHE_TTL_MS) expiredKeys.push(key);
    }
  }
  if (expiredKeys.length > 0) await chrome.storage.local.remove(expiredKeys);
}
