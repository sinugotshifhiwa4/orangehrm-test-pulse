/* ══════════════════════════════════════════
   Release insight cards (shown on the Trends page)
   ══════════════════════════════════════════ */
import type { Run, RunSummary } from '../../app/types';
import { Utils } from '../../app/core/utils';
import { AnalyticsModule } from '../../app/core/analytics';

export const ExecutiveModule = {
  render(runs: Run[]): void {
    const insights = document.getElementById('insight-cards');
    if (!insights) return;

    if (!runs.length) {
      insights.innerHTML = `<div class="insight-card"><div class="insight-label">Release Insights</div><div class="insight-value">No data</div><div class="insight-body">No runs match the current filters. Adjust the board filters to restore the insights.</div></div>`;
      return;
    }

    const summary = AnalyticsModule.summarize(runs);

    const cards: { label: string; tone: RunSummary['decisionTone']; value: string; body: string }[] = [
      {
        label: 'Release Recommendation',
        tone: summary.decisionTone,
        value: summary.releaseStatus,
        body: summary.criticalFailingRuns > 0
          ? 'Critical-tag failures are present, so release risk is elevated.'
          : 'No critical-tag failures are blocking the current release view.',
      },
      {
        label: 'Trend Movement',
        tone: (summary.passDelta ?? 0) >= 0 ? 'good' : 'bad',
        value: summary.passDelta == null ? 'Baseline forming' : `${Utils.deltaLabel(summary.passDelta)} pass rate`,
        body: summary.failureDelta == null
          ? 'Waiting for more historical contrast from S3.'
          : `Average failures per run are ${summary.failureDelta > 0 ? 'up' : summary.failureDelta < 0 ? 'down' : 'flat'} ${Utils.deltaLabel(summary.failureDelta, '')} versus the previous window.`,
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
        value: `${Utils.pct(summary.flakyRunShare)} flaky exposure`,
        body: summary.flakyDelta == null
          ? 'Tracking flaky prevalence as more history accumulates.'
          : `Flaky exposure moved ${Utils.deltaLabel(summary.flakyDelta)} compared with the previous window.`,
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
