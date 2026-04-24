import axios, { AxiosError } from 'axios';
import type {
  ApiEnvelope,
  FarmStatusResponse,
  SimulationResult,
} from '@/lib/types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function extractError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return (
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      fallback
    );
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export async function fetchFarmStatus(farmId: string): Promise<FarmStatusResponse> {
  try {
    const { data } = await axios.get<ApiEnvelope<FarmStatusResponse>>(
      `${API_BASE}/api/farm/${farmId}/status`,
      { timeout: 10000 }
    );
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Farm status returned no data');
    }
    return data.data;
  } catch (err) {
    throw new Error(extractError(err, 'Failed to fetch farm status'));
  }
}

export async function simulatePayout(farmId: string): Promise<SimulationResult> {
  try {
    const { data } = await axios.post<ApiEnvelope<SimulationResult>>(
      `${API_BASE}/api/farm/${farmId}/simulate`,
      {},
      { timeout: 45000 }
    );
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Simulation returned no data');
    }
    return data.data;
  } catch (err) {
    throw new Error(extractError(err, 'Simulation failed'));
  }
}

// ── On-chain reads ────────────────────────────────────────────────────────────

export type ContractPaidMap = Record<string, boolean | null>;

export async function fetchContractPaidMap(): Promise<ContractPaidMap> {
  try {
    const { data } = await axios.get<ApiEnvelope<ContractPaidMap>>(
      `${API_BASE}/api/contract/is-paid`,
      { timeout: 25000 }
    );
    if (!data.success || !data.data) {
      throw new Error(data.error || 'is-paid returned no data');
    }
    return data.data;
  } catch (err) {
    throw new Error(extractError(err, 'Failed to read on-chain pool state'));
  }
}

export interface ContractEvent {
  id: string;
  type: 'INIT' | 'PAYOUT' | 'PROOF' | 'unknown' | string;
  ledger: number;
  closedAt: string; // ISO
  txHash: string;
  topics: string[];
  value: unknown;
}

export async function fetchContractEvents(limit = 200): Promise<ContractEvent[]> {
  try {
    const { data } = await axios.get<ApiEnvelope<ContractEvent[]>>(
      `${API_BASE}/api/contract/events`,
      { timeout: 25000, params: { limit } }
    );
    if (!data.success || !data.data) {
      throw new Error(data.error || 'events returned no data');
    }
    return data.data;
  } catch (err) {
    throw new Error(extractError(err, 'Failed to fetch contract events'));
  }
}

// ── Server-side payout log ────────────────────────────────────────────────────

export interface ServerPayoutEntry {
  id: string;
  farmId: string;
  farmerName: string;
  recipient: string;
  txHash: string;
  explorerUrl: string;
  method: 'soroban-contract' | 'xlm-payment';
  proofHash: string;
  triggeredAt: string; // ISO
}

export async function fetchServerPayouts(): Promise<ServerPayoutEntry[]> {
  try {
    const { data } = await axios.get<ApiEnvelope<ServerPayoutEntry[]>>(
      `${API_BASE}/api/payouts`,
      { timeout: 8000 }
    );
    if (!data.success || !data.data) return [];
    return data.data;
  } catch {
    return [];
  }
}

// ── System health ────────────────────────────────────────────────────────────

export interface PingResult {
  ok: boolean;
  url: string;
  latencyMs: number;
  error?: string;
}

export interface SystemHealth {
  ok: boolean;
  horizon: PingResult;
  sorobanRpc: PingResult;
  admin: {
    ok: boolean;
    address: string | null;
    xlm: number;
    funded: boolean;
    error?: string;
  };
  contract: { configured: boolean; id: string | null };
  checkedAt: string;
}

export async function fetchSystemHealth(): Promise<SystemHealth | null> {
  try {
    const { data } = await axios.get<ApiEnvelope<SystemHealth>>(
      `${API_BASE}/api/health/system`,
      { timeout: 8000 }
    );
    return data.success && data.data ? data.data : null;
  } catch {
    return null;
  }
}
