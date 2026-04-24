'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface MiniChartProps {
  points: number[];
  kind?: 'bar' | 'line';
  stroke?: string; // CSS color string
  threshold?: number;
  label?: string;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Tiny decorative chart used inside metric cards. Pure SVG, no runtime deps.
 * Supplies an accessible text label via `role="img"` + `aria-label`.
 */
export function MiniChart({
  points,
  kind = 'bar',
  stroke,
  threshold,
  label,
  className,
  width = 96,
  height = 32,
}: MiniChartProps) {
  if (!points || points.length === 0) {
    return <div className={cn('h-8 w-24 shimmer rounded', className)} aria-hidden />;
  }

  const max = Math.max(...points, threshold ?? 0) * 1.1 || 1;
  const min = Math.min(0, ...points);
  const range = max - min || 1;

  const color = stroke || 'currentColor';
  const aria = label ?? 'Trend';

  if (kind === 'bar') {
    const gap = 2;
    const barW = Math.max(1, (width - (points.length - 1) * gap) / points.length);
    return (
      <svg
        className={cn('text-current', className)}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={aria}
      >
        {points.map((v, i) => {
          const h = Math.max(1, ((v - min) / range) * (height - 2));
          const x = i * (barW + gap);
          const y = height - h;
          return <rect key={i} x={x} y={y} width={barW} height={h} fill={color} opacity={0.9} rx={1} />;
        })}
        {threshold !== undefined && (
          <line
            x1={0}
            x2={width}
            y1={height - ((threshold - min) / range) * (height - 2)}
            y2={height - ((threshold - min) / range) * (height - 2)}
            stroke={color}
            strokeDasharray="2 2"
            strokeOpacity={0.5}
          />
        )}
      </svg>
    );
  }

  const mapped = points.map((v, i) => {
    const x = (i * width) / Math.max(points.length - 1, 1);
    const y = height - ((v - min) / range) * (height - 2);
    return [x, y] as const;
  });
  const d = mapped.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  return (
    <svg
      className={cn('text-current', className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={aria}
    >
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </svg>
  );
}
