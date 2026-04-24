'use client';

import * as React from 'react';
import { ArrowUpRight, Download, Inbox, Trash2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { PageHeader } from '@/components/page-header';
import { useDashboard, type MergedPayout } from '@/components/dashboard-provider';
import { clearPayouts } from '@/lib/payouts-store';
import { farms } from '@/lib/farms-data';
import { truncateAddress } from '@/lib/utils';
import { timeAgo } from '@/lib/timeago';
import { toCsv, downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

type RangeKey = '24h' | '7d' | 'all';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}
function rangeStart(range: RangeKey): number {
  const now = Date.now();
  if (range === '24h') return now - 24 * 60 * 60 * 1000;
  if (range === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  return 0;
}

export default function PayoutsPage() {
  const { payouts, reconcile } = useDashboard();
  const [farmFilter, setFarmFilter] = React.useState<'all' | string>('all');
  const [range, setRange] = React.useState<RangeKey>('all');

  const filtered = React.useMemo(() => {
    const since = rangeStart(range);
    return payouts.filter((p) => {
      if (p.triggeredAt < since) return false;
      if (farmFilter !== 'all' && p.farmId !== farmFilter) return false;
      return true;
    });
  }, [payouts, farmFilter, range]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, MergedPayout[]>();
    for (const p of filtered) {
      const key = dayKey(p.triggeredAt);
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleClear = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.confirm('Clear local payout history? On-chain and server entries remain.')) {
      clearPayouts();
    }
  }, []);

  const handleExport = () => {
    const csv = toCsv(
      filtered.map((p) => ({
        triggeredAt: new Date(p.triggeredAt).toISOString(),
        farmId: p.farmId,
        farmerName: p.farmerName,
        method: p.method,
        txHash: p.txHash,
        proofHash: p.proofHash ?? '',
        recipient: p.recipient,
        sources: p.sources.join('+'),
        ledger: p.ledger ?? '',
        explorerUrl: p.explorerUrl,
      })),
      [
        { key: 'triggeredAt', header: 'Triggered At (ISO)' },
        { key: 'farmId', header: 'Farm ID' },
        { key: 'farmerName', header: 'Farmer' },
        { key: 'method', header: 'Method' },
        { key: 'txHash', header: 'Tx Hash' },
        { key: 'proofHash', header: 'Proof Hash' },
        { key: 'recipient', header: 'Recipient' },
        { key: 'sources', header: 'Sources' },
        { key: 'ledger', header: 'Ledger' },
        { key: 'explorerUrl', header: 'Explorer URL' },
      ]
    );
    downloadCsv(csv, `agrishield-payouts-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Payouts"
        title="Payout activity feed"
        description="Every confirmed payout across every device — sourced from on-chain contract events, the server log, and local history. Deduped by transaction hash."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => reconcile()}>
              Refresh
            </Button>
            {payouts.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            )}
            {payouts.some((p) => p.sources.includes('local')) && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear local
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Farm</span>
          <select
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
            aria-label="Filter by farm"
            className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All farms</option>
            {farms.map((f) => (
              <option key={f.farmId} value={f.farmId}>
                {f.farmerName}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5" role="tablist">
          {(
            [
              ['24h', '24h'],
              ['7d', '7d'],
              ['all', 'All'],
            ] as Array<[RangeKey, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={range === value}
              onClick={() => setRange(value)}
              className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition ${
                range === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {filtered.length} of {payouts.length}
        </span>
      </div>

      {payouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-muted-foreground">
              <Inbox className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <div className="text-sm font-semibold">No payouts yet</div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Trigger a simulation from the{' '}
                <a href="/map" className="text-primary underline-offset-2 hover:underline">satellite map</a>{' '}
                or <a href="/farms" className="text-primary underline-offset-2 hover:underline">farms table</a>.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[13px] text-muted-foreground">
            No payouts in this window.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul role="list" className="divide-y divide-border/50">
            {grouped.map(([day, entries]) => (
              <li key={day}>
                <div className="flex items-center gap-2 bg-secondary/30 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{day}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span>{entries.length}</span>
                </div>
                <ul role="list" className="divide-y divide-border/40">
                  {entries.map((p) => (
                    <PayoutRow key={p.id} entry={p} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function PayoutRow({ entry }: { entry: MergedPayout }) {
  const isContract = entry.method === 'soroban-contract' || entry.method === 'on-chain';

  // If we know the farmId suffix, use it; otherwise fallback to an id chip
  const farmSuffix = entry.farmId?.replace('SITAPUR_', '') ?? '—';

  return (
    <li>
      <a
        href={entry.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/60 font-mono text-[10px] font-semibold text-muted-foreground">
          {farmSuffix}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="truncate text-[13px] font-semibold">{entry.farmerName}</span>
            <Badge variant={isContract ? 'violet' : 'outline'} className="shrink-0 text-[9.5px] tracking-[0.1em]">
              {isContract ? 'Soroban' : 'XLM'}
            </Badge>
            <SourceChips sources={entry.sources} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="truncate">
              {entry.txHash.slice(0, 12)}…{entry.txHash.slice(-6)}
            </span>
            {entry.recipient && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="truncate">→ {truncateAddress(entry.recipient, 4, 4)}</span>
              </>
            )}
            {entry.ledger !== undefined && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>ledger {entry.ledger}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[12px] text-muted-foreground" title={new Date(entry.triggeredAt).toLocaleString()}>
            {formatTime(entry.triggeredAt)}
          </div>
          <div className="text-[10.5px] text-muted-foreground/80">{timeAgo(entry.triggeredAt)}</div>
        </div>

        <ArrowUpRight
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </a>
    </li>
  );
}

const SOURCE_META: Record<'chain' | 'server' | 'local', { label: string; tone: string; hint: string }> = {
  chain: {
    label: 'chain',
    tone: 'bg-success/15 text-success border-success/25',
    hint: 'Observed in on-chain contract events — ground truth',
  },
  server: {
    label: 'server',
    tone: 'bg-violet/15 text-violet border-violet/25',
    hint: 'Recorded in the server audit log',
  },
  local: {
    label: 'device',
    tone: 'bg-muted text-muted-foreground border-border',
    hint: 'Triggered from this browser (localStorage)',
  },
};

function SourceChips({ sources }: { sources: MergedPayout['sources'] }) {
  return (
    <div className="ml-auto flex items-center gap-1">
      {(['chain', 'server', 'local'] as const).map((s) =>
        sources.includes(s) ? (
          <Tooltip key={s}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'rounded border px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider',
                  SOURCE_META[s].tone
                )}
              >
                {SOURCE_META[s].label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{SOURCE_META[s].hint}</TooltipContent>
          </Tooltip>
        ) : null
      )}
    </div>
  );
}
