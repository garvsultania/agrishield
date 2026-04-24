import { describe, it, expect } from 'vitest';
import { cn, truncateAddress, formatNdvi, formatRainfall } from '@/lib/utils';

describe('cn()', () => {
  it('merges class names and deduplicates Tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });

  it('accepts conditional object syntax via clsx', () => {
    expect(cn({ foo: true, bar: false }, 'baz')).toBe('foo baz');
  });
});

describe('truncateAddress()', () => {
  it('returns empty string for empty input', () => {
    expect(truncateAddress('')).toBe('');
  });

  it('returns the address unchanged when shorter than head+tail+ellipsis', () => {
    expect(truncateAddress('GSHORT', 4, 4)).toBe('GSHORT');
  });

  it('truncates long addresses with an ellipsis', () => {
    const addr = 'GDU34N2INDZ2OZS5LLKJFKQGNWT2RIIXJZLYMRVQ44DB4TCFMO56SWG3';
    const truncated = truncateAddress(addr, 6, 4);
    expect(truncated).toBe('GDU34N…SWG3');
    expect(truncated).toContain('…');
  });
});

describe('formatNdvi()', () => {
  it('renders an em-dash for undefined or NaN', () => {
    expect(formatNdvi(undefined)).toBe('—');
    expect(formatNdvi(NaN)).toBe('—');
  });

  it('formats numbers to 3 decimal places', () => {
    expect(formatNdvi(0.21789)).toBe('0.218');
    expect(formatNdvi(0.5)).toBe('0.500');
    expect(formatNdvi(1)).toBe('1.000');
  });
});

describe('formatRainfall()', () => {
  it('returns an em-dash for undefined', () => {
    expect(formatRainfall(undefined)).toBe('—');
  });

  it('renders one decimal + unit', () => {
    expect(formatRainfall(3.14)).toBe('3.1mm');
    expect(formatRainfall(0)).toBe('0.0mm');
  });
});
