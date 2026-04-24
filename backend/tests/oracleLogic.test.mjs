import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { evaluateDrought, NDVI_THRESHOLD, RAINFALL_THRESHOLD_MM } = require('../services/oracleLogic');

function makeObs({ ndvi, rain, day = 1 }) {
  const date = new Date(Date.UTC(2026, 3, day));
  return {
    farmId: 'TEST',
    coordinates: { lat: 0, lng: 0 },
    ndvi,
    rainfall_mm: rain,
    observation_date: date.toISOString().slice(0, 10),
    source: 'test',
  };
}

function makeWindow(count, ndvi, rain) {
  return Array.from({ length: count }, (_, i) => makeObs({ ndvi, rain, day: i + 1 }));
}

describe('evaluateDrought', () => {
  it('returns low-confidence no-trigger for an empty window', () => {
    const out = evaluateDrought([]);
    expect(out.triggered).toBe(false);
    expect(out.confidence).toBe('low');
  });

  it('triggers with high confidence when both metrics are well below threshold every day', () => {
    const obs = makeWindow(14, 0.2, 2);
    const out = evaluateDrought(obs);
    expect(out.triggered).toBe(true);
    expect(out.confidence).toBe('high');
    expect(out.proof_of_loss.avg_ndvi).toBeLessThan(NDVI_THRESHOLD);
    expect(out.proof_of_loss.avg_rainfall_mm).toBeLessThan(RAINFALL_THRESHOLD_MM);
  });

  it('does not trigger if a single day exceeds the NDVI threshold', () => {
    const obs = makeWindow(14, 0.2, 2);
    obs[5] = makeObs({ ndvi: 0.5, rain: 2, day: 6 });
    const out = evaluateDrought(obs);
    expect(out.triggered).toBe(false);
  });

  it('does not trigger if a single day has rainfall above the threshold', () => {
    const obs = makeWindow(14, 0.2, 2);
    obs[10] = makeObs({ ndvi: 0.2, rain: 50, day: 11 });
    const out = evaluateDrought(obs);
    expect(out.triggered).toBe(false);
  });

  it('medium confidence when both metrics breach but only marginally', () => {
    const obs = makeWindow(14, 0.34, 9.5);
    const out = evaluateDrought(obs);
    expect(out.triggered).toBe(true);
    expect(out.confidence).toBe('medium');
  });
});
