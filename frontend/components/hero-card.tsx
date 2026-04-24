'use client';

import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface HeroCardProps {
  totalFarms: number;
  droughtCount: number;
  monitoredAreaKm2: number;
}

export function HeroCard({ totalFarms, droughtCount, monitoredAreaKm2 }: HeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl hero-gradient p-5 shadow-glass md:p-6">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <div className="mb-5 max-w-[18ch]">
          <h2 className="text-[22px] font-medium leading-[1.15] tracking-tight md:text-[26px]">
            Hi Oracle,
            <br />
            <span className="font-display italic font-normal">here&apos;s your drought watch.</span>
          </h2>
        </div>

        <div className="mb-4 inline-flex items-center gap-2">
          <span className="rounded-full bg-lime px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-lime-foreground shadow-[0_8px_24px_-8px_hsl(var(--lime)/0.7)]">
            14-day window
          </span>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
            Sitapur · UP
          </span>
        </div>

        <div className="mt-auto">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-white/70">
            Currently monitored
          </p>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-semibold tracking-tight num md:text-5xl">
              {totalFarms}
              <span className="text-2xl text-white/60"> farms</span>
            </span>
          </div>
          <p className="mt-2 text-sm text-white/80">
            <span className="font-semibold text-white">
              {monitoredAreaKm2.toFixed(2)} km²
            </span>{' '}
            across the district · <span className="font-semibold text-white">{droughtCount} in drought</span>
          </p>
        </div>

        <a
          href="/map"
          aria-label="Open satellite map"
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </div>
  );
}
