'use client';

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboard } from '@/components/dashboard-provider';
import { cn } from '@/lib/utils';

/**
 * Compact health indicator. Dot color maps to the aggregated snapshot:
 *   green  — everything reachable
 *   amber  — at least one upstream degraded
 *   red    — upstream unreachable / contract unconfigured
 *   gray   — not yet checked
 */
export function SystemHealthBadge() {
  const { systemHealth } = useDashboard();

  if (!systemHealth) {
    return <StatusDot tone="gray" label="Checking system…" details={null} />;
  }

  const tone = systemHealth.ok
    ? 'green'
    : systemHealth.horizon.ok && systemHealth.sorobanRpc.ok
    ? 'amber'
    : 'red';

  const label = tone === 'green' ? 'All systems nominal' : tone === 'amber' ? 'Degraded' : 'System issue';

  return (
    <StatusDot
      tone={tone}
      label={label}
      details={
        <div className="space-y-1.5">
          <Row label="Horizon" ok={systemHealth.horizon.ok} latency={systemHealth.horizon.latencyMs} />
          <Row label="Soroban RPC" ok={systemHealth.sorobanRpc.ok} latency={systemHealth.sorobanRpc.latencyMs} />
          <Row
            label="Admin balance"
            ok={systemHealth.admin.ok}
            extra={systemHealth.admin.ok ? `${systemHealth.admin.xlm.toFixed(2)} XLM` : systemHealth.admin.error}
          />
          <Row
            label="Contract"
            ok={systemHealth.contract.configured}
            extra={systemHealth.contract.configured ? 'configured' : 'not set'}
          />
          <div className="pt-1 text-[10px] text-muted-foreground">
            Checked {new Date(systemHealth.checkedAt).toLocaleTimeString()}
          </div>
        </div>
      }
    />
  );
}

function StatusDot({
  tone,
  label,
  details,
}: {
  tone: 'green' | 'amber' | 'red' | 'gray';
  label: string;
  details: React.ReactNode;
}) {
  const dotClass = {
    green: 'bg-success',
    amber: 'bg-warn',
    red: 'bg-destructive',
    gray: 'bg-muted-foreground/40',
  }[tone];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full glass"
        >
          <span className="relative flex h-2.5 w-2.5">
            {tone === 'green' && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/40" />
            )}
            <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', dotClass)} />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="font-semibold">{label}</div>
        {details}
      </TooltipContent>
    </Tooltip>
  );
}

function Row({
  label,
  ok,
  latency,
  extra,
}: {
  label: string;
  ok: boolean;
  latency?: number;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-success' : 'bg-destructive')}
      />
      <span className="text-foreground">{label}</span>
      <span className="ml-auto font-mono text-muted-foreground">
        {ok ? (latency !== undefined ? `${latency}ms` : extra) : (extra || 'down')}
      </span>
    </div>
  );
}
