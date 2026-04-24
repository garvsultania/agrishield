'use client';

import * as React from 'react';
import { toast } from 'sonner';

import {
  fetchFarmStatus,
  fetchContractPaidMap,
  fetchContractEvents,
  fetchServerPayouts,
  fetchSystemHealth,
  type ContractEvent,
  type ServerPayoutEntry,
  type SystemHealth,
} from '@/lib/api';
import { farms } from '@/lib/farms-data';
import {
  getPayouts,
  savePayout as saveToStore,
  subscribe as subscribePayouts,
  type PayoutRecord,
} from '@/lib/payouts-store';
import type { FarmStatusResponse, SimulationResult } from '@/lib/types';

/**
 * A merged payout entry — dedup'd across device localStorage, server-side log,
 * and on-chain contract events. `sources` records which layers confirmed it.
 */
export interface MergedPayout {
  id: string; // stable: txHash
  farmId: string;
  farmerName: string;
  recipient: string;
  txHash: string;
  explorerUrl: string;
  method: 'soroban-contract' | 'xlm-payment' | 'on-chain';
  proofHash: string | null;
  triggeredAt: number; // epoch ms
  sources: Array<'local' | 'server' | 'chain'>;
  ledger?: number;
}

export interface DashboardContextValue {
  statuses: Record<string, FarmStatusResponse | undefined>;
  errors: Record<string, string>;
  loading: boolean;
  lastUpdated: number | null;
  refetch: (farmId?: string) => Promise<void>;
  payouts: readonly MergedPayout[];
  recordPayout: (result: SimulationResult) => void;
  getLastPayout: (farmId: string) => MergedPayout | undefined;
  contractPaidSet: ReadonlySet<string>;
  contractEvents: readonly ContractEvent[];
  reconcile: () => Promise<void>;
  systemHealth: SystemHealth | null;
}

const DashboardContext = React.createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = React.useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used inside <DashboardProvider>');
  }
  return ctx;
}

const REVALIDATE_COOLDOWN_MS = 15_000;
const CONTRACT_RECONCILE_MS = 60_000;
const HEALTH_POLL_MS = 30_000;

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = React.useState<Record<string, FarmStatusResponse | undefined>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);

  const [localRecords, setLocalRecords] = React.useState<readonly PayoutRecord[]>([]);
  const [serverRecords, setServerRecords] = React.useState<readonly ServerPayoutEntry[]>([]);
  const [contractEvents, setContractEvents] = React.useState<readonly ContractEvent[]>([]);
  const [contractPaidSet, setContractPaidSet] = React.useState<ReadonlySet<string>>(new Set());
  const [systemHealth, setSystemHealth] = React.useState<SystemHealth | null>(null);

  const inFlightRef = React.useRef(false);

  // ── Farm statuses ────────────────────────────────────────────────────────
  const loadAll = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const nextStatuses: Record<string, FarmStatusResponse> = {};
      const nextErrors: Record<string, string> = {};
      await Promise.allSettled(
        farms.map(async (farm) => {
          try {
            nextStatuses[farm.farmId] = await fetchFarmStatus(farm.farmId);
          } catch (err) {
            nextErrors[farm.farmId] = err instanceof Error ? err.message : 'Fetch failed';
          }
        })
      );
      setStatuses(nextStatuses);
      setErrors(nextErrors);
      setLastUpdated(Date.now());
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  const refetch = React.useCallback(
    async (farmId?: string) => {
      if (!farmId) {
        await loadAll();
        return;
      }
      try {
        const result = await fetchFarmStatus(farmId);
        setStatuses((prev) => ({ ...prev, [farmId]: result }));
        setErrors((prev) => {
          if (!prev[farmId]) return prev;
          const { [farmId]: _removed, ...rest } = prev;
          return rest;
        });
        setLastUpdated(Date.now());
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Fetch failed';
        setErrors((prev) => ({ ...prev, [farmId]: msg }));
        throw err;
      }
    },
    [loadAll]
  );

  // ── On-chain reconciliation ──────────────────────────────────────────────
  const reconcile = React.useCallback(async () => {
    const [paidMap, events, serverLog] = await Promise.allSettled([
      fetchContractPaidMap(),
      fetchContractEvents(200),
      fetchServerPayouts(),
    ]);

    if (paidMap.status === 'fulfilled') {
      const set = new Set<string>();
      for (const [farmId, isPaid] of Object.entries(paidMap.value)) {
        if (isPaid === true) set.add(farmId);
      }
      setContractPaidSet(set);
    }

    if (events.status === 'fulfilled') {
      setContractEvents(events.value);
    }

    if (serverLog.status === 'fulfilled') {
      setServerRecords(serverLog.value);
    }
  }, []);

  // ── Payouts: record locally + toast ─────────────────────────────────────
  const recordPayout = React.useCallback(
    (result: SimulationResult) => {
      saveToStore(result);
      if (result.farmId) {
        setStatuses((prev) => {
          const existing = prev[result.farmId];
          if (!existing) return prev;
          return {
            ...prev,
            [result.farmId]: {
              ...existing,
              status: result.triggered ? 'drought' : existing.status,
              evaluation: result.evaluation,
            },
          };
        });
      }
      toast.success('Payout triggered', {
        description:
          result.method === 'soroban-contract'
            ? `Soroban tx for ${result.farmerName} · ${result.farmId}`
            : `XLM payment for ${result.farmerName} · ${result.farmId}`,
        action: {
          label: 'View tx',
          onClick: () => window.open(result.explorerUrl, '_blank', 'noopener,noreferrer'),
        },
      });
      // Pull fresh on-chain state a few seconds after the tx lands
      window.setTimeout(() => {
        reconcile().catch(() => undefined);
      }, 6000);
    },
    [reconcile]
  );

  // ── Merged payout stream ────────────────────────────────────────────────
  const payouts = React.useMemo<MergedPayout[]>(
    () => mergePayoutStreams({ localRecords, serverRecords, contractEvents }),
    [localRecords, serverRecords, contractEvents]
  );

  const getLastPayout = React.useCallback(
    (farmId: string) => payouts.find((p) => p.farmId === farmId),
    [payouts]
  );

  // ── Effects ─────────────────────────────────────────────────────────────
  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  React.useEffect(() => {
    const onFocus = () => {
      if (!lastUpdated || Date.now() - lastUpdated > REVALIDATE_COOLDOWN_MS) {
        loadAll();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadAll, lastUpdated]);

  React.useEffect(() => {
    setLocalRecords(getPayouts());
    const unsubscribe = subscribePayouts((records) => setLocalRecords(records));
    return unsubscribe;
  }, []);

  // Initial + periodic on-chain reconciliation
  React.useEffect(() => {
    reconcile();
    const id = window.setInterval(() => reconcile(), CONTRACT_RECONCILE_MS);
    return () => window.clearInterval(id);
  }, [reconcile]);

  // System health polling
  React.useEffect(() => {
    let cancelled = false;
    async function tick() {
      const h = await fetchSystemHealth();
      if (!cancelled) setSystemHealth(h);
    }
    tick();
    const id = window.setInterval(tick, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const value = React.useMemo<DashboardContextValue>(
    () => ({
      statuses,
      errors,
      loading,
      lastUpdated,
      refetch,
      payouts,
      recordPayout,
      getLastPayout,
      contractPaidSet,
      contractEvents,
      reconcile,
      systemHealth,
    }),
    [
      statuses,
      errors,
      loading,
      lastUpdated,
      refetch,
      payouts,
      recordPayout,
      getLastPayout,
      contractPaidSet,
      contractEvents,
      reconcile,
      systemHealth,
    ]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

// ── Merge helper ──────────────────────────────────────────────────────────────

function mergePayoutStreams(input: {
  localRecords: readonly PayoutRecord[];
  serverRecords: readonly ServerPayoutEntry[];
  contractEvents: readonly ContractEvent[];
}): MergedPayout[] {
  const byHash = new Map<string, MergedPayout>();

  const upsert = (hash: string, patch: Partial<MergedPayout> & Pick<MergedPayout, 'txHash'>, source: MergedPayout['sources'][number]) => {
    const existing = byHash.get(hash);
    if (!existing) {
      byHash.set(hash, {
        id: hash,
        farmId: patch.farmId ?? 'unknown',
        farmerName: patch.farmerName ?? 'Unknown',
        recipient: patch.recipient ?? '',
        txHash: hash,
        explorerUrl: patch.explorerUrl ?? `https://stellar.expert/explorer/testnet/tx/${hash}`,
        method: patch.method ?? 'on-chain',
        proofHash: patch.proofHash ?? null,
        triggeredAt: patch.triggeredAt ?? Date.now(),
        sources: [source],
        ledger: patch.ledger,
      });
      return;
    }
    const merged: MergedPayout = { ...existing };
    if (patch.farmId && merged.farmId === 'unknown') merged.farmId = patch.farmId;
    if (patch.farmerName && merged.farmerName === 'Unknown') merged.farmerName = patch.farmerName;
    if (patch.recipient && !merged.recipient) merged.recipient = patch.recipient;
    if (patch.proofHash && !merged.proofHash) merged.proofHash = patch.proofHash;
    if (patch.method && merged.method === 'on-chain' && patch.method !== 'on-chain') {
      merged.method = patch.method;
    }
    if (patch.triggeredAt && patch.triggeredAt < merged.triggeredAt) {
      merged.triggeredAt = patch.triggeredAt;
    }
    if (patch.ledger && !merged.ledger) merged.ledger = patch.ledger;
    if (!merged.sources.includes(source)) merged.sources = [...merged.sources, source];
    byHash.set(hash, merged);
  };

  for (const r of input.localRecords) {
    if (!r.txHash) continue;
    upsert(
      r.txHash,
      {
        txHash: r.txHash,
        farmId: r.farmId,
        farmerName: r.farmerName,
        recipient: r.recipientAddress,
        explorerUrl: r.explorerUrl,
        method: r.method,
        proofHash: r.proofHash,
        triggeredAt: r.triggeredAt,
      },
      'local'
    );
  }

  for (const r of input.serverRecords) {
    if (!r.txHash) continue;
    upsert(
      r.txHash,
      {
        txHash: r.txHash,
        farmId: r.farmId,
        farmerName: r.farmerName,
        recipient: r.recipient,
        explorerUrl: r.explorerUrl,
        method: r.method,
        proofHash: r.proofHash,
        triggeredAt: Date.parse(r.triggeredAt),
      },
      'server'
    );
  }

  for (const e of input.contractEvents) {
    if (!e.txHash) continue;
    if (e.type === 'PAYOUT') {
      const farmId = e.topics[1] || 'unknown';
      const recipient = typeof e.value === 'string' ? e.value : '';
      upsert(
        e.txHash,
        {
          txHash: e.txHash,
          farmId,
          farmerName: farmId,
          recipient,
          triggeredAt: Date.parse(e.closedAt),
          ledger: e.ledger,
          method: 'soroban-contract',
        },
        'chain'
      );
    } else if (e.type === 'PROOF' && Array.isArray(e.value)) {
      const [proof, , recipient] = e.value as unknown[];
      const farmId = e.topics[1] || 'unknown';
      upsert(
        e.txHash,
        {
          txHash: e.txHash,
          farmId,
          farmerName: farmId,
          recipient: typeof recipient === 'string' ? recipient : '',
          proofHash: typeof proof === 'string' ? proof : null,
          triggeredAt: Date.parse(e.closedAt),
          ledger: e.ledger,
          method: 'soroban-contract',
        },
        'chain'
      );
    }
  }

  return Array.from(byHash.values()).sort((a, b) => b.triggeredAt - a.triggeredAt);
}
