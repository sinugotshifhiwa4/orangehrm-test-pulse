/* ══════════════════════════════════════════
   Overview landing — suite-health banner, KPI cards
   with trend deltas, outcome stats, recent runs table.
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';
import { Utils } from '../../app/core/utils';
import { AnalyticsModule } from '../../app/core/analytics';
import { NavModule } from '../layout/nav';
import { ReportLabels, type Band } from '../reports/report-labels';

interface Totals { passed: number; failed: number; flaky: number; skipped: number; total: number; }

// Shared band → presentation maps, so pass-rate colouring stays in step with the
// centralised HEALTH_BANDS thresholds in report-labels.ts.
const BAND_COLOR: Record<Band, string> = { good: 'var(--green)', warn: 'var(--yellow)', bad: 'var(--red)' };
const BAND_RATE_CLASS: Record<Band, string> = { good: 'high', warn: 'mid', bad: 'low' };

const totals = (runs: Run[]): Totals => {
  const passed = Utils.sum(runs.map(r => r.passed || 0));
  const failed = Utils.sum(runs.map(r => r.failed || 0));
  const flaky = Utils.sum(runs.map(r => r.flaky || 0));
  const skipped = Utils.sum(runs.map(r => r.skipped || 0));
  return { passed, failed, flaky, skipped, total: passed + failed + flaky + skipped };
};

const TREND_TITLE = 'Change vs the earlier half of these runs';

/** Renders a trend chip. The arrow always reflects the actual direction of change,
    but the colour reflects whether that change is *good*: rising passes are green,
    while rising failures/flaky/skipped are red. Pass higherIsBetter=false for
    metrics where an increase is bad. Magnitude is shown unsigned — the arrow
    already carries direction, avoiding a redundant "↓ −3". */
const trendChip = (delta: number | null, { suffix = '', higherIsBetter = true }: { suffix?: string; higherIsBetter?: boolean } = {}): string => {
  if (delta == null) return `<span class="kpi-trend flat" title="Not enough history to compare">— no baseline</span>`;
  if (delta === 0) return `<span class="kpi-trend flat" title="${TREND_TITLE}">→ no change</span>`;
  const up = delta > 0;
  const arrow = up ? '↑' : '↓';
  const good = up === higherIsBetter;
  return `<span class="kpi-trend ${good ? 'up' : 'down'}" title="${TREND_TITLE}">${arrow} ${Math.abs(delta)}${suffix}</span>`;
};

export const OverviewModule = {
  render(runs: Run[]): void {
    this.renderKpis(runs);
    this.renderOutcomeStats(runs);
    this.renderRecentRuns(runs);
  },

  renderKpis(runs: Run[]): void {
    const el = document.getElementById('kpi-row');
    if (!el) return;
    const t = totals(runs);
    const success = Utils.ratio(t.passed, t.total);

    // Window-over-window deltas for the trend chips.
    const w = AnalyticsModule.splitRuns(runs);
    const cur = totals(w.current);
    const prev = totals(w.previous);
    const hasBaseline = w.previous.length > 0 && runs.length > 1;
    const countDelta = (key: keyof Totals): number | null => hasBaseline ? cur[key] - prev[key] : null;
    const successDelta = hasBaseline
      ? +(Utils.ratio(cur.passed, cur.total) - Utils.ratio(prev.passed, prev.total)).toFixed(1)
      : null;

    const cards = [
      { label: 'Test Executions', value: String(t.total), color: 'var(--blue)', trend: '' },
      { label: 'Passed', value: String(t.passed), color: 'var(--green)', trend: trendChip(countDelta('passed')) },
      { label: 'Failed', value: String(t.failed), color: t.failed ? 'var(--red)' : 'var(--green)', trend: trendChip(countDelta('failed'), { higherIsBetter: false }) },
      { label: 'Flaky', value: String(t.flaky), color: t.flaky ? 'var(--orange)' : 'var(--green)', trend: trendChip(countDelta('flaky'), { higherIsBetter: false }) },
      { label: 'Skipped', value: String(t.skipped), color: 'var(--text-2)', trend: trendChip(countDelta('skipped'), { higherIsBetter: false }) },
      { label: 'Success', value: `${Math.round(success)}%`, color: BAND_COLOR[ReportLabels.rateBand(success)], trend: trendChip(successDelta, { suffix: '%' }) },
    ];
    el.innerHTML = cards.map(c => `
      <div class="kpi-card">
        <div class="kpi-accent" style="background:${c.color}"></div>
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value" style="color:${c.color}">${c.value}</div>
        ${c.trend || '<span class="kpi-trend flat">&nbsp;</span>'}
      </div>`).join('');
  },

  renderOutcomeStats(runs: Run[]): void {
    const el = document.getElementById('outcome-stats');
    if (!el) return;
    const t = totals(runs);
    const rows = [
      { label: 'Passed', value: t.passed, color: 'var(--green)' },
      { label: 'Failed', value: t.failed, color: 'var(--red)' },
      { label: 'Flaky', value: t.flaky, color: 'var(--yellow)' },
      { label: 'Skipped', value: t.skipped, color: 'var(--text-2)' },
    ];
    el.innerHTML = rows.map(r => `
      <div class="outcome-stat">
        <span class="outcome-stat-dot" style="background:${r.color}"></span>
        <span class="outcome-stat-label">${r.label}</span>
        <span class="outcome-stat-value">${r.value}</span>
        <span class="outcome-stat-pct">${t.total ? Math.round(Utils.ratio(r.value, t.total)) : 0}%</span>
      </div>`).join('');
  },

  renderRecentRuns(runs: Run[]): void {
    const el = document.getElementById('recent-runs');
    if (!el) return;
    const recent = [...runs].sort((a, b) => b._dateMs - a._dateMs).slice(0, 8);
    if (!recent.length) {
      el.innerHTML = `<div class="failing-empty">No runs match the current filters</div>`;
      return;
    }
    el.innerHTML = `
      <table class="recent-table">
        <thead>
          <tr>
            <th>Run #</th><th>Branch</th><th class="col-hide">Tag</th>
            <th>Pass %</th><th>Failed</th><th class="col-hide">Date</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(r => {
            const cls = BAND_RATE_CLASS[ReportLabels.rateBand(r.passRate ?? 0)];
            return `<tr class="${r.status === 'FAIL' ? 'row-fail' : ''}">
              <td class="mono">#${r.runNumber ?? '—'}</td>
              <td class="mono">${Utils.escape(r.branch || '—')}</td>
              <td class="col-hide"><span class="pill pill-purple">@${Utils.escape(r.testType || '—')}</span></td>
              <td>
                <div class="rate-bar">
                  <div class="rate-track"><div class="rate-fill ${cls}" style="width:${r.passRate ?? 0}%"></div></div>
                  <span class="mono">${Utils.pct(r.passRate)}</span>
                </div>
              </td>
              <td class="mono" style="color:${r.failed > 0 ? 'var(--red)' : 'var(--green)'}">${r.failed}</td>
              <td class="mono col-hide">${Utils.escape(Utils.formatDateShort(r.date))}</td>
              <td><span class="badge badge-${r.status === 'PASS' ? 'pass' : 'fail'}">${r.status}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    const viewAll = document.getElementById('recent-view-all');
    if (viewAll && !viewAll.dataset.bound) {
      viewAll.dataset.bound = 'true';
      viewAll.addEventListener('click', () => NavModule.show('runs'));
    }
  },
};
