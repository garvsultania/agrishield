'use client';

import * as React from 'react';

export function MapLegend() {
  return (
    <div
      role="figure"
      aria-label="Map legend"
      className="absolute bottom-3 right-3 z-[400] flex flex-col gap-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-[11px] backdrop-blur-md shadow-lg"
    >
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Legend
      </span>
      <LegendRow color="#84cc16" border="#ecfccb" label="Healthy" />
      <LegendRow color="#ef4444" border="#fecaca" label="Drought" />
      <LegendRow color="currentColor" border="transparent" opacity={0.3} label="Selected (bolder outline)" />
    </div>
  );
}

function LegendRow({
  color,
  border,
  label,
  opacity = 0.55,
}: {
  color: string;
  border: string;
  label: string;
  opacity?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-3 w-4 rounded-sm"
        style={{ backgroundColor: color, opacity, borderColor: border, borderWidth: 1, borderStyle: 'solid' }}
      />
      <span className="text-foreground">{label}</span>
    </div>
  );
}
