/**
 * Minimal RFC-4180-ish CSV serializer and browser download helper.
 */

export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: Array<{ key: keyof T; header: string }>
): string {
  if (rows.length === 0) {
    return columns.map((c) => c.header).join(',') + '\n';
  }
  const head = columns.map((c) => escape(c.header)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => escape(row[c.key] === undefined || row[c.key] === null ? '' : String(row[c.key])))
        .join(',')
    )
    .join('\n');
  return `${head}\n${body}\n`;
}

function escape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(csv: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
