/* ══════════════════════════════════════════
   Last 30 days summary cards (Overview page)
   ══════════════════════════════════════════ */
import type { Run, RunSummary } from '../../app/types';
import { Utils } from '../../app/core/utils';
import { AnalyticsModule } from '../../app/core/analytics';
import { ReportLabels } from '../reports/report-labels';

const WINDOW_DAYS = 30;

/** Absolute change as text, no leading sign — direction is conveyed by surrounding copy. */
const magnitude = (delta: number, suffix = '%'): string => Utils.deltaLabel(Math.abs(delta), suffix).replace('+', '');

export const ExecutiveModule = {
  render(runs: Run[]): void {
    const insights = document.getElementById('insight-cards');
    if (!insights) return;

    const cutoff = Date.now() - WINDOW_DAYS * 86400000;
    const recent = runs.filter(r => (r._dateMs || 0) >= cutoff);

    if (!recent.length) {
      insights.innerHTML = `<div class="insight-card"><div class="insight-label">Last 30 Days Summary</div><div class="insight-value">No recent data</div><div class="insight-body">No runs in the last ${WINDOW_DAYS} days for the current filters. Adjust the board filters to restore the summary.</div></div>`;
      return;
    }

    const summary = AnalyticsModule.summarize(recent);

    // Run-health: how healthy the selected runs were. No critical-tag override — the
    // filtered dataset already scopes what counts (e.g. filtering to authenticate).
    // Shared report vocabulary so the Overview card and the PDF reports read the
    // same: Excellent (>=90) / Good (>=70) / Unstable (<70).
    const health = summary.runHealth;
    const healthTone: RunSummary['decisionTone'] = health >= 90 ? 'good' : health >= 70 ? 'warn' : 'bad';

    const cards: { label: string; tone: RunSummary['decisionTone']; value: string; body: string }[] = [
      {
        label: 'Overall Health',
        tone: healthTone,
        value: ReportLabels.healthLine(health),
        body: `Weighted pass rate ${Utils.pct(summary.weightedPassRate)} across ${recent.length} run${recent.length === 1 ? '' : 's'} in the last ${WINDOW_DAYS} days.`,
      },
      {
        label: 'Trend Movement',
        tone: (summary.passDelta == null || Math.abs(summary.passDelta) < 0.5 || summary.passDelta > 0) ? 'good' : 'bad',
        value: summary.passDelta == null
          ? 'Baseline forming'
          : Math.abs(summary.passDelta) < 0.5
            ? 'Steady pass rate'
            : `${summary.passDelta > 0 ? 'Up' : 'Down'} ${magnitude(summary.passDelta)} pass rate`,
        body: summary.failureDelta == null
          ? 'Waiting for more history to compare against.'
          : Math.abs(summary.failureDelta) < 0.5
            ? 'Average failures per run are holding steady versus the first half of the last 30 days.'
            : `Average failures per run are ${summary.failureDelta > 0 ? 'up' : 'down'} ${magnitude(summary.failureDelta, '')} versus the first half of the last 30 days.`,
      },
      {
        label: 'Failure Driver',
        tone: summary.topCategory ? 'warn' : 'good',
        value: summary.topCategory ? summary.topCategory.label : 'No active driver',
        body: summary.topCategory
          ? `${summary.topCategory.count} failures mapped to this category in the current view.`
          : 'No failure categories were detected in the selected runs.',
      },
      {
        label: 'Stability Risk',
        tone: summary.flakyRunShare < 10 ? 'good' : summary.flakyRunShare < 25 ? 'warn' : 'bad',
        // Run-level metric: the share of runs that contained any flaky test, not a flaky-test count.
        value: `${Utils.pct(summary.flakyRunShare)} of runs flaky`,
        body: (() => {
          const base = `${summary.flakyRunCount} of ${recent.length} run${recent.length === 1 ? '' : 's'} in the last ${WINDOW_DAYS} days had flaky tests.`;
          if (summary.flakyDelta == null) return `${base} Tracking the trend as more history accumulates.`;
          if (summary.flakyDelta === 0) return `${base} Unchanged versus the first half of the window.`;
          return `${base} That share is ${summary.flakyDelta > 0 ? 'up' : 'down'} ${magnitude(summary.flakyDelta)} versus the first half of the window.`;
        })(),
      },
    ];

    insights.innerHTML = cards.map(card => `
      <div class="insight-card ${card.tone}">
        <div class="insight-label">${card.label}</div>
        <div class="insight-value">${Utils.escape(card.value)}</div>
        <div class="insight-body">${Utils.escape(card.body)}</div>
      </div>`).join('');
  },
};
