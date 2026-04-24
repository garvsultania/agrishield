'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface NdviSparklineProps {
  values: number[]; // NDVI per farm
  className?: string;
  threshold?: number;
}

/**
 * Purely decorative sparkline — plots supplied NDVI values across a horizontal axis.
 * No external charting dependency; SVG only.
 */
export function NdviSparkline({ values, className, threshold = 0.35 }: NdviSparklineProps) {
  if (!values || values.length === 0) {
    return <div className={cn('h-16 shimmer rounded-xl', className)} />;
  }

  const w = 260;
  const h = 64;
  const padding = 6;
  const max = Math.max(0.8, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = padding + (i * (w - padding * 2)) / Math.max(values.length - 1, 1);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return [x, y] as const;
  });

  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1][0]} ${h - padding} L ${pts[0][0]} ${h - padding} Z`;

  const thresholdY = h - padding - ((threshold - min) / range) * (h - padding * 2);

  return (
    <svg
      className={cn('w-full', className)}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ndvi-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--lime))" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(var(--lime))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* threshold line */}
      <line
        x1={padding}
        x2={w - padding}
        y1={thresholdY}
        y2={thresholdY}
        stroke="hsl(var(--destructive))"
        strokeDasharray="3 3"
        strokeOpacity="0.4"
      />
      <path d={area} fill="url(#ndvi-fill)" />
      <path d={path} stroke="hsl(var(--lime))" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={values[i] < threshold ? 3 : 2} fill={values[i] < threshold ? 'hsl(var(--destructive))' : 'hsl(var(--lime))'} />
      ))}
    </svg>
  );
}
