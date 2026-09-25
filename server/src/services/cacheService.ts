import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
  staleTtlMs: number;
  isRevalidating?: boolean;
}

export class CacheService {
  private static store: Map<string, CacheEntry<any>> = new Map();
  private static tokenBlacklist: Map<string, number> = new Map(); // token -> expiryMs
  private static MAX_CACHE_ENTRIES = 3000;

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
            console.warn(`[CacheService] SWR background revalidation failed for ${key}:`, err?.message || err);
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
    // Evict oldest if capacity exceeded
    if (this.store.size >= this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
      staleTtlMs,
    });
  }

  public static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
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

  // =========================================================================
  // Token Blacklist for Instant Session Revocation
  // =========================================================================

  public static blacklistToken(token: string, expiryMs: number): void {
    this.tokenBlacklist.set(token, expiryMs);
    // Prune expired tokens if blacklist gets large
    if (this.tokenBlacklist.size > 5000) {
      const now = Date.now();
      for (const [t, exp] of this.tokenBlacklist.entries()) {
        if (now >= exp) this.tokenBlacklist.delete(t);
      }
    }
  }

  public static isTokenBlacklisted(token: string): boolean {
    const expiry = this.tokenBlacklist.get(token);
    if (!expiry) return false;
    if (Date.now() >= expiry) {
      this.tokenBlacklist.delete(token);
      return false;
    }
    return true;
  }

  // =========================================================================
  // Semantic Prompt Exact Key Generator
  // =========================================================================

  public static generatePromptHash(model: string, promptText: string, options?: Record<string, any>): string {
    const payload = `${model}::${promptText}::${JSON.stringify(options || {})}`;
    return `prompt_cache_${crypto.createHash('sha256').update(payload).digest('hex')}`;
  }
}
