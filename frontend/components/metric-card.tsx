'use client';

import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MiniChart } from '@/components/mini-chart';

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'glass' | 'lime' | 'violet';
  decoration?: 'waves' | 'dots' | null;
  spark?: {
    points: number[];
    kind?: 'bar' | 'line';
    ariaLabel?: string;
    threshold?: number;
  };
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'glass',
  decoration = null,
  spark,
  className,
  onClick,
}: MetricCardProps) {
  const toneClass =
    tone === 'lime' ? 'lime-card' : tone === 'violet' ? 'violet-card' : 'glass';

  const hintColor = tone === 'glass' ? 'text-muted-foreground' : 'text-current opacity-75';
  const clickable = Boolean(onClick);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-4 shadow-sm transition-shadow',
        toneClass,
        clickable && 'cursor-pointer hover:shadow-xl',
        className
      )}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {decoration === 'waves' && (
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 opacity-20"
          viewBox="0 0 160 160"
          fill="none"
        >
          {[60, 80, 100, 120, 140].map((r) => (
            <circle
              key={r}
              cx="160"
              cy="0"
              r={r}
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          ))}
        </svg>
      )}
      {decoration === 'dots' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
            {label}
          </div>
          <div className="mt-0.5 text-[26px] font-semibold leading-none tracking-tight num">
            {value}
          </div>
          {hint && <div className={cn('mt-1 text-[11.5px]', hintColor)}>{hint}</div>}
        </div>
        <button
          type="button"
          aria-label={`Open ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/30 text-current backdrop-blur transition hover:bg-background/40"
        >
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      {spark && spark.points.length > 0 && (
        <div className="relative mt-3 -mx-1">
          <MiniChart
            points={spark.points}
            kind={spark.kind ?? 'bar'}
            threshold={spark.threshold}
            label={spark.ariaLabel ?? `${label} trend`}
            width={220}
            height={32}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
