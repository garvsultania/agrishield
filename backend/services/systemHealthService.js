'use strict';

const axios = require('axios');
const StellarSdk = require('@stellar/stellar-sdk');
const { getAdminKeypair } = require('./stellarService');
const { TtlCache } = require('./cache');
const { breakerSnapshot } = require('./resilient');

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const healthCache = new TtlCache({ defaultTtlMs: 10_000 });

async function ping(url, fn) {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, url, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, url, latencyMs: Date.now() - start, error: err.message };
  }
}

async function pingHorizon() {
  return ping(HORIZON_URL, async () => {
    await axios.get(`${HORIZON_URL}/`, { timeout: 4000 });
  });
}

async function pingSorobanRpc() {
  return ping(RPC_URL, async () => {
    const server = new StellarSdk.rpc.Server(RPC_URL);
    await server.getLatestLedger();
  });
}

async function adminBalance() {
  try {
    const kp = await getAdminKeypair();
    const { data } = await axios.get(`${HORIZON_URL}/accounts/${kp.publicKey()}`, { timeout: 5000 });
    const native = (data.balances || []).find((b) => b.asset_type === 'native');
    const xlm = native ? Number.parseFloat(native.balance) : 0;
    return { ok: true, address: kp.publicKey(), xlm: Number.isFinite(xlm) ? xlm : 0, funded: true };
  } catch (err) {
    const kp = await getAdminKeypair().catch(() => null);
    if (err.response?.status === 404) {
      return { ok: false, address: kp?.publicKey() || null, xlm: 0, funded: false, error: 'Not funded' };
    }
    return { ok: false, address: kp?.publicKey() || null, xlm: 0, funded: false, error: err.message };
  }
}

async function snapshot() {
  return healthCache.wrap('snapshot', 10_000, async () => {
    const [horizon, rpcNode, admin] = await Promise.all([
      pingHorizon(),
      pingSorobanRpc(),
      adminBalance(),
    ]);
    const contractConfigured = Boolean(process.env.SOROBAN_CONTRACT_ID);
    const breakers = breakerSnapshot();
    const anyBreakerOpen = Object.values(breakers).some((b) => b.state === 'open');
    const allOk = horizon.ok && rpcNode.ok && admin.ok && contractConfigured && !anyBreakerOpen;
    return {
      ok: allOk,
      horizon,
      sorobanRpc: rpcNode,
      admin,
      contract: {
        configured: contractConfigured,
        id: process.env.SOROBAN_CONTRACT_ID || null,
      },
      breakers,
      checkedAt: new Date().toISOString(),
    };
  });
}

module.exports = { snapshot };
