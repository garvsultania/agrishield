'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CloudRain,
  Database,
  Droplet,
  LayoutGrid,
  Leaf,
  Satellite,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { PageHeader } from '@/components/page-header';
import { TrendChart, type TrendSeries } from '@/components/trend-chart';
import { useDashboard } from '@/components/dashboard-provider';

import { farms } from '@/lib/farms-data';
import { getHistory } from '@/lib/historical-data';
import { NDVI_THRESHOLD, RAINFALL_THRESHOLD_MM, OBSERVATION_WINDOW_DAYS } from '@/lib/env';
import { cn } from '@/lib/utils';
import type { FarmStatusResponse, DailyObservation } from '@/lib/types';

const palette = [
  'hsl(76 82% 58%)', // lime
  'hsl(262 83% 65%)', // violet
  'hsl(215 91% 60%)', // sky
  'hsl(32 100% 60%)', // orange
  'hsl(340 82% 65%)', // pink
];

/**
 * Prefer the live observations the provider polled from /api/farm/:id/status
 * — they carry real rainfall (Open-Meteo), real NDVI for the days where
 * Sentinel-2 was available, and rolling today-minus-14 dates. Fall back to
 * the static mock JSON only when the live statuses haven't landed yet, so
 * the UI never shows 2024 dates while the rest of the app is current.
 */
function buildSeries(
  kind: 'ndvi' | 'rainfall_mm' | 'soil_moisture',
  statuses: Record<string, FarmStatusResponse | undefined>
): TrendSeries[] {
  return farms.map((farm, idx) => {
    const live = statuses[farm.farmId]?.observations;
    const mock = getHistory(farm.farmId);
    const points: number[] = [];
    const dates: string[] = [];
    if (live && live.length > 0) {
      for (const o of live as DailyObservation[]) {
        const v = kind === 'soil_moisture' ? o.soil_moisture : (o as any)[kind];
        if (typeof v === 'number') {
          points.push(v);
          dates.push(o.observation_date);
        }
      }
    } else {
      for (const o of mock) {
        points.push((o as any)[kind]);
        dates.push(o.date);
      }
    }
    return {
      id: farm.farmId,
      label: farm.farmerName,
      points,
      dates,
      color: palette[idx % palette.length],
    };
  });
}

type ProvenanceCount = { real: number; total: number };

function provenanceFor(
  kind: 'ndvi' | 'rainfall',
  statuses: Record<string, FarmStatusResponse | undefined>,
  farmId: string
): ProvenanceCount {
  const obs = statuses[farmId]?.observations;
  if (!obs || obs.length === 0) return { real: 0, total: 0 };
  const sourceKey = kind === 'ndvi' ? 'ndvi_source' : 'rainfall_source';
  const realTags = kind === 'ndvi' ? ['sentinel-2', 'sentinel-2-interp'] : ['open-meteo'];
  let real = 0;
  for (const o of obs as DailyObservation[]) {
    if (realTags.includes((o as any)[sourceKey])) real += 1;
  }
  return { real, total: obs.length };
}

export default function AnalyticsPage() {
  const { statuses, loading, lastUpdated } = useDashboard();

  const ndviSeries = React.useMemo(() => buildSeries('ndvi', statuses), [statuses]);
  const rainSeries = React.useMemo(() => buildSeries('rainfall_mm', statuses), [statuses]);
  const soilSeries = React.useMemo(() => buildSeries('soil_moisture', statuses), [statuses]);

  const anyLive = Object.values(statuses).some((s) => !!s?.observations);
  const dateRange = anyLive ? livingDateRange(ndviSeries) : 'last 14 days (mock)';

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title={`${OBSERVATION_WINDOW_DAYS}-day observation window`}
        description={
          <>
            Daily NDVI, rainfall, and soil moisture per farm.{' '}
            <span className="font-medium text-foreground">Real-data coverage</span> is shown as a
            chip on each card; missing days fall back to the mock series with rebased rolling dates.
            Hover any chart to read the exact value.
          </>
        }
      />

      {!anyLive && !loading && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-[12px] text-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Farm status hasn&apos;t loaded yet — charts below are from the static mock series and
            will update once the backend reports real observations.
          </span>
        </div>
      )}

      <Tabs defaultValue="ndvi" className="w-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="ndvi">
              <Leaf className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              NDVI
            </TabsTrigger>
            <TabsTrigger value="rain">
              <CloudRain className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Rainfall
            </TabsTrigger>
            <TabsTrigger value="soil">
              <Droplet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Soil moisture
            </TabsTrigger>
            <TabsTrigger value="overlay">
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Compare
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <span className="opacity-70">range</span>
              <span className="ml-1 font-mono">{dateRange}</span>
            </Badge>
            {lastUpdated && (
              <Badge variant="outline" className="opacity-75">
                <span className="opacity-70">synced</span>
                <span className="ml-1 font-mono">{new Date(lastUpdated).toLocaleTimeString()}</span>
              </Badge>
            )}
          </div>
        </div>

        {/* ── NDVI ────────────────────────────────────────────────────────────── */}
        <TabsContent value="ndvi">
          <ChartGrid
            ariaLabel="NDVI per farm"
            threshold={NDVI_THRESHOLD}
            thresholdMode="below"
            series={ndviSeries}
            summary={(s) => {
              const avg =
                s.points.reduce((a, b) => a + b, 0) / Math.max(s.points.length, 1);
              const breaches = s.points.filter((v) => v < NDVI_THRESHOLD).length;
              return {
                badge: breaches === s.points.length ? 'danger' : breaches > 0 ? 'warn' : 'success',
                text: `avg ${avg.toFixed(3)}`,
                hint:
                  breaches === s.points.length
                    ? `${breaches}/${s.points.length} days below 0.35 — drought`
                    : breaches > 0
                    ? `${breaches}/${s.points.length} days below 0.35`
                    : 'all days healthy',
              };
            }}
            provenance={(farmId) => {
              const p = provenanceFor('ndvi', statuses, farmId);
              return p.total === 0
                ? null
                : {
                    icon: <Satellite className="h-3 w-3" aria-hidden />,
                    label: p.real > 0 ? 'Sentinel-2' : 'Mock',
                    text: `${p.real}/${p.total} real`,
                    real: p.real > 0,
                  };
            }}
          />
        </TabsContent>

        {/* ── Rainfall ────────────────────────────────────────────────────────── */}
        <TabsContent value="rain">
          <ChartGrid
            ariaLabel="Rainfall per farm"
            threshold={RAINFALL_THRESHOLD_MM}
            thresholdMode="below"
            series={rainSeries}
            summary={(s) => {
              const total = s.points.reduce((a, b) => a + b, 0);
              const daysOver = s.points.filter((v) => v >= RAINFALL_THRESHOLD_MM).length;
              const dry = daysOver === 0;
              return {
                badge: dry ? 'danger' : daysOver < s.points.length / 3 ? 'warn' : 'success',
                text: `${total.toFixed(1)}mm total`,
                hint: dry
                  ? 'no day ≥ 10mm — dry window'
                  : `${daysOver}/${s.points.length} days ≥ 10mm threshold`,
              };
            }}
            provenance={(farmId) => {
              const p = provenanceFor('rainfall', statuses, farmId);
              return p.total === 0
                ? null
                : {
                    icon: <CloudRain className="h-3 w-3" aria-hidden />,
                    label: p.real > 0 ? 'Open-Meteo' : 'Mock',
                    text: `${p.real}/${p.total} real`,
                    real: p.real > 0,
                  };
            }}
          />
        </TabsContent>

        {/* ── Soil moisture ──────────────────────────────────────────────────── */}
        <TabsContent value="soil">
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Soil moisture isn&apos;t part of the drought trigger and no free high-resolution
              source exists at per-farm granularity (NASA SMAP is 9&nbsp;km). These values are
              mock, shown as a reference signal only.
            </span>
          </div>
          <ChartGrid
            ariaLabel="Soil moisture per farm"
            series={soilSeries}
            summary={(s) => {
              const avg =
                s.points.reduce((a, b) => a + b, 0) / Math.max(s.points.length, 1);
              return {
                badge: avg < 0.1 ? 'danger' : avg < 0.15 ? 'warn' : 'success',
                text: `avg ${avg.toFixed(3)}`,
                hint: avg < 0.1 ? 'very dry' : avg < 0.15 ? 'dry' : 'adequate',
              };
            }}
            provenance={() => ({
              icon: <Database className="h-3 w-3" aria-hidden />,
              label: 'Mock',
              text: 'reference only',
              real: false,
            })}
          />
        </TabsContent>

        {/* ── Compare ────────────────────────────────────────────────────────── */}
        <TabsContent value="overlay">
          <section className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All farms · NDVI</CardTitle>
                  <Badge variant="outline">
                    threshold <span className="ml-1 font-mono">&lt; {NDVI_THRESHOLD}</span>
                  </Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Dashed red line marks the drought ceiling; any point below it is a breach day.
                  Hover to read the exact value per farm.
                </p>
              </CardHeader>
              <CardContent>
                <TrendChart
                  series={ndviSeries}
                  threshold={NDVI_THRESHOLD}
                  thresholdMode="below"
                  height={260}
                  ariaLabel="NDVI overlay across all farms"
                />
                <Legend series={ndviSeries} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All farms · Rainfall</CardTitle>
                  <Badge variant="outline">
                    threshold <span className="ml-1 font-mono">≥ {RAINFALL_THRESHOLD_MM}mm</span>
                  </Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Daily precipitation per farm. A drought day must fall below {RAINFALL_THRESHOLD_MM}&nbsp;mm;
                  all 14 must be dry for the oracle to trigger.
                </p>
              </CardHeader>
              <CardContent>
                <TrendChart
                  series={rainSeries}
                  threshold={RAINFALL_THRESHOLD_MM}
                  thresholdMode="below"
                  height={260}
                  ariaLabel="Rainfall overlay across all farms"
                />
                <Legend series={rainSeries} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}

interface SummaryOut {
  badge: 'success' | 'danger' | 'warn';
  text: string;
  hint?: string;
}

interface ProvenanceChip {
  icon: React.ReactNode;
  label: string;
  text: string;
  real: boolean;
}

function ChartGrid({
  series,
  threshold,
  thresholdMode,
  summary,
  provenance,
  ariaLabel,
}: {
  series: TrendSeries[];
  threshold?: number;
  thresholdMode?: 'below' | 'above';
  summary: (s: TrendSeries) => SummaryOut;
  provenance?: (farmId: string) => ProvenanceChip | null;
  ariaLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {series.map((s, idx) => {
        const farm = farms[idx];
        const sum = summary(s);
        const prov = provenance?.(farm.farmId) ?? null;
        return (
          <Card key={s.id} className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
              <div className="min-w-0">
                <CardTitle>{s.label}</CardTitle>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {farm.farmId} · {farm.cropType}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={sum.badge}>{sum.text}</Badge>
                {prov && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0 font-mono text-[10px] uppercase tracking-wider',
                      prov.real
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-border bg-secondary/60 text-muted-foreground'
                    )}
                    title={`${prov.label} · ${prov.text}`}
                  >
                    {prov.icon}
                    <span className="normal-case tracking-normal text-[10.5px]">{prov.label}</span>
                    <span className="opacity-70">· {prov.text}</span>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <TrendChart
                series={s}
                threshold={threshold}
                thresholdMode={thresholdMode}
                ariaLabel={`${ariaLabel} for ${s.label}`}
              />
              {sum.hint && (
                <p className="mt-2 text-[11.5px] text-muted-foreground">{sum.hint}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Legend({ series }: { series: TrendSeries[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-3">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: s.color ?? 'currentColor' }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function livingDateRange(series: TrendSeries[]): string {
  for (const s of series) {
    if (s.dates && s.dates.length > 0) {
      return `${s.dates[0]} → ${s.dates[s.dates.length - 1]}`;
    }
  }
  return '—';
}
