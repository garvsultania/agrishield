'use strict';

/**
 * Minimal in-memory TTL cache. Single-instance, not shared across processes.
 * Good for short-lived upstream response caching (weather APIs, RPC reads).
 */
class TtlCache {
  constructor({ defaultTtlMs = 60_000, maxEntries = 500 } = {}) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  _evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxEntries) this._evictExpired();
    if (this.store.size >= this.maxEntries) {
      // LRU-lite: drop the oldest insertion
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async wrap(key, ttlMs, producer) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await producer();
    if (value !== undefined) this.set(key, value, ttlMs);
    return value;
  }

  clear() {
    this.store.clear();
  }
}

module.exports = { TtlCache };
