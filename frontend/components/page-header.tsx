import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-2 flex flex-col gap-3 md:mb-3 md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h2 className="text-[20px] font-semibold tracking-tight md:text-[22px]">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
