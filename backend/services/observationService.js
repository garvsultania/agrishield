'use strict';

const path = require('path');
const fs = require('fs');
const { fetchRainfall14d } = require('./openMeteoService');
const { fetchNdviSeries } = require('./planetaryComputerService');

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
 * Pick the Sentinel-2 NDVI scene closest in time to `targetDate`, within
 * `maxDays`. Returns null if no scene is close enough.
 */
function findNearestScene(series, targetDate, maxDays = 2) {
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

/**
 * Compose a 14-day observation series for a farm.
 *
 *   rainfall_mm — REAL from Open-Meteo when reachable; falls back to mock.
 *   ndvi        — REAL from Microsoft Planetary Computer Sentinel-2 L2A when
 *                 a cloud-filtered scene exists within ±2 days of the
 *                 observation date; otherwise mock (dates rebased to today).
 *   source      — aggregate label: 'real' (both), 'hybrid' (one), or 'mock'.
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
      // Sentinel-2 revisit is ~5 days; widen the search window so we catch
      // at least one cloud-free scene per farm over the last month.
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
      console.warn(
        `[observationService] Open-Meteo failed for ${farmId}: ${rainfallOutcome.reason?.message || rainfallOutcome.reason}`
      );
    }
    rainfall = mockFarm.observations.map((o, i) => ({ date: dates[i], rainfall_mm: o.rainfall_mm }));
  }

  const ndviScenes =
    ndviSeriesOutcome.status === 'fulfilled' && Array.isArray(ndviSeriesOutcome.value)
      ? ndviSeriesOutcome.value
      : [];
  if (ndviSeriesOutcome.status === 'rejected') {
    console.warn(
      `[observationService] MPC NDVI failed for ${farmId}: ${ndviSeriesOutcome.reason?.message || ndviSeriesOutcome.reason}`
    );
  }

  const observations = mockFarm.observations.map((o, i) => {
    const rain = rainfall[i] ?? rainfall[rainfall.length - 1] ?? { rainfall_mm: 0 };

    const nearestScene = findNearestScene(ndviScenes, dates[i], 2);
    const ndviValue = nearestScene ? nearestScene.ndvi : o.ndvi;
    const ndviSource = nearestScene ? 'sentinel-2' : 'mock';

    const realCount =
      Number(ndviSource === 'sentinel-2') + Number(rainSource === 'open-meteo');
    const sourceLabel = realCount === 2 ? 'real' : realCount === 1 ? 'hybrid' : 'mock';

    return {
      farmId,
      coordinates,
      ndvi: ndviValue,
      rainfall_mm: rain.rainfall_mm,
      soil_moisture: o.soil_moisture,
      observation_date: dates[i],
      ndvi_source: ndviSource,
      rainfall_source: rainSource,
      source: sourceLabel,
      ndvi_scene: nearestScene
        ? { sceneId: nearestScene.sceneId, sceneDate: nearestScene.date, cloud: nearestScene.cloud }
        : null,
    };
  });

  return observations;
}

module.exports = { getFarmObservations, _internal: { findNearestScene, buildRollingDates } };
