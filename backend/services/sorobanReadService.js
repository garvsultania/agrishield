'use strict';

/**
 * Read-only reads against the deployed parametric_trigger Soroban contract.
 *
 *   is_paid(farmId)    — simulateTransaction on the contract's is_paid view
 *   getEvents()        — streams INIT / PAYOUT / PROOF events emitted by the
 *                        contract, parsed into plain JS shapes
 *
 * All calls are simulation-only — no signatures, no fees, no on-chain writes.
 */

const StellarSdk = require('@stellar/stellar-sdk');
const {
  rpc,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Networks,
  Keypair,
  BASE_FEE,
  Account,
} = StellarSdk;
const { TtlCache } = require('./cache');

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

const isPaidCache = new TtlCache({ defaultTtlMs: 30_000 });
const eventsCache = new TtlCache({ defaultTtlMs: 15_000 });

function getContractId() {
  return process.env.SOROBAN_CONTRACT_ID || null;
}

function getRpc() {
  return new rpc.Server(RPC_URL);
}

/**
 * Read-only simulation builder — uses a throwaway keypair because Soroban
 * requires a "source account" to simulate, even for read calls. The keypair
 * is never signed with, never submitted.
 */
async function simulateReadCall(fnName, ...args) {
  const contractId = getContractId();
  if (!contractId) throw new Error('SOROBAN_CONTRACT_ID is not set');

  const server = getRpc();
  const contract = new Contract(contractId);

  const dummyKp = Keypair.random();
  // Fetch or fake a source account for simulation. Horizon source account
  // is not strictly required for simulate, but the SDK expects an Account.
  let sourceAccount;
  try {
    sourceAccount = await server.getAccount(dummyKp.publicKey());
  } catch {
    // Account doesn't exist on chain — fine for simulation; invent one.
    sourceAccount = new Account(dummyKp.publicKey(), '0');
  }

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fnName, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if ('error' in sim && sim.error) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }
  const result = sim.result?.retval;
  if (!result) throw new Error('No retval in simulation result');
  return scValToNative(result);
}

/**
 * Returns true if trigger_payout has been called for this farm on-chain.
 */
async function isPaid(farmId) {
  return isPaidCache.wrap(`ispaid:${farmId}`, 30_000, async () => {
    const farmIdScVal = nativeToScVal(farmId, { type: 'symbol' });
    const result = await simulateReadCall('is_paid', farmIdScVal);
    return Boolean(result);
  });
}

/**
 * Batch is_paid across many farms, in parallel.
 */
async function isPaidBatch(farmIds) {
  const results = await Promise.allSettled(farmIds.map((id) => isPaid(id)));
  const out = {};
  farmIds.forEach((id, i) => {
    const r = results[i];
    out[id] = r.status === 'fulfilled' ? r.value : null;
  });
  return out;
}

/**
 * Events emitted by our contract, newest-first. Covers roughly the last
 * `lookbackLedgers` ledgers (~5s each, so 17_280 ≈ 24h).
 *
 * Shape returned:
 *   [{ id, type, ledger, closedAt, txHash, topics: string[], value, raw }]
 */
async function getRecentEvents({ lookbackLedgers = 17_280, limit = 200 } = {}) {
  return eventsCache.wrap(`events:${lookbackLedgers}:${limit}`, 15_000, async () => {
    const contractId = getContractId();
    if (!contractId) throw new Error('SOROBAN_CONTRACT_ID is not set');

    const server = getRpc();
    const latest = await server.getLatestLedger();
    const startLedger = Math.max(1, latest.sequence - lookbackLedgers);

    let cursor;
    const collected = [];
    for (let page = 0; page < 5 && collected.length < limit; page++) {
      const req = {
        filters: [{ type: 'contract', contractIds: [contractId] }],
        limit: Math.min(100, limit - collected.length),
      };
      if (cursor) {
        req.cursor = cursor;
      } else {
        req.startLedger = startLedger;
      }
      let resp;
      try {
        resp = await server.getEvents(req);
      } catch (err) {
        if (collected.length > 0) break;
        throw err;
      }
      const events = resp?.events || [];
      for (const e of events) {
        collected.push(parseEvent(e));
      }
      if (!resp.cursor || events.length === 0) break;
      cursor = resp.cursor;
    }

    collected.sort((a, b) => b.ledger - a.ledger);
    return collected.slice(0, limit);
  });
}

function jsonSafe(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

function parseEvent(e) {
  const topics = (e.topic || []).map((t) => {
    try {
      const native = typeof t === 'string'
        ? scValToNative(StellarSdk.xdr.ScVal.fromXDR(t, 'base64'))
        : scValToNative(t);
      return typeof native === 'bigint' ? native.toString() : String(native ?? '');
    } catch {
      return null;
    }
  });
  let value;
  try {
    if (e.value) {
      const raw = typeof e.value === 'string'
        ? scValToNative(StellarSdk.xdr.ScVal.fromXDR(e.value, 'base64'))
        : scValToNative(e.value);
      value = jsonSafe(raw);
    }
  } catch {
    value = null;
  }
  return {
    id: e.id,
    type: topics[0] || 'unknown',
    ledger: e.ledger,
    closedAt: e.ledgerClosedAt,
    txHash: e.txHash,
    topics,
    value,
  };
}

module.exports = {
  isPaid,
  isPaidBatch,
  getRecentEvents,
};
