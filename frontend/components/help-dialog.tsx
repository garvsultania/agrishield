'use client';

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Kbd } from '@/components/ui/kbd';
import { Button } from '@/components/ui/button';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const glossary: Array<{ term: string; body: string }> = [
  {
    term: 'Parametric insurance',
    body: 'Policies that pay out when a measurable index (NDVI, rainfall) crosses a defined threshold — no loss adjuster, no paperwork. AgriShield triggers when both indices breach.',
  },
  {
    term: 'NDVI',
    body: 'Normalized Difference Vegetation Index. 0.0 = bare soil, 0.8+ = dense canopy. Below 0.35 for 14 consecutive days signals drought-stressed crop.',
  },
  {
    term: 'Observation window',
    body: 'The 14-day rolling window the oracle evaluates. Every day in the window must fall below NDVI 0.35 AND under 10mm rainfall to trigger.',
  },
  {
    term: 'Proof of loss',
    body: 'SHA-256 hash of the on-chain audit payload — avg NDVI, avg rainfall, days evaluated, observation window. Emitted as a contract event.',
  },
  {
    term: 'Soroban',
    body: 'Stellar\u2019s smart-contract platform. AgriShield\u2019s parametric_trigger contract holds pool config, emits PAYOUT events, and enforces per-farm double-spend protection.',
  },
  {
    term: 'Pool',
    body: 'Per-farm on-chain config: payout amount (100 XLM), recipient address, admin key. Initialized once at deploy time.',
  },
];

const shortcuts: Array<{ keys: string[]; label: string }> = [
  { keys: ['g', 'o'], label: 'Go to Overview' },
  { keys: ['g', 'm'], label: 'Go to Map' },
  { keys: ['g', 'f'], label: 'Go to Farms' },
  { keys: ['g', 'p'], label: 'Go to Pools' },
  { keys: ['g', 'a'], label: 'Go to Analytics' },
  { keys: ['g', 'w'], label: 'Go to Wallet' },
  { keys: ['g', 'y'], label: 'Go to Payouts' },
  { keys: ['t'], label: 'Toggle theme' },
  { keys: ['?'], label: 'Open help' },
  { keys: ['⌘', 'K'], label: 'Command palette' },
];

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
            <SheetTitle>Help &amp; glossary</SheetTitle>
          </div>
          <SheetDescription>
            Domain terms, shortcuts, and what each part of AgriShield does.
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <section aria-labelledby="help-glossary">
          <h3
            id="help-glossary"
            className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Glossary
          </h3>
          <dl className="space-y-3">
            {glossary.map((item) => (
              <div key={item.term} className="rounded-xl border border-border/60 bg-secondary/40 p-3">
                <dt className="text-sm font-semibold">{item.term}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <Separator className="my-4" />

        <section aria-labelledby="help-shortcuts">
          <h3
            id="help-shortcuts"
            className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Keyboard shortcuts
          </h3>
          <ul className="space-y-1.5">
            {shortcuts.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent/40"
              >
                <span>{s.label}</span>
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Separator className="my-4" />

        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </SheetContent>
    </Sheet>
  );
}
