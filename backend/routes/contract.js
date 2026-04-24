'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { evaluateDrought } = require('../services/oracleLogic');
const { triggerPayout, getTransactionStatus, generateProofHash } = require('../services/stellarService');
const { logPayout, recent: recentPayouts } = require('../services/payoutLog');
const { simulateLimiter } = require('../middleware/rateLimit');
const { requireAdminToken } = require('../middleware/auth');

const farmsDataPath = path.join(__dirname, '../../data/sitapur_farms.json');

function getFarmById(farmId) {
  const raw = fs.readFileSync(farmsDataPath, 'utf8');
  const farms = JSON.parse(raw);
  return farms.find((f) => f.farmId === farmId) || null;
}

function generateDroughtObservations(farmId, coordinates) {
  const observations = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const ndvi = parseFloat((0.18 + (i % 5) * 0.02).toFixed(3));
    const rainfall = parseFloat((1.5 + (i % 4) * 1.2).toFixed(1));
    observations.push({
      farmId,
      coordinates,
      ndvi,
      rainfall_mm: rainfall,
      observation_date: dateStr,
      source: 'simulated',
    });
  }
  return observations;
}

/**
 * POST /api/farm/:farmId/simulate
 *
 *   1. Synthesizes a guaranteed-drought observation window
 *   2. Evaluates via oracleLogic (always triggers)
 *   3. Calls Soroban trigger_payout (falls back to 1-XLM payment on error)
 *   4. Writes an entry to the server-side append-only payout log
 */
router.post('/farm/:farmId/simulate', requireAdminToken, simulateLimiter, async (req, res) => {
  const { farmId } = req.params;

  const farm = getFarmById(farmId);
  if (!farm) {
    return res.status(404).json({
      success: false,
      data: null,
      error: `Farm not found: ${farmId}`,
    });
  }

  const simulatedObservations = generateDroughtObservations(farmId, farm.coordinates);
  const evaluation = evaluateDrought(simulatedObservations);

  if (!evaluation.triggered) {
    return res.json({
      success: true,
      data: {
        triggered: false,
        txHash: null,
        explorerUrl: null,
        evaluation,
        farmId,
        farmerName: farm.farmerName,
        recipientAddress: farm.walletAddress,
        method: null,
      },
      error: null,
    });
  }

  const proofHash = generateProofHash(evaluation.proof_of_loss, farmId);

  let payoutResult;
  try {
    payoutResult = await triggerPayout(farmId, farm.walletAddress, proofHash);
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: {
        triggered: true,
        txHash: null,
        explorerUrl: null,
        evaluation,
        farmId,
        farmerName: farm.farmerName,
        recipientAddress: farm.walletAddress,
        method: null,
        proofHash,
      },
      error: `Drought confirmed but payout failed: ${err.message}`,
    });
  }

  // Server-side audit trail — never blocks the response
  logPayout({
    farmId,
    farmerName: farm.farmerName,
    recipientAddress: farm.walletAddress,
    txHash: payoutResult.txHash,
    explorerUrl: payoutResult.explorerUrl,
    method: payoutResult.method,
    proofHash,
  }).catch((err) => console.warn(`[contract.js] payoutLog failed: ${err.message}`));

  return res.json({
    success: true,
    data: {
      triggered: true,
      txHash: payoutResult.txHash,
      explorerUrl: payoutResult.explorerUrl,
      method: payoutResult.method,
      evaluation,
      farmId,
      farmerName: farm.farmerName,
      recipientAddress: farm.walletAddress,
      proofHash,
    },
    error: null,
  });
});

/**
 * GET /api/payouts?farmId=...&limit=100
 *   → { success, data: PayoutEntry[], error }
 *
 * Authoritative cross-device payout history from the server log.
 */
router.get('/payouts', async (req, res) => {
  const { farmId } = req.query;
  const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
  try {
    const entries = await recentPayouts({ farmId, limit });
    res.json({ success: true, data: entries, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

/**
 * GET /api/transaction/:txHash — thin wrapper over Horizon lookup.
 */
router.get('/transaction/:txHash', async (req, res) => {
  const { txHash } = req.params;

  if (!txHash || !/^[a-fA-F0-9]{64}$/.test(txHash)) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'Invalid transaction hash format. Expected 64-character hex string.',
    });
  }

  try {
    const txStatus = await getTransactionStatus(txHash);
    res.json({ success: true, data: txStatus, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
