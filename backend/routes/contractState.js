'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { isPaid, isPaidBatch, getRecentEvents } = require('../services/sorobanReadService');

const farmsDataPath = path.join(__dirname, '../../data/sitapur_farms.json');

function allFarmIds() {
  const raw = fs.readFileSync(farmsDataPath, 'utf8');
  return JSON.parse(raw).map((f) => f.farmId);
}

/**
 * GET /api/contract/is-paid/:farmId
 *   → { success, data: { farmId, isPaid }, error }
 *
 * Read-only simulation against the parametric_trigger contract. Ground-
 * truth for the UI's "Paid/Armed" state; no dependence on localStorage.
 */
router.get('/contract/is-paid/:farmId', async (req, res) => {
  try {
    const paid = await isPaid(req.params.farmId);
    res.json({ success: true, data: { farmId: req.params.farmId, isPaid: paid }, error: null });
  } catch (err) {
    res.status(502).json({ success: false, data: null, error: err.message });
  }
});

/**
 * GET /api/contract/is-paid
 *   → { success, data: { [farmId]: boolean|null }, error }
 */
router.get('/contract/is-paid', async (_req, res) => {
  try {
    const ids = allFarmIds();
    const result = await isPaidBatch(ids);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    res.status(502).json({ success: false, data: null, error: err.message });
  }
});

/**
 * GET /api/contract/events?limit=200
 *   → { success, data: Event[], error }
 *
 * Returns the most recent INIT/PAYOUT/PROOF events emitted by the contract
 * within the RPC node's retention window (typically 24h).
 */
router.get('/contract/events', async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 200));
  try {
    const events = await getRecentEvents({ limit });
    res.json({ success: true, data: events, error: null });
  } catch (err) {
    res.status(502).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
