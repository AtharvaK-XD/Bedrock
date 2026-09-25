interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
  staleTtlMs: number;
  isRevalidating?: boolean;
}

export class CacheService {
  private static store: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get value from cache with Stale-While-Revalidate (SWR) support
   */
  public static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 60000, // 1 minute fresh
    staleTtlMs: number = 300000 // 5 minutes stale tolerance
  ): Promise<{ data: T; isStale: boolean }> {
    const now = Date.now();
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    // Cache HIT & Fresh
    if (entry && now - entry.timestamp < entry.ttlMs) {
      return { data: entry.data, isStale: false };
    }

    // Cache HIT & Stale (serve stale immediately, revalidate asynchronously)
    if (entry && now - entry.timestamp < entry.staleTtlMs) {
      if (!entry.isRevalidating) {
        entry.isRevalidating = true;
        // Asynchronous background refresh
        fetcher()
          .then((newData) => {
            this.set(key, newData, ttlMs, staleTtlMs);
          })
          .catch((err) => {
            console.warn(`[CacheService] SWR background revalidation failed for ${key}:`, err.message);
          })
          .finally(() => {
            entry.isRevalidating = false;
          });
      }
      return { data: entry.data, isStale: true };
    }

    // Cache MISS: Fetch synchronously and set
    const freshData = await fetcher();
    this.set(key, freshData, ttlMs, staleTtlMs);
    return { data: freshData, isStale: false };
  }

  public static set<T>(key: string, data: T, ttlMs = 60000, staleTtlMs = 300000): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
      staleTtlMs,
    });
  }

  public static delete(key: string): void {
    this.store.delete(key);
  }

  public static clear(): void {
    this.store.clear();
  }

  public static size(): number {
    return this.store.size;
  }
}
