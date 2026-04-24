'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { getFarmObservations } = require('../services/observationService');
const { evaluateDrought } = require('../services/oracleLogic');

const farmsDataPath = path.join(__dirname, '../../data/sitapur_farms.json');

function getFarmById(farmId) {
  const raw = fs.readFileSync(farmsDataPath, 'utf8');
  const farms = JSON.parse(raw);
  return farms.find((f) => f.farmId === farmId) || null;
}

/**
 * GET /api/farm/:farmId/status
 *
 * Pipeline:
 *   1. Observation service fetches 14 rolling days (rainfall: real via
 *      Open-Meteo when reachable, NDVI: mock rebased to today)
 *   2. Oracle logic evaluates drought against thresholds
 *   3. Response exposes `source`, `rainfall_source`, `ndvi_source` so the
 *      UI can be honest about per-field provenance
 */
router.get('/farm/:farmId/status', async (req, res) => {
  const { farmId } = req.params;

  const farm = getFarmById(farmId);
  if (!farm) {
    return res.status(404).json({
      success: false,
      data: null,
      error: `Farm not found: ${farmId}`,
    });
  }

  let observations;
  try {
    observations = await getFarmObservations(farmId, farm.coordinates);
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: `Failed to fetch observations: ${err.message}`,
    });
  }

  if (!observations || observations.length === 0) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'No observations returned from data source',
    });
  }

  const evaluation = evaluateDrought(observations);
  const latestObs = observations[observations.length - 1];
  const status = evaluation.triggered ? 'drought' : 'healthy';

  // Provenance summary: count real vs mock per signal
  const ndviRealCount = observations.filter((o) => o.ndvi_source === 'sentinel-2').length;
  const rainfallRealCount = observations.filter((o) => o.rainfall_source === 'open-meteo').length;

  return res.json({
    success: true,
    data: {
      farmId: farm.farmId,
      farmerName: farm.farmerName,
      cropType: farm.cropType,
      areaSqKm: farm.areaSqKm,
      coordinates: farm.coordinates,
      walletAddress: farm.walletAddress,
      ndvi: latestObs.ndvi,
      rainfall_mm: latestObs.rainfall_mm,
      status,
      evaluation,
      last_observation_date: latestObs.observation_date,
      source: latestObs.source,
      ndvi_source: latestObs.ndvi_source,
      rainfall_source: latestObs.rainfall_source,
      observations_count: observations.length,
      provenance: {
        ndvi_real_days: ndviRealCount,
        rainfall_real_days: rainfallRealCount,
        total_days: observations.length,
      },
      observations,
    },
    error: null,
  });
});

module.exports = router;
