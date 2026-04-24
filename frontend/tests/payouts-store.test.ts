import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPayouts,
  savePayout,
  clearPayouts,
  subscribe,
  type PayoutRecord,
} from '@/lib/payouts-store';
import type { SimulationResult } from '@/lib/types';

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    triggered: true,
    farmId: 'SITAPUR_001',
    farmerName: 'Ramesh Kumar',
    recipientAddress: 'GDU34N2INDZ2OZS5LLKJFKQGNWT2RIIXJZLYMRVQ44DB4TCFMO56SWG3',
    txHash: 'abc123',
    explorerUrl: 'https://stellar.expert/explorer/testnet/tx/abc123',
    method: 'soroban-contract',
    proofHash: 'proof-hash-sha256',
    evaluation: {
      triggered: true,
      reason: 'Drought confirmed',
      confidence: 'high',
      proof_of_loss: {
        avg_ndvi: 0.21,
        avg_rainfall_mm: 0.5,
        min_ndvi: 0.18,
        max_rainfall_mm: 2.1,
        days_evaluated: 14,
        ndvi_threshold: 0.35,
        rainfall_threshold_mm: 10,
        observation_window: { start: '2026-04-10', end: '2026-04-23' },
        data_source: 'simulated',
      },
    },
    ...overrides,
  };
}

describe('payouts-store', () => {
  beforeEach(() => {
    clearPayouts();
  });

  it('returns an empty array when nothing has been saved', () => {
    expect(getPayouts()).toEqual([]);
  });

  it('persists a new payout and returns it via getPayouts', () => {
    const saved = savePayout(makeResult());
    const records = getPayouts();
    expect(records).toHaveLength(1);
    expect(records[0].txHash).toBe(saved.txHash);
    expect(records[0].farmId).toBe('SITAPUR_001');
    expect(records[0].method).toBe('soroban-contract');
  });

  it('inserts newest payouts first', () => {
    savePayout(makeResult({ txHash: 'first' }));
    savePayout(makeResult({ txHash: 'second' }));
    const records = getPayouts();
    expect(records[0].txHash).toBe('second');
    expect(records[1].txHash).toBe('first');
  });

  it('de-duplicates when the same txHash is saved twice', () => {
    savePayout(makeResult({ txHash: 'same-hash' }));
    savePayout(makeResult({ txHash: 'same-hash' }));
    expect(getPayouts()).toHaveLength(1);
  });

  it('clears every record', () => {
    savePayout(makeResult());
    expect(getPayouts()).toHaveLength(1);
    clearPayouts();
    expect(getPayouts()).toHaveLength(0);
  });

  it('notifies subscribers on save and clear', () => {
    const spy = vi.fn();
    const unsubscribe = subscribe(spy);
    savePayout(makeResult({ txHash: 'sub-test' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveLength(1);

    clearPayouts();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0]).toHaveLength(0);

    unsubscribe();
    savePayout(makeResult({ txHash: 'after-unsub' }));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('recovers gracefully from corrupted localStorage content', () => {
    window.localStorage.setItem('agrishield.payouts.v1', '{not json');
    expect(getPayouts()).toEqual([]);
  });

  it('drops entries that fail record-shape validation', () => {
    const junk: unknown[] = [{ wrong: true }, null, 'string', 42];
    window.localStorage.setItem('agrishield.payouts.v1', JSON.stringify(junk));
    expect(getPayouts()).toEqual([]);
  });

  it('shape: PayoutRecord carries a monotonic timestamp', () => {
    const before = Date.now();
    const rec: PayoutRecord = savePayout(makeResult());
    const after = Date.now();
    expect(rec.triggeredAt).toBeGreaterThanOrEqual(before);
    expect(rec.triggeredAt).toBeLessThanOrEqual(after);
  });
});
