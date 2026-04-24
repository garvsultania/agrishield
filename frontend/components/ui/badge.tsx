import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] font-semibold tracking-[0.12em] uppercase transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground border-border bg-background/40',
        success:
          'border-success/30 bg-success/10 text-success dark:bg-success/15',
        danger:
          'border-destructive/30 bg-destructive/10 text-destructive',
        warn: 'border-warn/30 bg-warn/10 text-warn',
        violet:
          'border-violet/30 bg-violet/10 text-violet dark:bg-violet/20',
        lime: 'border-lime/40 bg-lime/15 text-lime-foreground dark:text-lime',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
