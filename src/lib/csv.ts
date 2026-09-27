/**
 * One CSV cell, always quoted. Values a spreadsheet would run as a formula
 * (starting with = + - @ or a tab / carriage return) are prefixed with an
 * apostrophe so Excel shows them as text. Plain numbers are left alone.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Downloads rows as a UTF-8 CSV that Excel opens with accents intact. */
export function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const content = '﻿' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
