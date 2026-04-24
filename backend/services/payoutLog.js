'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const LOG_PATH = path.join(__dirname, '../../data/payouts.log.jsonl');
const TMP_PATH = `${LOG_PATH}.tmp`;

/**
 * Append-only JSON-lines payout log. Durable across restarts, readable by
 * ops (tail, jq), no database needed.
 *
 * Entry shape:
 *   { id, farmId, farmerName, txHash, method, proofHash, recipient,
 *     triggeredAt (ISO), explorerUrl }
 */

function rowId(farmId, txHash) {
  return `${farmId}-${txHash}`;
}

async function ensureFile() {
  try {
    await fsp.access(LOG_PATH);
  } catch {
    await fsp.writeFile(LOG_PATH, '', 'utf8');
  }
}

async function append(entry) {
  await ensureFile();
  const line = JSON.stringify(entry) + '\n';
  await fsp.appendFile(LOG_PATH, line, 'utf8');
  return entry;
}

async function readAll() {
  try {
    const raw = await fsp.readFile(LOG_PATH, 'utf8');
    if (!raw.trim()) return [];
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * De-duplicated recent payouts, newest-first. Optional farmId filter.
 */
async function recent({ farmId, limit = 100 } = {}) {
  const all = await readAll();
  const seen = new Set();
  const out = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const e = all[i];
    if (!e || !e.txHash || !e.farmId) continue;
    if (farmId && e.farmId !== farmId) continue;
    const key = rowId(e.farmId, e.txHash);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

async function logPayout(result) {
  const entry = {
    id: rowId(result.farmId, result.txHash),
    farmId: result.farmId,
    farmerName: result.farmerName,
    recipient: result.recipientAddress,
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    method: result.method,
    proofHash: result.proofHash,
    triggeredAt: new Date().toISOString(),
  };
  await append(entry);
  return entry;
}

module.exports = { logPayout, recent, readAll, LOG_PATH };
