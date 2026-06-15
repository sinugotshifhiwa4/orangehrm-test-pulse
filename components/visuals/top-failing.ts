/* ══════════════════════════════════════════
   Top failing tests list
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';
import { Utils } from '../../app/core/utils';

interface FailEntry {
  name?: string;
  classname?: string;
  msg?: string;
  count: number;
  latestDateMs: number;
  latestRunNumber: number | null;
  latestReportUrl: string | null;
}

interface TopFailingOpts {
  limit?: number;
  windowDays?: number;
}

export const TopFailingModule = {
  render(runs: Run[], subId = 'top-failing-sub', listId = 'top-failing-list', opts: TopFailingOpts = {}): void {
    const sub = document.getElementById(subId);
    const list = document.getElementById(listId);
    if (!sub || !list) return;
    if (opts.windowDays && opts.windowDays > 0) {
      const cutoff = Date.now() - opts.windowDays * 86400000;
      runs = runs.filter(r => (r._dateMs || 0) >= cutoff);
    }
    const limit = opts.limit ?? 8;
    const hasPerTest = runs.some(r => r.failedTests && r.failedTests.length > 0);
    if (hasPerTest) {
      const counts: Record<string, FailEntry> = {};
      runs.forEach(r => (r.failedTests || []).forEach(t => {
        const name = t.name ?? '';
        if (!counts[name]) {
          counts[name] = {
            name: t.name,
            classname: t.classname,
            msg: t.failureMessage,
            count: 0,
            latestDateMs: -1,
            latestRunNumber: null,
            latestReportUrl: null,
          };
        }
        counts[name].count++;
        if ((r._dateMs || 0) >= counts[name].latestDateMs) {
          counts[name].latestDateMs = r._dateMs || 0;
          counts[name].latestRunNumber = (r.buildNumber as number) ?? r.runNumber ?? null;
          counts[name].latestReportUrl = r.reportUrl || null;
        }
      }));
      const sorted = Object.values(counts)
        .sort((a, b) => (b.latestDateMs - a.latestDateMs) || (b.count - a.count))
        .slice(0, limit);
      const windowLabel = opts.windowDays ? ` · last ${opts.windowDays}d` : '';
      sub.textContent = `Top ${sorted.length} · ${runs.filter(r => r.failed > 0).length} failing runs${windowLabel}`;
      list.innerHTML = sorted.length === 0
        ? `<div class="failing-empty">✓ No test failures in this window</div>`
        : sorted.map((t, i) => `<div class="failing-item">
          <div class="failing-rank ${i < 2 ? 'hot' : ''}">${i + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="failing-name" title="${Utils.escape(t.name)}">${Utils.escape(t.name)}</div>
            <div class="failing-file">${Utils.escape(t.classname || '')}</div>
            ${t.msg ? `<div class="failing-msg" title="${Utils.escape(t.msg)}">${Utils.escape(t.msg.split('\n')[0])}</div>` : ''}
            ${(t.latestRunNumber != null || t.latestReportUrl) ? `<div class="failing-meta">
              ${t.latestRunNumber != null ? `<span>Latest: #${Utils.escape(String(t.latestRunNumber))}</span>` : ''}
              ${t.latestReportUrl ? `<a href="${Utils.escape(t.latestReportUrl)}" target="_blank" rel="noopener noreferrer" class="failing-meta-link">Report</a>` : ''}
            </div>` : ''}
          </div>
          <div class="failing-badge">${t.count}×</div>
        </div>`).join('');
    } else {
      const worst = [...runs].filter(r => r.failed > 0).sort((a, b) => b.failed - a.failed).slice(0, Math.min(limit, 6));
      sub.textContent = 'run-level data';
      list.innerHTML = worst.length === 0
        ? `<div class="failing-empty">✓ No failures in this window</div>`
        : worst.map((r, i) => `<div class="failing-item">
          <div class="failing-rank ${i < 2 ? 'hot' : ''}">${i + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="failing-name">Run #${r.runNumber} · ${Utils.escape(r.branch)} / ${Utils.escape(r.testType)}</div>
            <div class="failing-file">${r.formattedDate} · ${Utils.escape(r.env)}</div>
          </div>
          <div class="failing-badge">${r.failed} fails</div>
        </div>`).join('');
    }
  },
};
