import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mpc = require('../services/planetaryComputerService');
const { bboxToPixelWindow, padBbox, registerUtmProjection } = mpc._internal;

describe('padBbox', () => {
  it('returns a 4-element [minLng, minLat, maxLng, maxLat] bbox centered on input', () => {
    const bbox = padBbox({ lat: 27.57, lng: 80.68 }, 0.005);
    expect(bbox).toHaveLength(4);
    expect(bbox[0]).toBeCloseTo(80.675, 3);
    expect(bbox[1]).toBeCloseTo(27.565, 3);
    expect(bbox[2]).toBeCloseTo(80.685, 3);
    expect(bbox[3]).toBeCloseTo(27.575, 3);
  });
});

describe('registerUtmProjection', () => {
  it('accepts UTM North EPSG codes and returns the proj key', () => {
    expect(registerUtmProjection(32644)).toBe('EPSG:32644');
  });

  it('accepts UTM South EPSG codes', () => {
    expect(registerUtmProjection(32744)).toBe('EPSG:32744');
  });

  it('rejects non-UTM codes', () => {
    expect(() => registerUtmProjection(4326)).toThrow(/Unsupported projection/);
    expect(() => registerUtmProjection('abc')).toThrow(/Invalid/);
  });
});

describe('bboxToPixelWindow', () => {
  // Typical Sentinel-2 L2A transform: 10m resolution, UTM 44N origin somewhere
  // near (700000, 3050000). Use a deterministic synthetic scene.
  const transform = [10, 0, 700000, 0, -10, 3150000];
  const epsg = 32644;

  it('returns a valid [xmin, ymin, xmax, ymax] pixel window with xmax > xmin, ymax > ymin', () => {
    const bbox = padBbox({ lat: 27.57, lng: 80.68 }, 0.01);
    const win = bboxToPixelWindow(bbox, epsg, transform);
    expect(win).toHaveLength(4);
    expect(win[2]).toBeGreaterThan(win[0]);
    expect(win[3]).toBeGreaterThan(win[1]);
    expect(Number.isFinite(win[0]) && Number.isFinite(win[3])).toBe(true);
  });

  it('always clamps to non-negative pixel coordinates', () => {
    const bbox = [-0.5, -0.5, 0.5, 0.5]; // far outside the UTM 44N scene
    const win = bboxToPixelWindow(bbox, epsg, transform);
    expect(win[0]).toBeGreaterThanOrEqual(0);
    expect(win[1]).toBeGreaterThanOrEqual(0);
  });

  it('bigger bbox yields a larger pixel window', () => {
    const tiny = bboxToPixelWindow(padBbox({ lat: 27.57, lng: 80.68 }, 0.001), epsg, transform);
    const wide = bboxToPixelWindow(padBbox({ lat: 27.57, lng: 80.68 }, 0.01), epsg, transform);
    const tinyArea = (tiny[2] - tiny[0]) * (tiny[3] - tiny[1]);
    const wideArea = (wide[2] - wide[0]) * (wide[3] - wide[1]);
    expect(wideArea).toBeGreaterThan(tinyArea);
  });
});
