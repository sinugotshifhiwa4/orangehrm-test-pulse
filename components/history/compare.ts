/* ══════════════════════════════════════════
   Run comparison (select 2 runs → modal)
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { TableModule } from './table';

export const CompareModule = {
  toggle(rn: number, checked: boolean): void {
    if (checked) { if (State.compareIds.size >= 2) return; State.compareIds.add(rn); }
    else State.compareIds.delete(rn);
    TableModule.render();
    this.updateBar();
  },
  clear(): void { State.compareIds.clear(); TableModule.render(); this.updateBar(); },
  updateBar(): void {
    const n = State.compareIds.size;
    document.getElementById('compare-bar')?.classList.toggle('hidden', n === 0);
    const count = document.getElementById('cmp-count');
    if (count) count.textContent = String(n);
    const btn = document.getElementById('compare-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = n !== 2;
    btn.style.opacity = n === 2 ? '1' : '0.5';
  },
  open(): void {
    if (State.compareIds.size !== 2) return;
    const runs = [...State.compareIds].map(id => State.filteredRuns.find(r => r.runNumber === id)).filter(Boolean) as Run[];
    if (runs.length < 2) return;
    const [a, b] = runs;
    const field = (label: string, va: unknown, vb: unknown, hb: boolean | null = null) => {
      let cA = '', cB = '';
      const na = parseFloat(String(va)), nb = parseFloat(String(vb));
      if (hb !== null && !isNaN(na) && !isNaN(nb) && na !== nb) {
        cA = hb ? na > nb ? 'better' : 'worse' : na < nb ? 'better' : 'worse';
        cB = hb ? na > nb ? 'worse' : 'better' : na < nb ? 'worse' : 'better';
      }
      return `<tr><td>${label}</td><td class="${cA}">${Utils.escape(String(va))}</td><td class="${cB}">${Utils.escape(String(vb))}</td></tr>`;
    };
    const failList = (r: Run) => {
      if (!r.failedTests || !r.failedTests.length) return r.failed > 0
        ? `<div style="color:var(--text-3);font-size:10px;font-family:var(--mono)">No per-test data</div>`
        : `<div style="color:var(--green);font-size:10px;font-family:var(--mono)">✓ All passed</div>`;
      return r.failedTests.slice(0, 5).map(t =>
        `<div style="font-size:10px;font-family:var(--mono);color:var(--text-2);padding:3px 0;border-bottom:1px solid var(--border)">✗ ${Utils.escape(t.name)}</div>`
      ).join('') + (r.failedTests.length > 5
        ? `<div style="font-size:10px;color:var(--text-3);padding:3px 0;font-family:var(--mono)">…+${r.failedTests.length - 5} more</div>` : '');
    };
    const body = document.getElementById('compare-modal-body');
    if (body) body.innerHTML = `
      <table class="cmp-table" style="margin-bottom:16px">
        <tr><th>Metric</th><th>Run #${a.runNumber}</th><th>Run #${b.runNumber}</th></tr>
        ${field('Date', a.formattedDate, b.formattedDate)}
        ${field('Branch', a.branch || '—', b.branch || '—')}
        ${field('Tag', a.testType || '—', b.testType || '—')}
        ${field('Env', a.env || '—', b.env || '—')}
        ${field('Pass Rate', Utils.pct(a.passRate), Utils.pct(b.passRate), true)}
        ${field('Passed', a.passed, b.passed, true)}
        ${field('Failed', a.failed, b.failed, false)}
        ${field('Flaky', a.flaky || 0, b.flaky || 0, false)}
        ${field('Duration', Utils.formatDuration(a.durationMin), Utils.formatDuration(b.durationMin), false)}
        ${field('Status', a.status, b.status)}
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;font-weight:600;color:var(--accent);font-family:var(--mono);margin-bottom:8px">FAILED — Run #${a.runNumber}</div>${failList(a)}</div>
        <div><div style="font-size:10px;font-weight:600;color:var(--accent);font-family:var(--mono);margin-bottom:8px">FAILED — Run #${b.runNumber}</div>${failList(b)}</div>
      </div>`;
    document.getElementById('compare-modal')?.classList.add('open');
  },
  close(): void { document.getElementById('compare-modal')?.classList.remove('open'); },
};
