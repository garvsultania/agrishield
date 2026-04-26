'use client';

import * as React from 'react';
import dynamicImport from 'next/dynamic';
import { Satellite } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { PageHeader } from '@/components/page-header';
import { FarmList } from '@/components/farm-list';
import { FarmDetailDrawer } from '@/components/farm-detail-drawer';
import { MapLegend } from '@/components/map-legend';
import { LiveRelativeTime } from '@/components/live-relative-time';

import { farms } from '@/lib/farms-data';
import { useDashboard } from '@/components/dashboard-provider';
import { useFarmUrlSync } from '@/components/use-farm-url-sync';

const FarmMap = dynamicImport(() => import('@/components/farm-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
      Loading satellite imagery…
    </div>
  ),
});

export default function MapPage() {
  // useSearchParams (called inside useFarmUrlSync) requires a Suspense
  // boundary to satisfy Next 14's static-prerender bail-out check.
  return (
    <React.Suspense fallback={null}>
      <MapPageInner />
    </React.Suspense>
  );
}

function MapPageInner() {
  const { statuses, errors, loading, lastUpdated } = useDashboard();
  const { selectedFarmId, openFarm, closeFarm } = useFarmUrlSync();
  const drawerOpen = Boolean(selectedFarmId);

  return (
    <>
      <PageHeader
        eyebrow="Map"
        title="Satellite view"
        description="ESRI World Imagery over Sitapur. Click a farm polygon or keyboard-focus the map and press Enter to open its drawer."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Satellite className="h-3 w-3" aria-hidden />
              Mock · 14-day window
            </Badge>
            <LiveRelativeTime
              timestamp={lastUpdated}
              prefix="Synced"
              className="hidden text-xs text-muted-foreground sm:inline"
            />
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="h-[560px] p-2 md:p-3">
            <div className="relative h-full overflow-hidden rounded-xl border border-border/60">
              <FarmMap
                farms={farms}
                farmStatuses={statuses}
                selectedFarmId={selectedFarmId}
                onFarmSelect={openFarm}
              />
              <MapLegend />
            </div>
          </div>
        </Card>

        <Card className="flex max-h-[560px] flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Farms</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {farms.length} monitored · click a row to inspect
              </p>
            </div>
            {loading && <span className="animate-pulse text-[11px] text-muted-foreground">loading…</span>}
          </CardHeader>
          <CardContent className="overflow-y-auto">
            <FarmList
              farms={farms}
              farmStatuses={statuses}
              fetchErrors={errors}
              selectedFarmId={selectedFarmId}
              onSelect={openFarm}
            />
          </CardContent>
        </Card>
      </section>

      <FarmDetailDrawer
        farmId={selectedFarmId}
        open={drawerOpen}
        onOpenChange={(open) => (open ? undefined : closeFarm())}
        onNavigate={openFarm}
      />
    </>
  );
}
