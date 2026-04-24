'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  const nextLabel = isDark ? 'light' : 'dark';

  return (
    <Button
      variant="glass"
      size="icon"
      aria-label={`Switch to ${nextLabel} mode (currently ${isDark ? 'dark' : 'light'})`}
      aria-pressed={mounted ? isDark : undefined}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-full"
    >
      {mounted ? (
        isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />
      ) : (
        <span className="h-4 w-4" aria-hidden />
      )}
      <span className="sr-only">{mounted ? `Current theme: ${isDark ? 'dark' : 'light'}` : 'Theme'}</span>
    </Button>
  );
}
