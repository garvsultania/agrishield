import * as React from 'react';
import { AlertTriangle, Check, Circle, Clock, Coins, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusTone =
  | 'drought'
  | 'healthy'
  | 'armed'
  | 'paid'
  | 'loading'
  | 'error'
  | 'unknown';

interface StatusPillProps {
  tone: StatusTone;
  label?: string;
  compact?: boolean;
  className?: string;
}

const config: Record<StatusTone, { label: string; icon: React.ReactNode; classes: string }> = {
  drought: {
    label: 'Drought',
    icon: <AlertTriangle className="h-3 w-3" aria-hidden />,
    classes:
      'border-destructive/30 bg-destructive/10 text-destructive',
  },
  healthy: {
    label: 'Healthy',
    icon: <Leaf className="h-3 w-3" aria-hidden />,
    classes: 'border-success/30 bg-success/10 text-success',
  },
  armed: {
    label: 'Armed',
    icon: <Circle className="h-3 w-3" aria-hidden />,
    classes:
      'border-border bg-secondary/60 text-muted-foreground',
  },
  paid: {
    label: 'Paid',
    icon: <Coins className="h-3 w-3" aria-hidden />,
    classes:
      'border-success/40 bg-success/15 text-success',
  },
  loading: {
    label: 'Loading',
    icon: <Clock className="h-3 w-3 animate-pulse" aria-hidden />,
    classes: 'border-border bg-secondary/40 text-muted-foreground',
  },
  error: {
    label: 'Error',
    icon: <AlertTriangle className="h-3 w-3" aria-hidden />,
    classes: 'border-warn/30 bg-warn/10 text-warn',
  },
  unknown: {
    label: '—',
    icon: <Circle className="h-3 w-3" aria-hidden />,
    classes: 'border-border bg-secondary/40 text-muted-foreground',
  },
};

export function StatusPill({ tone, label, compact, className }: StatusPillProps) {
  const c = config[tone];
  return (
    <span
      role="status"
      aria-label={label ?? c.label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em]',
        compact && 'px-1.5 py-0 text-[9.5px] tracking-widest',
        c.classes,
        className
      )}
    >
      {c.icon}
      <span>{label ?? c.label}</span>
    </span>
  );
}

export function getFarmStatusTone(input: {
  status?: 'drought' | 'healthy' | 'unknown';
  error?: string;
  loading?: boolean;
}): StatusTone {
  if (input.error) return 'error';
  if (input.loading) return 'loading';
  if (input.status === 'drought') return 'drought';
  if (input.status === 'healthy') return 'healthy';
  return 'unknown';
}
