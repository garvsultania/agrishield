import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { TtlCache } = require('../services/cache');

describe('TtlCache', () => {
  it('stores and returns a value within TTL', () => {
    const cache = new TtlCache({ defaultTtlMs: 1_000 });
    cache.set('a', 42);
    expect(cache.get('a')).toBe(42);
  });

  it('returns undefined for an expired entry', () => {
    vi.useFakeTimers();
    try {
      const cache = new TtlCache({ defaultTtlMs: 100 });
      cache.set('a', 42);
      vi.advanceTimersByTime(200);
      expect(cache.get('a')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('wrap() caches the producer result and does not call it again within TTL', async () => {
    const cache = new TtlCache();
    const producer = vi.fn().mockResolvedValue({ hello: 'world' });
    const v1 = await cache.wrap('key', 5_000, producer);
    const v2 = await cache.wrap('key', 5_000, producer);
    expect(v1).toEqual({ hello: 'world' });
    expect(v2).toEqual({ hello: 'world' });
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest entry when maxEntries is exceeded', () => {
    const cache = new TtlCache({ defaultTtlMs: 60_000, maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('clear() empties every entry', () => {
    const cache = new TtlCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });
});
