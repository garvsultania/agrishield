import * as React from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded border border-border bg-secondary/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground shadow-[inset_0_-1px_0_0_hsl(var(--border))]',
        className
      )}
    >
      {children}
    </kbd>
  );
}
