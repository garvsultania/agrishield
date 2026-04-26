'use strict';

const path = require('path');
const fs = require('fs');
const { fetchRainfall14d } = require('./openMeteoService');
const { fetchNdviSeries } = require('./planetaryComputerService');
const log = require('./logger').child('observation');

const historicalDataPath = path.join(__dirname, '../../data/historical_ndvi.json');

function loadMockNdviSeries() {
  const raw = fs.readFileSync(historicalDataPath, 'utf8');
  return JSON.parse(raw);
}

function todayIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysIso(base, offset) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function buildRollingDates(count = 14) {
  const end = todayIso();
  return Array.from({ length: count }, (_, i) => addDaysIso(end, -(count - 1 - i)));
}

/**
 * Return an NDVI-per-day array aligned to `dates`, pulling from real
 * Sentinel-2 scenes when available. Between two real anchor points we
 * linearly interpolate and label the filled day as
 * `ndvi_source: 'sentinel-2-interp'`. Outside the first/last real anchor we
 * fall back to the mock value for that day.
 *
 *   D1 D2 D3 D4 D5 D6 D7 … D14
 *   .  🛰  .  .  .  🛰 .  …   →  mock | real | interp | interp | interp | real | mock | …
 *                                (trend is carried between real points)
 */
function alignNdviToDates({ dates, mockDaily, scenes }) {
  const realByDate = new Map();
  for (const scene of scenes) {
    if (scene?.date && typeof scene.ndvi === 'number') {
      realByDate.set(scene.date, scene);
    }
  }

  // Anchor indices — days for which we have a real Sentinel-2 value.
  const anchors = dates
    .map((d, i) => (realByDate.has(d) ? i : -1))
    .filter((i) => i >= 0);

  return dates.map((date, i) => {
    const realHit = realByDate.get(date);
    if (realHit) {
      return {
        date,
        ndvi: realHit.ndvi,
        source: 'sentinel-2',
        scene: { sceneId: realHit.sceneId, sceneDate: realHit.date, cloud: realHit.cloud },
      };
    }

    // Find surrounding anchors (one before, one after) if they exist.
    let before = -1;
    let after = -1;
    for (const a of anchors) {
      if (a < i) before = a;
      else if (a > i && after < 0) after = a;
    }

    if (before >= 0 && after >= 0) {
      const d0 = dates[before];
      const d1 = dates[after];
      const v0 = realByDate.get(d0).ndvi;
      const v1 = realByDate.get(d1).ndvi;
      const t = (i - before) / (after - before);
      const ndvi = Number((v0 + (v1 - v0) * t).toFixed(4));
      return {
        date,
        ndvi,
        source: 'sentinel-2-interp',
        scene: {
          sceneId: null,
          sceneDate: `${d0}..${d1}`,
          cloud: Math.max(realByDate.get(d0).cloud || 0, realByDate.get(d1).cloud || 0),
        },
      };
    }

    // Edge-carry: if we have a single nearby anchor within EDGE_DAYS, hold
    // its value rather than revert to mock. Still labeled interp because
    // the signal is Sentinel-2-derived.
    const EDGE_DAYS = 3;
    const nearestIdx = before >= 0 ? before : after;
    if (nearestIdx >= 0 && Math.abs(nearestIdx - i) <= EDGE_DAYS) {
      const anchor = realByDate.get(dates[nearestIdx]);
      return {
        date,
        ndvi: anchor.ndvi,
        source: 'sentinel-2-interp',
        scene: { sceneId: null, sceneDate: anchor.date, cloud: anchor.cloud ?? 0 },
      };
    }

    return { date, ndvi: mockDaily[i], source: 'mock', scene: null };
  });
}

/**
 * Compose a 14-day observation series for a farm.
 *
 *   rainfall_mm — REAL from Open-Meteo when reachable; falls back to mock.
 *   ndvi        — REAL from Microsoft Planetary Computer Sentinel-2 L2A on
 *                 days where a cloud-filtered scene exists, LINEARLY
 *                 INTERPOLATED on days between two real anchors, and mock
 *                 only outside the real-data envelope.
 *   source      — aggregate label: 'real' (both real), 'hybrid' (one real,
 *                 one mock), 'mock' (neither). Interpolated NDVI counts as
 *                 a real signal for aggregate labelling.
 *
 * Each observation carries per-signal provenance (ndvi_source,
 * rainfall_source) so the UI can render honest chips.
 */
async function getFarmObservations(farmId, coordinates) {
  const mockSeries = loadMockNdviSeries();
  const mockFarm = mockSeries.find((f) => f.farmId === farmId);
  if (!mockFarm) {
    throw new Error(`No observation data found for farmId: ${farmId}`);
  }

  const dates = buildRollingDates(mockFarm.observations.length);
  const todayBase = todayIso();

  const [rainfallOutcome, ndviSeriesOutcome] = await Promise.allSettled([
    fetchRainfall14d(coordinates),
    fetchNdviSeries({
      farmId,
      coordinates,
      sinceIso: addDaysIso(todayBase, -30),
      untilIso: dates[dates.length - 1],
    }),
  ]);

  let rainfall;
  let rainSource = 'mock';
  if (
    rainfallOutcome.status === 'fulfilled' &&
    Array.isArray(rainfallOutcome.value) &&
    rainfallOutcome.value.length > 0
  ) {
    rainfall = rainfallOutcome.value;
    rainSource = 'open-meteo';
  } else {
    if (rainfallOutcome.status === 'rejected') {
      log.warn({ farmId, err: rainfallOutcome.reason?.message }, 'rainfall fell back to mock');
    }
    rainfall = mockFarm.observations.map((o, i) => ({ date: dates[i], rainfall_mm: o.rainfall_mm }));
  }

  const ndviScenes =
    ndviSeriesOutcome.status === 'fulfilled' && Array.isArray(ndviSeriesOutcome.value)
      ? ndviSeriesOutcome.value
      : [];
  if (ndviSeriesOutcome.status === 'rejected') {
    log.warn({ farmId, err: ndviSeriesOutcome.reason?.message }, 'NDVI fell back to mock');
  }

  const alignedNdvi = alignNdviToDates({
    dates,
    mockDaily: mockFarm.observations.map((o) => o.ndvi),
    scenes: ndviScenes,
  });

  const observations = mockFarm.observations.map((o, i) => {
    const rain = rainfall[i] ?? rainfall[rainfall.length - 1] ?? { rainfall_mm: 0 };
    const ndviPoint = alignedNdvi[i];

    const ndviIsReal = ndviPoint.source !== 'mock';
    const rainIsReal = rainSource === 'open-meteo';
    const realCount = Number(ndviIsReal) + Number(rainIsReal);
    const sourceLabel = realCount === 2 ? 'real' : realCount === 1 ? 'hybrid' : 'mock';

    return {
      farmId,
      coordinates,
      ndvi: ndviPoint.ndvi,
      rainfall_mm: rain.rainfall_mm,
      soil_moisture: o.soil_moisture,
      observation_date: dates[i],
      ndvi_source: ndviPoint.source,
      rainfall_source: rainSource,
      source: sourceLabel,
      ndvi_scene: ndviPoint.scene,
    };
  });

  return observations;
}

module.exports = {
  getFarmObservations,
  _internal: { findNearestScene: legacyFindNearestScene, buildRollingDates, alignNdviToDates },
};

/** Kept for backward compat with the existing test suite. */
function legacyFindNearestScene(series, targetDate, maxDays = 2) {
  if (!series || series.length === 0) return null;
  const target = Date.parse(`${targetDate}T00:00:00Z`);
  let best = null;
  let bestDistance = Infinity;
  for (const scene of series) {
    const t = Date.parse(`${scene.date}T00:00:00Z`);
    const distance = Math.abs(t - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = scene;
    }
  }
  if (!best) return null;
  const days = bestDistance / 86_400_000;
  return days <= maxDays ? best : null;
}
