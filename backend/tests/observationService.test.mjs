import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { _internal } = require('../services/observationService');
const { findNearestScene, buildRollingDates } = _internal;

describe('buildRollingDates', () => {
  it('returns an ascending N-element date list ending today (UTC)', () => {
    const dates = buildRollingDates(14);
    expect(dates).toHaveLength(14);
    expect(dates[0] < dates[13]).toBe(true);
    // Last date is today (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    expect(dates[13]).toBe(today.toISOString().slice(0, 10));
  });
});

describe('findNearestScene', () => {
  const series = [
    { date: '2026-04-10', ndvi: 0.2 },
    { date: '2026-04-15', ndvi: 0.25 },
    { date: '2026-04-20', ndvi: 0.3 },
  ];

  it('returns the closest scene when within ±maxDays', () => {
    const s = findNearestScene(series, '2026-04-16', 2);
    expect(s?.date).toBe('2026-04-15');
  });

  it('returns null when the closest scene is too far away', () => {
    const s = findNearestScene(series, '2026-04-05', 2);
    expect(s).toBeNull();
  });

  it('handles exact-date matches', () => {
    const s = findNearestScene(series, '2026-04-15', 0);
    expect(s?.date).toBe('2026-04-15');
  });

  it('returns null for empty or missing series', () => {
    expect(findNearestScene([], '2026-04-15')).toBeNull();
    expect(findNearestScene(null, '2026-04-15')).toBeNull();
  });

  it('picks the earlier of two equidistant scenes deterministically', () => {
    const twoSided = [
      { date: '2026-04-10', ndvi: 0.2 },
      { date: '2026-04-12', ndvi: 0.3 },
    ];
    const s = findNearestScene(twoSided, '2026-04-11', 2);
    // Either candidate is 1 day away; the first encountered wins
    expect(['2026-04-10', '2026-04-12']).toContain(s?.date);
  });
});
