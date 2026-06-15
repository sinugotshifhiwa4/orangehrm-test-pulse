/* ══════════════════════════════════════════
   Stat-bar breakdowns (by tag, branch, env, user)
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';

export const BreakdownModule = {
  render(runs: Run[], key: string, id: string): void {
    const g = Utils.groupBy(runs, key);
    const rows = Object.entries(g)
      .map(([k, items]) => ({ k, avg: Utils.avg(items.map(r => r.passRate || 0)), n: items.length }))
      .sort((a, b) => b.avg - a.avg);
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = rows.map(r => {
      const c = r.avg >= State.passThreshold ? '#22d17b' : r.avg >= 70 ? '#f5c542' : '#f25f5c';
      return `<div class="stat-bar-item">
        <div class="sb-label" title="${Utils.escape(r.k)}">${Utils.escape(r.k)}</div>
        <div class="sb-track"><div class="sb-fill" style="width:${r.avg.toFixed(1)}%;background:${c}"></div></div>
        <div class="sb-val">${Utils.pct(r.avg)}</div>
      </div>`;
    }).join('');
  },
  renderAll(runs: Run[]): void {
    this.render(runs, 'testType', 'breakdown-type');
    this.render(runs, 'branch', 'breakdown-branch');
    this.render(runs, 'env', 'breakdown-env');
    this.render(runs, 'userRole', 'breakdown-user');
  },
};
