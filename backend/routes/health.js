'use strict';

const express = require('express');
const router = express.Router();
const { snapshot } = require('../services/systemHealthService');

/**
 * GET /api/health/system
 *   → { success, data: { ok, horizon, sorobanRpc, admin, contract, checkedAt }, error }
 *
 * Aggregated liveness probe. Result is cached for 10s to keep a polling
 * header badge from hammering Horizon / Soroban RPC.
 */
router.get('/health/system', async (_req, res) => {
  try {
    const snap = await snapshot();
    res.json({ success: true, data: snap, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
