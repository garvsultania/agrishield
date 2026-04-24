'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TrendSeries {
  id: string;
  label: string;
  points: number[];
  dates?: string[];
  color?: string; // CSS color for the line
}

interface TrendChartProps {
  series: TrendSeries | TrendSeries[];
  threshold?: number;
  thresholdMode?: 'below' | 'above';
  height?: number;
  showDots?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Multi-series SVG chart with hover tooltip + threshold line. Chooses sensible
 * color fallbacks if `color` is omitted. Single-series mode fills the area.
 */
export function TrendChart({
  series,
  threshold,
  thresholdMode = 'below',
  height = 160,
  showDots = true,
  ariaLabel,
  className,
}: TrendChartProps) {
  const seriesArray = Array.isArray(series) ? series : [series];
  const isSingle = seriesArray.length === 1;

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = React.useState<{ x: number; i: number } | null>(null);
  const [viewportW, setViewportW] = React.useState<number>(480);

  React.useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportW(Math.max(200, entry.contentRect.width));
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  if (!seriesArray.length || seriesArray.every((s) => !s.points || s.points.length === 0)) {
    return <div className={cn('h-40 shimmer rounded-xl', className)} aria-hidden />;
  }

  const n = Math.max(...seriesArray.map((s) => s.points.length));
  const allValues = seriesArray.flatMap((s) => s.points);
  const max = Math.max(...allValues, threshold ?? 0) * 1.1 || 1;
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;

  const w = viewportW;
  const h = height;
  const px = 12;
  const py = 14;

  const toCoords = (points: number[]) =>
    points.map((v, i) => {
      const x = px + (i * (w - px * 2)) / Math.max(n - 1, 1);
      const y = h - py - ((v - min) / range) * (h - py * 2);
      return [x, y] as const;
    });

  const defaultColors = [
    'hsl(var(--lime))',
    'hsl(var(--violet))',
    'hsl(215 91% 60%)',
    'hsl(32 100% 60%)',
    'hsl(340 82% 65%)',
  ];

  const thresholdY =
    threshold !== undefined ? h - py - ((threshold - min) / range) * (h - py * 2) : null;

  const isBreach = (v: number) =>
    threshold === undefined
      ? false
      : thresholdMode === 'below'
      ? v < threshold
      : v > threshold;

  const gradientId = `trend-fill-${React.useId()}`;

  const handleMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (!svgRef.current) return;
    const bbox = svgRef.current.getBoundingClientRect();
    const x = e.clientX - bbox.left;
    const relative = Math.max(0, Math.min(1, (x - px) / (w - px * 2)));
    const i = Math.round(relative * (n - 1));
    setHover({ x, i });
  };

  const clearHover = () => setHover(null);

  const firstSeries = seriesArray[0];
  const activeDates = firstSeries.dates || [];

  return (
    <div className={cn('relative w-full', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel ?? 'Trend chart'}
        onMouseMove={handleMove}
        onMouseLeave={clearHover}
        className="cursor-crosshair"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={seriesArray[0].color ?? defaultColors[0]} stopOpacity="0.4" />
            <stop offset="100%" stopColor={seriesArray[0].color ?? defaultColors[0]} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Threshold line */}
        {thresholdY !== null && (
          <g>
            <line
              x1={px}
              x2={w - px}
              y1={thresholdY}
              y2={thresholdY}
              stroke="hsl(var(--destructive))"
              strokeDasharray="3 3"
              strokeOpacity="0.5"
            />
            <text
              x={w - px}
              y={thresholdY - 4}
              textAnchor="end"
              fontSize="10"
              fill="hsl(var(--destructive))"
              opacity="0.75"
              fontFamily="ui-monospace, monospace"
            >
              {threshold}
            </text>
          </g>
        )}

        {/* Area fill only for single-series mode */}
        {isSingle &&
          (() => {
            const pts = toCoords(firstSeries.points);
            if (pts.length === 0) return null;
            const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
            const area = `${d} L ${pts[pts.length - 1][0]} ${h - py} L ${pts[0][0]} ${h - py} Z`;
            return <path d={area} fill={`url(#${gradientId})`} />;
          })()}

        {/* Lines */}
        {seriesArray.map((s, idx) => {
          const pts = toCoords(s.points);
          if (pts.length === 0) return null;
          const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
          const color = s.color ?? defaultColors[idx % defaultColors.length];
          return (
            <g key={s.id}>
              <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {showDots &&
                pts.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={isBreach(s.points[i]) ? 3 : 2}
                    fill={isBreach(s.points[i]) ? 'hsl(var(--destructive))' : color}
                  />
                ))}
            </g>
          );
        })}

        {/* Hover indicator */}
        {hover && (
          <line
            x1={px + (hover.i * (w - px * 2)) / Math.max(n - 1, 1)}
            x2={px + (hover.i * (w - px * 2)) / Math.max(n - 1, 1)}
            y1={py}
            y2={h - py}
            stroke="hsl(var(--foreground))"
            strokeOpacity="0.25"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-md"
          style={{
            left: Math.min(Math.max(0, hover.x - 60), w - 140),
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {activeDates[hover.i] ?? `Day ${hover.i + 1}`}
          </div>
          <ul className="mt-0.5 space-y-0.5">
            {seriesArray.map((s, idx) => {
              const v = s.points[hover.i];
              const color = s.color ?? defaultColors[idx % defaultColors.length];
              if (v === undefined) return null;
              return (
                <li key={s.id} className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="num ml-auto font-mono font-semibold">{v.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Middle date ticks */}
      {activeDates.length > 0 && (
        <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {[0, Math.floor(activeDates.length / 2), activeDates.length - 1].map((i) => (
            <span key={i}>{activeDates[i]}</span>
          ))}
        </div>
      )}
    </div>
  );
}
