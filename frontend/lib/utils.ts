import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return '';
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatNdvi(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return n.toFixed(3);
}

export function formatRainfall(mm: number | undefined): string {
  if (mm === undefined || mm === null || Number.isNaN(mm)) return '—';
  return `${mm.toFixed(1)}mm`;
}
