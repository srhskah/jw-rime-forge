type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

/** Tiny in-memory TTL cache (per serverless instance). Cuts repeat Search API hits. */
export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  // Bound size
  if (store.size > 200) {
    const first = store.keys().next().value;
    if (first !== undefined) store.delete(first);
  }
}
