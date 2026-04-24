'use client';

import * as React from 'react';
import { Droplets, Droplet, Leaf, LayoutGrid } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { PageHeader } from '@/components/page-header';
import { TrendChart, type TrendSeries } from '@/components/trend-chart';

import { farms } from '@/lib/farms-data';
import { getHistory } from '@/lib/historical-data';
import { NDVI_THRESHOLD, RAINFALL_THRESHOLD_MM, OBSERVATION_WINDOW_DAYS } from '@/lib/env';

const palette = [
  'hsl(var(--lime))',
  'hsl(var(--violet))',
  'hsl(215 91% 60%)',
  'hsl(32 100% 60%)',
  'hsl(340 82% 65%)',
];

export default function AnalyticsPage() {
  const perFarmNdvi: TrendSeries[] = farms.map((farm, idx) => {
    const history = getHistory(farm.farmId);
    return {
      id: farm.farmId,
      label: farm.farmerName,
      points: history.map((o) => o.ndvi),
      dates: history.map((o) => o.date),
      color: palette[idx % palette.length],
    };
  });

  const perFarmRain: TrendSeries[] = farms.map((farm, idx) => {
    const history = getHistory(farm.farmId);
    return {
      id: farm.farmId,
      label: farm.farmerName,
      points: history.map((o) => o.rainfall_mm),
      dates: history.map((o) => o.date),
      color: palette[idx % palette.length],
    };
  });

  const perFarmSoil: TrendSeries[] = farms.map((farm, idx) => {
    const history = getHistory(farm.farmId);
    return {
      id: farm.farmId,
      label: farm.farmerName,
      points: history.map((o) => o.soil_moisture),
      dates: history.map((o) => o.date),
      color: palette[idx % palette.length],
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title={`${OBSERVATION_WINDOW_DAYS}-day observation window`}
        description="Raw NDVI, rainfall, and soil moisture per farm. Threshold breaches are highlighted red. Hover any chart to read the exact value."
      />

      <Tabs defaultValue="ndvi" className="w-full">
        <div className="mb-4 flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="ndvi">
              <Leaf className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              NDVI
            </TabsTrigger>
            <TabsTrigger value="rain">
              <Droplets className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Rainfall
            </TabsTrigger>
            <TabsTrigger value="soil">
              <Droplet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Soil
            </TabsTrigger>
            <TabsTrigger value="overlay">
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Compare
            </TabsTrigger>
          </TabsList>
          <Badge variant="outline">14 day rolling</Badge>
        </div>

        <TabsContent value="ndvi">
          <ChartGrid
            ariaLabel="NDVI per farm"
            threshold={NDVI_THRESHOLD}
            thresholdMode="below"
            series={perFarmNdvi}
            summary={(s) => {
              const avg = s.points.reduce((a, b) => a + b, 0) / Math.max(s.points.length, 1);
              const breach = s.points.every((v) => v < NDVI_THRESHOLD);
              return {
                badge: breach ? 'danger' : 'success',
                text: `avg ${avg.toFixed(3)}`,
              };
            }}
          />
        </TabsContent>

        <TabsContent value="rain">
          <ChartGrid
            ariaLabel="Rainfall per farm"
            threshold={RAINFALL_THRESHOLD_MM}
            thresholdMode="below"
            series={perFarmRain}
            summary={(s) => {
              const total = s.points.reduce((a, b) => a + b, 0);
              const dry = s.points.every((v) => v < RAINFALL_THRESHOLD_MM);
              return {
                badge: dry ? 'danger' : 'success',
                text: `${total.toFixed(1)}mm total`,
              };
            }}
          />
        </TabsContent>

        <TabsContent value="soil">
          <ChartGrid
            ariaLabel="Soil moisture per farm"
            series={perFarmSoil}
            summary={(s) => {
              const avg = s.points.reduce((a, b) => a + b, 0) / Math.max(s.points.length, 1);
              return {
                badge: avg < 0.1 ? 'danger' : avg < 0.15 ? 'warn' : 'success',
                text: `avg ${avg.toFixed(3)}`,
              };
            }}
          />
        </TabsContent>

        <TabsContent value="overlay">
          <section className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>All farms · NDVI overlay</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Threshold <span className="font-mono">{NDVI_THRESHOLD}</span>. Hover to read values.
                </p>
              </CardHeader>
              <CardContent>
                <TrendChart
                  series={perFarmNdvi}
                  threshold={NDVI_THRESHOLD}
                  thresholdMode="below"
                  height={240}
                  ariaLabel="NDVI overlay across all farms"
                />
                <Legend series={perFarmNdvi} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All farms · Rainfall overlay</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Threshold <span className="font-mono">{RAINFALL_THRESHOLD_MM}mm</span> (daily).
                </p>
              </CardHeader>
              <CardContent>
                <TrendChart
                  series={perFarmRain}
                  threshold={RAINFALL_THRESHOLD_MM}
                  thresholdMode="below"
                  height={240}
                  ariaLabel="Rainfall overlay across all farms"
                />
                <Legend series={perFarmRain} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ChartGrid({
  series,
  threshold,
  thresholdMode,
  summary,
  ariaLabel,
}: {
  series: TrendSeries[];
  threshold?: number;
  thresholdMode?: 'below' | 'above';
  summary: (s: TrendSeries) => { badge: 'success' | 'danger' | 'warn'; text: string };
  ariaLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {series.map((s, idx) => {
        const farm = farms[idx];
        const sum = summary(s);
        return (
          <Card key={s.id} className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle>{s.label}</CardTitle>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {farm.farmId} · {farm.cropType}
                </p>
              </div>
              <Badge variant={sum.badge}>{sum.text}</Badge>
            </CardHeader>
            <CardContent>
              <TrendChart
                series={s}
                threshold={threshold}
                thresholdMode={thresholdMode}
                ariaLabel={`${ariaLabel} for ${s.label}`}
              />
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
