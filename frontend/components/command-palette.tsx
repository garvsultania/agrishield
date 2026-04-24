'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Activity,
  BarChart3,
  HelpCircle,
  HomeIcon,
  Layers,
  Leaf,
  Moon,
  RefreshCw,
  Satellite,
  Sun,
  Wallet,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Kbd } from '@/components/ui/kbd';
import { farms } from '@/lib/farms-data';
import { useDashboard } from '@/components/dashboard-provider';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenHelp: () => void;
}

/**
 * ⌘K command palette. Searchable over routes, farms, and quick actions.
 */
export function CommandPalette({ open, onOpenChange, onOpenHelp }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { refetch } = useDashboard();

  const go = React.useCallback(
    (href: string) => {
      router.push(href);
      onOpenChange(false);
    },
    [router, onOpenChange]
  );

  const runFarm = React.useCallback(
    (farmId: string) => {
      router.push(`/map?farm=${farmId}`);
      onOpenChange(false);
    },
    [router, onOpenChange]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="mx-auto max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-b-2xl p-0 sm:mt-16 md:max-w-xl">
        <SheetTitle className="sr-only">Command palette</SheetTitle>
        <Command label="Command palette" className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <span className="text-muted-foreground" aria-hidden>
              ⌘
            </span>
            <Command.Input
              autoFocus
              placeholder="Search routes, farms, actions…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
              No matches.
            </Command.Empty>

            <Command.Group heading="Pages">
              <PaletteItem icon={<HomeIcon className="h-3.5 w-3.5" />} label="Overview" onSelect={() => go('/')} />
              <PaletteItem icon={<Satellite className="h-3.5 w-3.5" />} label="Satellite map" onSelect={() => go('/map')} />
              <PaletteItem icon={<Leaf className="h-3.5 w-3.5" />} label="Farms" onSelect={() => go('/farms')} />
              <PaletteItem icon={<Layers className="h-3.5 w-3.5" />} label="Pools" onSelect={() => go('/pools')} />
              <PaletteItem icon={<Activity className="h-3.5 w-3.5" />} label="Payouts" onSelect={() => go('/payouts')} />
              <PaletteItem icon={<BarChart3 className="h-3.5 w-3.5" />} label="Analytics" onSelect={() => go('/analytics')} />
              <PaletteItem icon={<Wallet className="h-3.5 w-3.5" />} label="Wallet" onSelect={() => go('/wallet')} />
            </Command.Group>

            <Command.Group heading="Farms">
              {farms.map((f) => (
                <PaletteItem
                  key={f.farmId}
                  icon={<Leaf className="h-3.5 w-3.5" />}
                  label={`${f.farmerName}`}
                  hint={`${f.farmId} · ${f.cropType}`}
                  keywords={[f.farmId, f.cropType, f.farmerName]}
                  onSelect={() => runFarm(f.farmId)}
                />
              ))}
            </Command.Group>

            <Command.Group heading="Actions">
              <PaletteItem
                icon={resolvedTheme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                onSelect={() => {
                  setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
                  onOpenChange(false);
                }}
              />
              <PaletteItem
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label="Refresh farm data"
                onSelect={() => {
                  refetch();
                  onOpenChange(false);
                }}
              />
              <PaletteItem
                icon={<HelpCircle className="h-3.5 w-3.5" />}
                label="Open help & glossary"
                onSelect={() => {
                  onOpenChange(false);
                  onOpenHelp();
                }}
              />
            </Command.Group>
          </Command.List>
        </Command>
      </SheetContent>
    </Sheet>
  );
}

function PaletteItem({
  icon,
  label,
  hint,
  keywords,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  keywords?: string[];
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      value={label + ' ' + (keywords?.join(' ') ?? '')}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="font-mono text-[11px] text-muted-foreground">{hint}</span>}
    </Command.Item>
  );
}
