import type { SimulationResult } from '@/lib/types';

export interface PayoutRecord {
  id: string;
  farmId: string;
  farmerName: string;
  recipientAddress: string;
  txHash: string;
  explorerUrl: string;
  method: 'soroban-contract' | 'xlm-payment';
  proofHash: string;
  triggeredAt: number; // epoch ms
}

const STORAGE_KEY = 'agrishield.payouts.v1';
const MAX_ENTRIES = 50;

type Subscriber = (records: readonly PayoutRecord[]) => void;
const subscribers = new Set<Subscriber>();

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function read(): PayoutRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecord);
  } catch {
    return [];
  }
}

function write(records: readonly PayoutRecord[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* quota exceeded or serialization error — non-fatal */
  }
}

function isValidRecord(x: unknown): x is PayoutRecord {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as PayoutRecord).id === 'string' &&
    typeof (x as PayoutRecord).txHash === 'string' &&
    typeof (x as PayoutRecord).farmId === 'string' &&
    typeof (x as PayoutRecord).triggeredAt === 'number'
  );
}

function notify(records: readonly PayoutRecord[]): void {
  subscribers.forEach((fn) => {
    try {
      fn(records);
    } catch {
      /* swallow — a bad subscriber should not break others */
    }
  });
}

export function getPayouts(): readonly PayoutRecord[] {
  return read();
}

export function savePayout(result: SimulationResult): PayoutRecord {
  const record: PayoutRecord = {
    id: `${result.txHash}-${Date.now()}`,
    farmId: result.farmId,
    farmerName: result.farmerName,
    recipientAddress: result.recipientAddress,
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    method: result.method,
    proofHash: result.proofHash,
    triggeredAt: Date.now(),
  };
  const current = read();
  // De-dupe on txHash; newest first
  const filtered = current.filter((c) => c.txHash !== record.txHash);
  const next = [record, ...filtered].slice(0, MAX_ENTRIES);
  write(next);
  notify(next);
  return record;
}

export function clearPayouts(): void {
  write([]);
  notify([]);
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
