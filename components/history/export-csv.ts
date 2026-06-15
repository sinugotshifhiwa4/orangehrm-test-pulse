/* ══════════════════════════════════════════
   Export current filtered runs to CSV or Excel
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';

const COLUMNS: { key: keyof Run; label: string }[] = [
  { key: 'runNumber', label: 'Run #' },
  { key: 'date', label: 'Date' },
  { key: 'branch', label: 'Branch' },
  { key: 'testType', label: 'Tag' },
  { key: 'project', label: 'Project' },
  { key: 'env', label: 'Environment' },
  { key: 'passRate', label: 'Pass Rate %' },
  { key: 'passed', label: 'Passed' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'flaky', label: 'Flaky' },
  { key: 'total', label: 'Total' },
  { key: 'durationMin', label: 'Duration (min)' },
  { key: 'status', label: 'Status' },
];

const fileName = (ext: string): string => `test-results-${new Date().toISOString().slice(0, 10)}.${ext}`;

function save(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/** One row object keyed by the friendly column labels. */
const toRow = (r: Run): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  COLUMNS.forEach(c => { row[c.label] = r[c.key] ?? ''; });
  return row;
};

export const ExportModule = {
  csv(runs: Run[]): void {
    const csv = [
      COLUMNS.map(c => c.label).join(','),
      ...runs.map(r => COLUMNS.map(c => {
        const v = String(r[c.key] ?? '');
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')),
    ].join('\r\n');
    save(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), fileName('csv'));
  },

  async excel(runs: Run[]): Promise<void> {
    // Loaded on demand so the (large) library stays out of the initial bundle.
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(runs.map(toRow), { header: COLUMNS.map(c => c.label) });
    ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.label.length + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test Results');
    XLSX.writeFile(wb, fileName('xlsx'));
  },
};
