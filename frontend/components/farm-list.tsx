'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn, formatNdvi } from '@/lib/utils';
import { StatusPill, getFarmStatusTone } from '@/components/ui/status-pill';
import type { Farm, FarmStatusResponse } from '@/lib/types';

interface FarmListProps {
  farms: Farm[];
  farmStatuses: Record<string, FarmStatusResponse | undefined>;
  fetchErrors: Record<string, string>;
  selectedFarmId: string | null;
  onSelect: (farmId: string) => void;
}

export function FarmList({
  farms,
  farmStatuses,
  fetchErrors,
  selectedFarmId,
  onSelect,
}: FarmListProps) {
  return (
    <ul className="flex flex-col gap-1" role="list">
      {farms.map((farm) => {
        const status = farmStatuses[farm.farmId];
        const error = fetchErrors[farm.farmId];
        const tone = getFarmStatusTone({ status: status?.status, error, loading: !status && !error });
        const isSelected = farm.farmId === selectedFarmId;

        return (
          <li key={farm.farmId}>
            <button
              onClick={() => onSelect(farm.farmId)}
              aria-current={isSelected ? 'true' : undefined}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isSelected
                  ? 'bg-accent/70 border-border/70 shadow-sm'
                  : 'hover:bg-accent/40'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {farm.farmerName}
                </div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {farm.farmId} · {farm.cropType}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="num font-mono text-xs text-muted-foreground" aria-hidden>
                  {formatNdvi(status?.ndvi)}
                </span>
                <StatusPill tone={tone} compact />
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
