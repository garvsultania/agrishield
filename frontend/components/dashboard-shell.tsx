'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

import { DashboardHeader } from '@/components/dashboard-header';
import { Sidebar } from '@/components/sidebar';
import { CommandPalette } from '@/components/command-palette';
import { HelpDialog } from '@/components/help-dialog';
import { useKeyboardShortcut, useLeaderSequence } from '@/lib/use-keyboard-shortcut';

const leaderTargets: Record<string, string> = {
  o: '/',
  m: '/map',
  f: '/farms',
  p: '/pools',
  y: '/payouts',
  a: '/analytics',
  w: '/wallet',
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useKeyboardShortcut('?', () => setHelpOpen(true));
  useKeyboardShortcut('t', () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'));

  // ⌘K / Ctrl+K
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useLeaderSequence('g', (key) => {
    const target = leaderTargets[key.toLowerCase()];
    if (target) router.push(target);
  });

  return (
    <>
      <DashboardHeader onOpenPalette={() => setPaletteOpen(true)} onOpenHelp={() => setHelpOpen(true)} />
      <Sidebar />
      <main id="main-content" className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 pb-12 pt-5 md:px-6 md:pl-20">
        {children}
      </main>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
