'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const { getFarmObservations } = require('../services/observationService');

const farmsDataPath = path.join(__dirname, '../../data/sitapur_farms.json');
const EVENTS_ARCHIVE_PATH = path.join(__dirname, '../../data/contract-events.log.jsonl');

function getFarmById(farmId) {
  const raw = fs.readFileSync(farmsDataPath, 'utf8');
  return JSON.parse(raw).find((f) => f.farmId === farmId) || null;
}

/**
 * GET /api/farm/:farmId/history?days=14
 *   → { success, data: { farmId, observations: DailyObservation[], provenance }, error }
 *
 * Raw daily observations for a farm over the last `days`, capped at
 * OBSERVATION_WINDOW_DAYS on the backend (14). Identical shape to the
 * observations[] already embedded in /status but separately callable by
 * clients that only want the time-series (dashboards, data-export flows).
 */
router.get('/farm/:farmId/history', async (req, res) => {
  const { farmId } = req.params;
  const requestedDays = Number.parseInt(req.query.days, 10);
  const days = Number.isFinite(requestedDays) ? Math.min(14, Math.max(1, requestedDays)) : 14;

  const farm = getFarmById(farmId);
  if (!farm) {
    return res.status(404).json({ success: false, data: null, error: `Farm not found: ${farmId}` });
  }

  try {
    const all = await getFarmObservations(farmId, farm.coordinates);
    const observations = all.slice(-days);
    const ndviRealCount = observations.filter(
      (o) => o.ndvi_source === 'sentinel-2' || o.ndvi_source === 'sentinel-2-interp'
    ).length;
    const rainRealCount = observations.filter((o) => o.rainfall_source === 'open-meteo').length;
    res.json({
      success: true,
      data: {
        farmId,
        observations,
        provenance: {
          ndvi_real_days: ndviRealCount,
          rainfall_real_days: rainRealCount,
          total_days: observations.length,
        },
      },
      error: null,
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

/**
 * GET /api/contract/events/archive?limit=100
 *   → { success, data: ArchivedEvent[], error }
 *
 * On-disk archive of contract events collected by the scheduler (soroban
 * RPC only retains ~24h). Useful for long-term activity views on the UI.
 */
router.get('/contract/events/archive', async (req, res) => {
  const limit = Math.min(1000, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
  try {
    const raw = await fsp.readFile(EVENTS_ARCHIVE_PATH, 'utf8').catch((err) => {
      if (err.code === 'ENOENT') return '';
      throw err;
    });
    const rows = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
    // newest-first, cap at limit
    rows.sort((a, b) => (a.ledger < b.ledger ? 1 : -1));
    res.json({ success: true, data: rows.slice(0, limit), error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
