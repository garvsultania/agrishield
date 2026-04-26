import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const axios = require('axios');

let fetchRainfall14d;
let fakeGet;
let createSpy;

beforeEach(() => {
  fakeGet = vi.fn();
  const fakeInstance = {
    get: fakeGet,
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  // Spy BEFORE requiring the service so its axios.create() returns our fake
  createSpy = vi.spyOn(axios, 'create').mockReturnValue(fakeInstance);

  delete require.cache[require.resolve('../services/openMeteoService')];
  delete require.cache[require.resolve('../services/cache')];
  delete require.cache[require.resolve('../services/resilient')];
  delete require.cache[require.resolve('../services/logger')];
  ({ fetchRainfall14d } = require('../services/openMeteoService'));
});

afterEach(() => {
  createSpy.mockRestore();
});

describe('openMeteoService.fetchRainfall14d', () => {
  it('returns up to 14 { date, rainfall_mm } entries ordered ascending', async () => {
    fakeGet.mockResolvedValueOnce({
      data: {
        daily: {
          time: Array.from({ length: 14 }, (_, i) => `2026-04-${String(i + 1).padStart(2, '0')}`),
          precipitation_sum: Array.from({ length: 14 }, (_, i) => i * 0.5),
        },
      },
    });
    const out = await fetchRainfall14d({ lat: 27.57, lng: 80.68 });
    expect(out).toHaveLength(14);
    expect(out[0]).toEqual({ date: '2026-04-01', rainfall_mm: 0 });
    expect(out[13].rainfall_mm).toBeCloseTo(6.5, 2);
  });

  it('coerces non-finite rainfall entries to 0', async () => {
    fakeGet.mockResolvedValueOnce({
      data: {
        daily: {
          time: ['2026-04-01', '2026-04-02', '2026-04-03'],
          precipitation_sum: [1.2, null, 'nope'],
        },
      },
    });
    const out = await fetchRainfall14d({ lat: 1, lng: 2 });
    expect(out).toHaveLength(3);
    expect(out[0].rainfall_mm).toBeCloseTo(1.2);
    expect(out[1].rainfall_mm).toBe(0);
    expect(out[2].rainfall_mm).toBe(0);
  });

  it('propagates upstream errors after retries exhaust', async () => {
    fakeGet.mockRejectedValue(new Error('network unreachable'));
    await expect(fetchRainfall14d({ lat: 3, lng: 4 })).rejects.toThrow();
  }, 30_000);
});
