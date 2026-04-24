'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Clock, ExternalLink } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusCard } from '@/components/status-card';
import { TriggerButton } from '@/components/trigger-button';
import { useDashboard } from '@/components/dashboard-provider';
import { farms } from '@/lib/farms-data';
import { truncateAddress } from '@/lib/utils';
import { timeAgo } from '@/lib/timeago';
import type { SimulationResult } from '@/lib/types';

interface FarmDetailDrawerProps {
  farmId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (farmId: string) => void;
}

export function FarmDetailDrawer({
  farmId,
  open,
  onOpenChange,
  onNavigate,
}: FarmDetailDrawerProps) {
  const { statuses, errors, recordPayout, getLastPayout } = useDashboard();
  const index = farmId ? farms.findIndex((f) => f.farmId === farmId) : -1;
  const farm = index >= 0 ? farms[index] : null;
  const status = farmId ? statuses[farmId] : undefined;
  const error = farmId ? errors[farmId] : undefined;
  const lastPayout = farmId ? getLastPayout(farmId) : undefined;

  const [announcement, setAnnouncement] = React.useState('');

  const handleSuccess = React.useCallback(
    (result: SimulationResult) => {
      recordPayout(result);
      setAnnouncement(
        `Payout triggered for ${result.farmerName}. Transaction hash ${result.txHash.slice(0, 10)}.`
      );
    },
    [recordPayout]
  );

  const gotoNeighbor = (dir: -1 | 1) => {
    if (index < 0) return;
    const next = (index + dir + farms.length) % farms.length;
    onNavigate?.(farms[next].farmId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>

        {farm ? (
          <div className="flex h-full flex-col">
            {/* Title strip */}
            <div className="border-b border-border/60 px-5 py-4">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="truncate">{farm.farmerName}</SheetTitle>
                  <Badge variant="outline" className="ml-auto shrink-0 capitalize">
                    {farm.cropType}
                  </Badge>
                </div>
                <SheetDescription className="font-mono text-[11px] text-muted-foreground">
                  {farm.farmId} · {truncateAddress(farm.walletAddress, 5, 5)}
                </SheetDescription>
              </SheetHeader>

              {onNavigate && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-secondary/40 p-0.5">
                    <button
                      onClick={() => gotoNeighbor(-1)}
                      aria-label="Previous farm"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => gotoNeighbor(1)}
                      aria-label="Next farm"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {index + 1} / {farms.length}
                  </span>
                </div>
              )}
            </div>

            {/* Status body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {error ? (
                <p className="rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-xs text-warn">
                  {error}
                </p>
              ) : (
                <StatusCard
                  farm={farm}
                  evaluation={status?.evaluation}
                  ndvi={status?.ndvi}
                  rainfall_mm={status?.rainfall_mm}
                  source={status?.source}
                  ndviSource={status?.ndvi_source}
                  rainfallSource={status?.rainfall_source}
                  provenance={status?.provenance}
                />
              )}

              {/* Recipient block — compact inline meta, no full separator */}
              <div className="mt-5 space-y-2">
                <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Recipient
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="break-all font-mono text-[11px] text-foreground">
                      {farm.walletAddress}
                    </span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${farm.walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open recipient on stellar.expert"
                      className="shrink-0 text-muted-foreground transition hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Action rail — sticky, always visible */}
            <div className="border-t border-border/60 bg-background/60 px-5 py-3 backdrop-blur-sm">
              {lastPayout && (
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-success">
                  <Clock className="h-3 w-3" aria-hidden />
                  Last payout {timeAgo(lastPayout.triggeredAt)}
                </div>
              )}
              <TriggerButton farmId={farm.farmId} onSuccess={handleSuccess} />
            </div>
          </div>
        ) : (
          <div className="p-5">
            <SheetHeader>
              <SheetTitle>No farm selected</SheetTitle>
            </SheetHeader>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
