'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  HomeIcon,
  Layers,
  Leaf,
  Satellite,
  Wallet,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

const items: NavItem[] = [
  { href: '/', icon: <HomeIcon className="h-4 w-4" aria-hidden />, label: 'Overview' },
  { href: '/map', icon: <Satellite className="h-4 w-4" aria-hidden />, label: 'Satellite map' },
  { href: '/farms', icon: <Leaf className="h-4 w-4" aria-hidden />, label: 'Farms' },
  { href: '/pools', icon: <Layers className="h-4 w-4" aria-hidden />, label: 'Pools' },
  { href: '/payouts', icon: <Activity className="h-4 w-4" aria-hidden />, label: 'Payouts' },
  { href: '/analytics', icon: <BarChart3 className="h-4 w-4" aria-hidden />, label: 'Analytics' },
  { href: '/wallet', icon: <Wallet className="h-4 w-4" aria-hidden />, label: 'Wallet' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary"
      className="fixed left-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-1 rounded-full glass p-1.5 md:flex"
    >
      {items.map((item) => {
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                  isActive
                    ? 'bg-primary/15 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full ring-2 ring-primary/40"
                  />
                )}
                {item.icon}
                <span className="sr-only">{item.label}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </aside>
  );
}
