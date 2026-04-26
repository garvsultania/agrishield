'use client';

import * as React from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, Download, Search } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill, getFarmStatusTone } from '@/components/ui/status-pill';
import { PageHeader } from '@/components/page-header';
import { FarmDetailDrawer } from '@/components/farm-detail-drawer';

import { farms } from '@/lib/farms-data';
import { useDashboard } from '@/components/dashboard-provider';
import { useFarmUrlSync } from '@/components/use-farm-url-sync';
import { cn, formatNdvi, formatRainfall, truncateAddress } from '@/lib/utils';
import { timeAgo } from '@/lib/timeago';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { Farm, FarmStatusResponse } from '@/lib/types';
import type { MergedPayout } from '@/components/dashboard-provider';

type SortKey = 'farmId' | 'farmerName' | 'cropType' | 'areaSqKm' | 'ndvi' | 'rainfall' | 'status' | 'lastSim';
type SortDir = 'asc' | 'desc';

interface Row {
  farm: Farm;
  status?: FarmStatusResponse;
  error?: string;
  lastSim?: MergedPayout;
}

export default function FarmsPage() {
  return (
    <React.Suspense fallback={null}>
      <FarmsPageInner />
    </React.Suspense>
  );
}

function FarmsPageInner() {
  const { statuses, errors, getLastPayout } = useDashboard();
  const { selectedFarmId, openFarm, closeFarm } = useFarmUrlSync();

  const [sortKey, setSortKey] = React.useState<SortKey>('farmId');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const [search, setSearch] = React.useState('');
  const [cropFilter, setCropFilter] = React.useState<'all' | string>('all');

  const crops = React.useMemo(
    () => Array.from(new Set(farms.map((f) => f.cropType))).sort(),
    []
  );

  const rows: Row[] = React.useMemo(
    () =>
      farms.map((farm) => ({
        farm,
        status: statuses[farm.farmId],
        error: errors[farm.farmId],
        lastSim: getLastPayout(farm.farmId),
      })),
    [statuses, errors, getLastPayout]
  );

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (cropFilter !== 'all' && r.farm.cropType !== cropFilter) return false;
      if (!q) return true;
      return (
        r.farm.farmerName.toLowerCase().includes(q) ||
        r.farm.farmId.toLowerCase().includes(q) ||
        r.farm.cropType.toLowerCase().includes(q) ||
        r.farm.walletAddress.toLowerCase().includes(q)
      );
    });
  }, [rows, search, cropFilter]);

  const sortedRows = React.useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      const av = extract(a, sortKey);
      const bv = extract(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [filteredRows, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleExport = () => {
    const csv = toCsv(
      sortedRows.map((r) => ({
        farmId: r.farm.farmId,
        farmerName: r.farm.farmerName,
        cropType: r.farm.cropType,
        areaSqKm: r.farm.areaSqKm,
        ndvi: r.status?.ndvi ?? '',
        rainfall_mm: r.status?.rainfall_mm ?? '',
        status: r.status?.status ?? '',
        lastSimulated: r.lastSim ? new Date(r.lastSim.triggeredAt).toISOString() : '',
        lastTxHash: r.lastSim?.txHash ?? '',
        walletAddress: r.farm.walletAddress,
      })),
      [
        { key: 'farmId', header: 'Farm ID' },
        { key: 'farmerName', header: 'Farmer' },
        { key: 'cropType', header: 'Crop' },
        { key: 'areaSqKm', header: 'Area km²' },
        { key: 'ndvi', header: 'NDVI' },
        { key: 'rainfall_mm', header: 'Rainfall mm' },
        { key: 'status', header: 'Status' },
        { key: 'lastSimulated', header: 'Last Simulated (ISO)' },
        { key: 'lastTxHash', header: 'Last Tx Hash' },
        { key: 'walletAddress', header: 'Wallet' },
      ]
    );
    downloadCsv(csv, `agrishield-farms-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Farms"
        title="All monitored farms"
        description={`${farms.length} smallholder farms in Sitapur. Click a row for the status drawer, or use the column headers to sort.`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by farmer, ID, crop, or wallet…"
            aria-label="Search farms"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Crop
          </label>
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            aria-label="Filter by crop"
            className="rounded-full border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All</option>
            {crops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="All monitored farms">
            <caption className="sr-only">
              Sortable table of monitored farms with current NDVI, rainfall, and status.
            </caption>
            <thead className="bg-secondary/40 text-left">
              <tr>
                <HeaderCell scopeKey="farmId" label="Farm" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <HeaderCell scopeKey="farmerName" label="Farmer" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <HeaderCell scopeKey="cropType" label="Crop" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <HeaderCell scopeKey="areaSqKm" label="Area km²" active={sortKey} dir={sortDir} onClick={onHeaderClick} numeric />
                <HeaderCell scopeKey="ndvi" label="NDVI" active={sortKey} dir={sortDir} onClick={onHeaderClick} numeric />
                <HeaderCell scopeKey="rainfall" label="Rainfall" active={sortKey} dir={sortDir} onClick={onHeaderClick} numeric />
                <HeaderCell scopeKey="status" label="Status" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <HeaderCell scopeKey="lastSim" label="Last sim" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
                <th scope="col" className="px-4 py-3 text-right font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Wallet
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No farms match your filters.
                  </td>
                </tr>
              ) : (
                sortedRows.map(({ farm, status, error, lastSim }, idx) => {
                  const tone = getFarmStatusTone({ status: status?.status, error, loading: !status && !error });
                  const isDrought = status?.status === 'drought';
                  return (
                    <tr
                      key={farm.farmId}
                      onClick={() => openFarm(farm.farmId)}
                      className={cn(
                        'group cursor-pointer border-t border-border/50 transition-colors hover:bg-accent/40',
                        idx % 2 === 1 && 'bg-secondary/20',
                        isDrought && 'hover:bg-destructive/10'
                      )}
                    >
                      <th scope="row" className="px-4 py-3 text-left font-mono text-xs font-normal text-foreground">
                        {farm.farmId}
                      </th>
                      <td className="px-4 py-3 font-medium">{farm.farmerName}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{farm.cropType}</td>
                      <td className="px-4 py-3 num text-right text-muted-foreground">
                        {farm.areaSqKm.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 num text-right font-semibold',
                          status?.ndvi !== undefined && status.ndvi < 0.35
                            ? 'text-destructive'
                            : 'text-foreground'
                        )}
                      >
                        {formatNdvi(status?.ndvi)}
                      </td>
                      <td className="px-4 py-3 num text-right text-muted-foreground">
                        {formatRainfall(status?.rainfall_mm)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={tone} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {lastSim ? timeAgo(lastSim.triggeredAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-muted-foreground">
                        {truncateAddress(farm.walletAddress, 4, 4)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <FarmDetailDrawer
        farmId={selectedFarmId}
        open={Boolean(selectedFarmId)}
        onOpenChange={(open) => (open ? undefined : closeFarm())}
        onNavigate={openFarm}
      />
    </>
  );
}

function extract(row: Row, key: SortKey): string | number {
  switch (key) {
    case 'farmId':
      return row.farm.farmId;
    case 'farmerName':
      return row.farm.farmerName;
    case 'cropType':
      return row.farm.cropType;
    case 'areaSqKm':
      return row.farm.areaSqKm;
    case 'ndvi':
      return row.status?.ndvi ?? -1;
    case 'rainfall':
      return row.status?.rainfall_mm ?? -1;
    case 'status':
      return row.status?.status ?? 'zzz';
    case 'lastSim':
      return row.lastSim?.triggeredAt ?? 0;
  }
}

function HeaderCell({
  label,
  scopeKey,
  active,
  dir,
  onClick,
  numeric,
}: {
  label: string;
  scopeKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  numeric?: boolean;
}) {
  const isActive = active === scopeKey;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'select-none cursor-pointer px-4 py-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground',
        numeric && 'text-right'
      )}
      onClick={() => onClick(scopeKey)}
    >
      <span className={cn('inline-flex items-center gap-1', numeric && 'justify-end')}>
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" aria-hidden />
        )}
      </span>
    </th>
  );
}
