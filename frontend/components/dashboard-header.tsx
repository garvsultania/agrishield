'use client';

import * as React from 'react';
import { HelpCircle, RefreshCw, Search, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { LiveRelativeTime } from '@/components/live-relative-time';
import { MobileNav } from '@/components/mobile-nav';
import { SystemHealthBadge } from '@/components/system-health-badge';

import { useDashboard } from '@/components/dashboard-provider';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  onOpenPalette: () => void;
  onOpenHelp: () => void;
}

export function DashboardHeader({ onOpenPalette, onOpenHelp }: DashboardHeaderProps) {
  const { statuses, refetch, loading, lastUpdated } = useDashboard();

  const droughtCount = React.useMemo(
    () => Object.values(statuses).filter((s) => s?.status === 'drought').length,
    [statuses]
  );
  const healthyCount = React.useMemo(
    () => Object.values(statuses).filter((s) => s?.status === 'healthy').length,
    [statuses]
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <MobileNav onOpenHelp={onOpenHelp} />
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime text-lime-foreground">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-semibold tracking-tight">AgriShield</h1>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Parametric drought oracle · Sitapur, UP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <StatusPill tone="drought" label={`${droughtCount} drought`} />
            <StatusPill tone="healthy" label={`${healthyCount} healthy`} />
            <Badge variant="violet" className="hidden md:inline-flex">
              TESTNET · Mock
            </Badge>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="glass"
                size="pill"
                onClick={onOpenPalette}
                className="hidden md:inline-flex"
                aria-label="Open command palette"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-muted-foreground">Search</span>
                <Kbd>⌘K</Kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Command palette</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="glass"
                size="icon"
                aria-label="Refresh farm data"
                onClick={() => refetch()}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex flex-col items-start gap-0.5">
                <span>Refresh</span>
                <LiveRelativeTime timestamp={lastUpdated} className="text-[10px] text-muted-foreground" />
              </div>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="glass" size="icon" onClick={onOpenHelp} aria-label="Help and glossary">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>
                Help <Kbd>?</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>

          <SystemHealthBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
