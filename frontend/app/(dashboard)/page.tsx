'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Droplets, Layers, Leaf, Map as MapIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { HeroCard } from '@/components/hero-card';
import { MetricCard } from '@/components/metric-card';
import { NdviSparkline } from '@/components/ndvi-sparkline';
import { LiveRelativeTime } from '@/components/live-relative-time';

import { useDashboard } from '@/components/dashboard-provider';
import { farms } from '@/lib/farms-data';
import { PAYOUT_PER_FARM_XLM, NDVI_THRESHOLD, OBSERVATION_WINDOW_DAYS } from '@/lib/env';
import { getHistory } from '@/lib/historical-data';

export default function OverviewPage() {
  const { statuses, loading, payouts, lastUpdated, contractPaidSet } = useDashboard();

  const droughtCount = Object.values(statuses).filter((s) => s?.status === 'drought').length;
  const healthyCount = Object.values(statuses).filter((s) => s?.status === 'healthy').length;
  const totalArea = farms.reduce((sum, f) => sum + f.areaSqKm, 0);

  const ndviValues = farms.map((f) => statuses[f.farmId]?.ndvi ?? 0);
  const positiveNdvi = ndviValues.filter((v) => v > 0);
  const avgNdvi =
    positiveNdvi.length > 0 ? positiveNdvi.reduce((a, b) => a + b, 0) / positiveNdvi.length : 0;
  const poolTotalXlm = farms.length * PAYOUT_PER_FARM_XLM;
  const knownFarmIds = new Set(farms.map((f) => f.farmId));
  // Count on-chain paid pools, union'd with anything local that points at a known farm
  const paidFarmIds = React.useMemo(() => {
    const set = new Set(contractPaidSet);
    for (const p of payouts) if (knownFarmIds.has(p.farmId)) set.add(p.farmId);
    return set;
    // knownFarmIds is derived from a static import; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractPaidSet, payouts]);
  const netPayoutXlm = paidFarmIds.size * PAYOUT_PER_FARM_XLM;

  // Spark series: avg NDVI across farms, day-by-day (14 days)
  const avgNdviSeries = React.useMemo(() => {
    const days = OBSERVATION_WINDOW_DAYS;
    const out: number[] = [];
    for (let i = 0; i < days; i++) {
      const dayValues = farms
        .map((f) => getHistory(f.farmId)[i]?.ndvi)
        .filter((v): v is number => typeof v === 'number');
      if (dayValues.length === 0) {
        out.push(0);
      } else {
        out.push(dayValues.reduce((a, b) => a + b, 0) / dayValues.length);
      }
    }
    return out;
  }, []);

  const avgRainSeries = React.useMemo(() => {
    const days = OBSERVATION_WINDOW_DAYS;
    const out: number[] = [];
    for (let i = 0; i < days; i++) {
      const dayValues = farms
        .map((f) => getHistory(f.farmId)[i]?.rainfall_mm)
        .filter((v): v is number => typeof v === 'number');
      if (dayValues.length === 0) {
        out.push(0);
      } else {
        out.push(dayValues.reduce((a, b) => a + b, 0) / dayValues.length);
      }
    }
    return out;
  }, []);

  const droughtFarmsByDay = React.useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < OBSERVATION_WINDOW_DAYS; i++) {
      const n = farms.filter((f) => {
        const obs = getHistory(f.farmId)[i];
        return obs && obs.ndvi < NDVI_THRESHOLD;
      }).length;
      out.push(n);
    }
    return out;
  }, []);

  const payoutsByDayFromHistory = React.useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 7 }, () => 0);
    payouts.forEach((p) => {
      const ageDays = Math.floor((now - p.triggeredAt) / 86_400_000);
      if (ageDays >= 0 && ageDays < 7) {
        buckets[6 - ageDays] += 1;
      }
    });
    return buckets;
  }, [payouts]);

  return (
    <>
      {/* Row 1: Hero + metrics */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <HeroCard
          totalFarms={farms.length}
          droughtCount={droughtCount}
          monitoredAreaKm2={totalArea}
        />
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Avg NDVI (14d)"
            value={loading ? '—' : avgNdvi.toFixed(3)}
            hint={`across ${farms.length} farms · mock data`}
            tone="glass"
            spark={{
              points: avgNdviSeries,
              kind: 'line',
              threshold: NDVI_THRESHOLD,
              ariaLabel: 'Average NDVI over the 14-day window',
            }}
          />
          <MetricCard
            label="Pool Liquidity"
            value={`${poolTotalXlm} XLM`}
            hint={`${farms.length} × ${PAYOUT_PER_FARM_XLM} XLM armed`}
            tone="lime"
            decoration="waves"
            spark={{
              points: Array.from({ length: farms.length }, () => PAYOUT_PER_FARM_XLM),
              kind: 'bar',
              ariaLabel: 'Liquidity distribution across pools',
            }}
          />
          <MetricCard
            label="Farms in Drought"
            value={`${droughtCount}`}
            hint={`${healthyCount} healthy · today`}
            tone="glass"
            spark={{
              points: droughtFarmsByDay,
              kind: 'bar',
              ariaLabel: 'Farms below NDVI threshold, day by day',
            }}
          />
          <MetricCard
            label="Net Payout"
            value={`${netPayoutXlm} XLM`}
            hint={`${payouts.length} tx in local history`}
            tone="violet"
            decoration="waves"
            spark={{
              points: payoutsByDayFromHistory,
              kind: 'bar',
              ariaLabel: 'Payouts by day, last 7 days',
            }}
          />
        </div>
      </section>

      {/* Row 2: NDVI banner */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:gap-6">
          <div className="md:min-w-[220px]">
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Per-farm NDVI snapshot
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight num">
              {loading ? '—' : avgNdvi.toFixed(3)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Threshold <span className="font-mono num">{NDVI_THRESHOLD}</span> ·{' '}
              <span className="text-destructive font-semibold">{droughtCount} below</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              <LiveRelativeTime timestamp={lastUpdated} prefix="Synced" fallback="syncing…" />
            </div>
          </div>
          <Separator orientation="vertical" className="hidden h-14 md:block" />
          <div className="flex-1">
            <NdviSparkline values={ndviValues} threshold={NDVI_THRESHOLD} />
            <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {farms.map((f) => (
                <span key={f.farmId}>{f.farmId.replace('SITAPUR_', '')}</span>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Each point is one farm, not a day. See Analytics for day-by-day trends.
            </p>
          </div>
        </div>
      </Card>

      {/* Row 3: Quick links */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/map"
          icon={<MapIcon className="h-4 w-4" />}
          title="Satellite map"
          description="ESRI imagery · polygon click opens the farm drawer"
        />
        <QuickLink
          href="/farms"
          icon={<Leaf className="h-4 w-4" />}
          title="Farms table"
          description="Sort, search, and export monitored farms"
        />
        <QuickLink
          href="/pools"
          icon={<Layers className="h-4 w-4" />}
          title="Soroban pools"
          description="5 × 100 XLM pools · armed vs paid"
        />
        <QuickLink
          href="/analytics"
          icon={<Droplets className="h-4 w-4" />}
          title="Analytics"
          description={`${OBSERVATION_WINDOW_DAYS}-day NDVI & rainfall trends`}
        />
      </section>
    </>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-5 transition hover:shadow-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link href={href} aria-label={`Open ${title}`}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
