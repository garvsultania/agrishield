import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mock axios before requiring the service
vi.mock('axios');
const axios = require('axios');

let fetchRainfall14d;

beforeEach(() => {
  delete require.cache[require.resolve('../services/openMeteoService')];
  delete require.cache[require.resolve('../services/cache')];
  ({ fetchRainfall14d } = require('../services/openMeteoService'));
  if (axios.get && typeof axios.get.mockReset === 'function') {
    axios.get.mockReset();
  } else {
    axios.get = vi.fn();
  }
});

describe('openMeteoService.fetchRainfall14d', () => {
  it('returns up to 14 { date, rainfall_mm } entries ordered ascending', async () => {
    axios.get = vi.fn().mockResolvedValue({
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
    axios.get = vi.fn().mockResolvedValue({
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

  it('propagates upstream errors', async () => {
    axios.get = vi.fn().mockRejectedValue(new Error('network unreachable'));
    await expect(fetchRainfall14d({ lat: 3, lng: 4 })).rejects.toThrow(/unreachable/);
  });
});
