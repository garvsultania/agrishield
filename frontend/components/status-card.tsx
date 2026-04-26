'use client';

import * as React from 'react';
import { AlertTriangle, Check, CloudRain, Database, Leaf, Satellite } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatNdvi, formatRainfall } from '@/lib/utils';
import type {
  Farm,
  DroughtEvaluation,
  DataSource,
  NdviSource,
  RainfallSource,
  ProvenanceSummary,
} from '@/lib/types';

interface StatusCardProps {
  farm: Farm;
  evaluation: DroughtEvaluation | undefined;
  ndvi: number | undefined;
  rainfall_mm: number | undefined;
  source: DataSource | undefined;
  ndviSource?: NdviSource;
  rainfallSource?: RainfallSource;
  provenance?: ProvenanceSummary;
  className?: string;
}

export function StatusCard({
  farm,
  evaluation,
  ndvi,
  rainfall_mm,
  source,
  ndviSource,
  rainfallSource,
  provenance,
  className,
}: StatusCardProps) {
  if (!evaluation) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-14 shimmer rounded-lg" />
        <div className="h-16 shimmer rounded-lg" />
      </div>
    );
  }

  const isDrought = evaluation.triggered;
  const confidence = evaluation.confidence;
  const proof = evaluation.proof_of_loss;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Status + confidence — one row */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border px-3.5 py-2.5',
          isDrought
            ? 'border-destructive/25 bg-destructive/[0.07]'
            : 'border-success/25 bg-success/[0.07]'
        )}
      >
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            isDrought ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'
          )}
        >
          {isDrought ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div
            className={cn(
              'text-[13px] font-semibold tracking-tight',
              isDrought ? 'text-destructive' : 'text-success'
            )}
          >
            {isDrought ? 'Drought detected' : 'Crop healthy'}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground num">
            NDVI {formatNdvi(ndvi)} · Rain {formatRainfall(rainfall_mm)}
          </div>
        </div>
        <Badge
          variant={confidence === 'high' ? 'violet' : confidence === 'medium' ? 'warn' : 'secondary'}
          aria-label={`Confidence: ${confidence}`}
          className="shrink-0"
        >
          {confidence}
        </Badge>
      </div>

      {/* Meta line — inline with middot separators */}
      <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <Meta label="Farmer" value={farm.farmerName} />
        <Divider />
        <Meta label="Crop" value={farm.cropType} mono />
        <Divider />
        <Meta label="Area" value={`${farm.areaSqKm} km²`} mono />
      </dl>

      {/* Provenance chips — per signal, with coverage counts */}
      <div className="flex flex-wrap gap-1.5">
        <ProvenancePill
          icon={<Leaf className="h-3 w-3" />}
          label="NDVI"
          source={ndviSource ?? 'mock'}
          coverage={provenance ? `${provenance.ndvi_real_days}/${provenance.total_days} d` : undefined}
        />
        <ProvenancePill
          icon={<CloudRain className="h-3 w-3" />}
          label="Rain"
          source={rainfallSource ?? 'mock'}
          coverage={provenance ? `${provenance.rainfall_real_days}/${provenance.total_days} d` : undefined}
        />
        {source === 'simulated' && (
          <span className="inline-flex items-center gap-1 rounded-md border border-warn/30 bg-warn/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warn">
            <Database className="h-3 w-3" aria-hidden />
            Simulated window
          </span>
        )}
      </div>

      {/* Reason — small muted paragraph */}
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">{evaluation.reason}</p>

      {/* Proof of loss — horizontal stat strip, only when drought */}
      {isDrought && proof && (
        <section
          aria-label="Proof of loss"
          className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-4 py-3"
        >
          <header className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-destructive">
              Proof of loss
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              SHA-256 signed
            </span>
          </header>
          <dl className="grid grid-cols-4 gap-3">
            <ProofCell label="NDVI avg" value={proof.avg_ndvi.toFixed(3)} />
            <ProofCell label="Rain avg" value={`${proof.avg_rainfall_mm.toFixed(2)}mm`} />
            <ProofCell label="NDVI min" value={proof.min_ndvi.toFixed(3)} />
            <ProofCell label="Days" value={String(proof.days_evaluated)} />
          </dl>
          <div className="mt-2 font-mono text-[10.5px] text-muted-foreground">
            {proof.observation_window?.start} → {proof.observation_window?.end}
          </div>
        </section>
      )}
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn('flex items-center gap-1 font-semibold text-foreground capitalize', mono && 'font-mono text-[11.5px] normal-case')}>
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {value}
      </dd>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-3 w-px bg-border" />;
}

const PROVENANCE_STYLES: Record<string, { cls: string; label: string }> = {
  'sentinel-2': { cls: 'border-success/30 bg-success/10 text-success', label: 'Sentinel-2' },
  'sentinel-2-interp': {
    cls: 'border-success/25 bg-success/5 text-success/90',
    label: 'Sentinel-2 (interp)',
  },
  'open-meteo': { cls: 'border-success/30 bg-success/10 text-success', label: 'Open-Meteo' },
  mock: { cls: 'border-border bg-secondary/60 text-muted-foreground', label: 'Mock' },
};

function ProvenancePill({
  icon,
  label,
  source,
  coverage,
}: {
  icon: React.ReactNode;
  label: string;
  source: string;
  coverage?: string;
}) {
  const style = PROVENANCE_STYLES[source] ?? PROVENANCE_STYLES.mock;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        style.cls
      )}
      title={`${label} source: ${style.label}${coverage ? ` · ${coverage} real` : ''}`}
    >
      <span aria-hidden>{icon}</span>
      <span className="text-[10.5px] font-semibold">{label}</span>
      <span className="opacity-70">· {style.label}</span>
      {coverage && <span className="opacity-70">· {coverage}</span>}
    </span>
  );
}

function ProofCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 font-semibold text-foreground text-[13px]">{value}</dd>
    </div>
  );
}
