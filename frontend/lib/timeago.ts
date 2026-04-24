/**
 * Render a relative-time string like "2m ago", "Just now", "3h ago".
 * Returns absolute date for anything older than a week.
 */
export function timeAgo(fromMs: number, nowMs: number = Date.now()): string {
  const diffSec = Math.round((nowMs - fromMs) / 1000);
  if (diffSec < 0) return 'In the future';
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(fromMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
