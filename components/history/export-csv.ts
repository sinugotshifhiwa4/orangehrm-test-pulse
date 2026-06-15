/* ══════════════════════════════════════════
   CSV export of the current filtered runs
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';

export const ExportModule = {
  download(runs: Run[]): void {
    const cols = ['runNumber', 'date', 'branch', 'testType', 'userRole', 'env', 'passRate', 'passed', 'failed', 'skipped', 'flaky', 'total', 'durationMin', 'status'];
    const csv = [
      cols.join(','),
      ...runs.map(r => cols.map(c => {
        const v = String(r[c] ?? '');
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')),
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `test-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};
