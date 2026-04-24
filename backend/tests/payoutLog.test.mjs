import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let tmpDir;
let logModule;
let LOG_PATH;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-payout-'));
  const tmpPath = path.join(tmpDir, 'payouts.log.jsonl');
  const origJoin = path.join.bind(path);
  path.join = (...args) => {
    const resolved = origJoin(...args);
    if (resolved.endsWith('payouts.log.jsonl')) return tmpPath;
    return resolved;
  };
  delete require.cache[require.resolve('../services/payoutLog')];
  logModule = require('../services/payoutLog');
  LOG_PATH = logModule.LOG_PATH;
  path.join = origJoin;
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {
    /* ignore */
  }
  delete require.cache[require.resolve('../services/payoutLog')];
});

function sampleResult(overrides = {}) {
  return {
    farmId: 'SITAPUR_001',
    farmerName: 'Ramesh Kumar',
    recipientAddress: 'GDU34N2INDZ2OZS5LLKJFKQGNWT2RIIXJZLYMRVQ44DB4TCFMO56SWG3',
    txHash: 'aabbccdd',
    explorerUrl: 'https://stellar.expert/explorer/testnet/tx/aabbccdd',
    method: 'soroban-contract',
    proofHash: 'pp',
    ...overrides,
  };
}

describe('payoutLog', () => {
  it('appends an entry and surfaces it via recent()', async () => {
    await logModule.logPayout(sampleResult());
    const recent = await logModule.recent({ limit: 10 });
    expect(recent).toHaveLength(1);
    expect(recent[0].txHash).toBe('aabbccdd');
    expect(recent[0].farmId).toBe('SITAPUR_001');
    expect(typeof recent[0].triggeredAt).toBe('string');
  });

  it('is newest-first and de-dupes on duplicate tx hashes', async () => {
    await logModule.logPayout(sampleResult({ txHash: 'one' }));
    await logModule.logPayout(sampleResult({ txHash: 'two' }));
    await logModule.logPayout(sampleResult({ txHash: 'one' }));
    const recent = await logModule.recent({ limit: 10 });
    expect(recent).toHaveLength(2);
    expect(recent[0].txHash).toBe('one');
    expect(recent[1].txHash).toBe('two');
  });

  it('filters by farmId', async () => {
    await logModule.logPayout(sampleResult({ farmId: 'SITAPUR_001', txHash: 'a' }));
    await logModule.logPayout(sampleResult({ farmId: 'SITAPUR_002', txHash: 'b' }));
    const only001 = await logModule.recent({ farmId: 'SITAPUR_001' });
    expect(only001).toHaveLength(1);
    expect(only001[0].farmId).toBe('SITAPUR_001');
  });

  it('tolerates malformed JSONL lines and keeps going', async () => {
    fs.writeFileSync(
      LOG_PATH,
      '{not-json\n' +
        JSON.stringify({
          id: 'SITAPUR_002-xyz',
          farmId: 'SITAPUR_002',
          farmerName: 'Sunita',
          recipient: 'GABC',
          txHash: 'xyz',
          explorerUrl: 'https://example',
          method: 'xlm-payment',
          proofHash: null,
          triggeredAt: new Date().toISOString(),
        }) +
        '\n'
    );
    const recent = await logModule.recent({});
    expect(recent).toHaveLength(1);
    expect(recent[0].txHash).toBe('xyz');
  });
});
