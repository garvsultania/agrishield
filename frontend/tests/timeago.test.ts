import { describe, it, expect } from 'vitest';
import { timeAgo } from '@/lib/timeago';

const BASE = new Date('2026-04-24T12:00:00Z').getTime();

describe('timeAgo()', () => {
  it('returns "Just now" for sub-10-second diffs', () => {
    expect(timeAgo(BASE - 3_000, BASE)).toBe('Just now');
    expect(timeAgo(BASE, BASE)).toBe('Just now');
  });

  it('renders seconds for sub-minute diffs', () => {
    expect(timeAgo(BASE - 30_000, BASE)).toBe('30s ago');
  });

  it('renders minutes for sub-hour diffs', () => {
    expect(timeAgo(BASE - 5 * 60_000, BASE)).toBe('5m ago');
    expect(timeAgo(BASE - 59 * 60_000, BASE)).toBe('59m ago');
  });

  it('renders hours for sub-day diffs', () => {
    expect(timeAgo(BASE - 3 * 3_600_000, BASE)).toBe('3h ago');
  });

  it('renders days for sub-week diffs', () => {
    expect(timeAgo(BASE - 3 * 86_400_000, BASE)).toBe('3d ago');
  });

  it('falls back to an absolute date for older times', () => {
    const thirtyDays = BASE - 30 * 86_400_000;
    const out = timeAgo(thirtyDays, BASE);
    expect(out).not.toMatch(/ago/);
    expect(out.length).toBeGreaterThan(5);
  });

  it('handles future timestamps gracefully', () => {
    expect(timeAgo(BASE + 5_000, BASE)).toBe('In the future');
  });
});
