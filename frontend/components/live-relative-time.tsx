'use client';

import * as React from 'react';
import { timeAgo } from '@/lib/timeago';

/**
 * Renders a live-updating "Nm ago" string. Rerenders once per minute.
 */
export function LiveRelativeTime({
  timestamp,
  prefix = 'Updated',
  fallback = '—',
  className,
}: {
  timestamp: number | null;
  prefix?: string;
  fallback?: string;
  className?: string;
}) {
  const [, force] = React.useState(0);

  React.useEffect(() => {
    if (!timestamp) return;
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [timestamp]);

  if (!timestamp) return <span className={className}>{fallback}</span>;
  return (
    <span className={className} title={new Date(timestamp).toLocaleString()}>
      {prefix} {timeAgo(timestamp)}
    </span>
  );
}
