import { describe, it, expect, vi } from 'vitest';
import { toCsv, downloadCsv } from '@/lib/csv';

describe('toCsv()', () => {
  it('writes a header row when rows are empty', () => {
    const out = toCsv([], [
      { key: 'a', header: 'A' },
      { key: 'b', header: 'B' },
    ]);
    expect(out).toBe('A,B\n');
  });

  it('serializes simple rows in declared column order', () => {
    const out = toCsv(
      [
        { a: 1, b: 'x' },
        { a: 2, b: 'y' },
      ],
      [
        { key: 'a', header: 'A' },
        { key: 'b', header: 'B' },
      ]
    );
    expect(out).toBe('A,B\n1,x\n2,y\n');
  });

  it('escapes quotes, commas, and newlines', () => {
    const out = toCsv(
      [{ a: 'has,comma', b: 'has"quote', c: 'has\nnewline' }],
      [
        { key: 'a', header: 'A' },
        { key: 'b', header: 'B' },
        { key: 'c', header: 'C' },
      ]
    );
    expect(out).toContain('"has,comma"');
    expect(out).toContain('"has""quote"');
    expect(out).toContain('"has\nnewline"');
  });

  it('renders empty strings for nullish values', () => {
    const out = toCsv(
      [{ a: null as unknown as string, b: undefined as unknown as string }],
      [
        { key: 'a', header: 'A' },
        { key: 'b', header: 'B' },
      ]
    );
    expect(out).toBe('A,B\n,\n');
  });
});

describe('downloadCsv()', () => {
  it('creates a blob, synthesizes an anchor click, and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = origCreate(tag) as HTMLAnchorElement;
        anchor.click = clickSpy;
        return anchor;
      }
      return origCreate(tag);
    });

    downloadCsv('A,B\n1,2\n', 'test.csv');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    createSpy.mockRestore();
  });
});
