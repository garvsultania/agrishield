'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  HelpCircle,
  HomeIcon,
  Layers,
  Leaf,
  Menu,
  Satellite,
  Wallet,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', icon: HomeIcon, label: 'Overview' },
  { href: '/map', icon: Satellite, label: 'Satellite map' },
  { href: '/farms', icon: Leaf, label: 'Farms' },
  { href: '/pools', icon: Layers, label: 'Pools' },
  { href: '/payouts', icon: Activity, label: 'Payouts' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
];

interface MobileNavProps {
  onOpenHelp?: () => void;
}

export function MobileNav({ onOpenHelp }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="glass" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-5">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Jump to any section of the dashboard.</SheetDescription>
        </SheetHeader>
        <Separator className="my-4" />
        <nav>
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {onOpenHelp && (
          <>
            <Separator className="my-4" />
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                onOpenHelp();
              }}
            >
              <HelpCircle className="h-4 w-4" />
              Help &amp; glossary
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
