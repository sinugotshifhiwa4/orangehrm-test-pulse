/* ══════════════════════════════════════════
   OrangeHRM Overall Test Suite Report (PDF) builder.

   The full-history sibling of the Sprint Report (components/reports/sprint-report.ts).
   Fills the clean template at data/template/OrangeHRM-Overall-Report.pdf — see
   scripts/overall-template.mjs — with live dashboard data and charts derived
   from the COMPLETE run history (State.allRuns), with no date-range scoping.

   Token-fill and chart mechanics are identical to the build/sprint reports, so
   the generic helpers (fillDocument / renderCharts / drawCharts) are reused from
   BuildReportModule. This module owns only the overall-suite token map.
   ══════════════════════════════════════════ */
import { PDFDocument } from 'pdf-lib';
import templateUrl from '../../data/template/OrangeHRM-Overall-Report.pdf?url';
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { AnalyticsModule } from '../../app/core/analytics';
import { ReportModule } from './report';
import { BuildReportModule } from './build-report';
import { ReportLabels } from './report-labels';

type FillMap = Record<string, string>;
interface Slot { x: number; yTop: number; w: number; h: number; alignTop?: boolean; }

// Chart slots — MUST match scripts/overall-template.mjs (same coordinates as the
// other reports' Quality + Trends pages, here pages 3 and 4).
const MX = 40;
const FULL_W = 595.28 - 2 * MX;
const SUITE_SLOTS: Slot[] = [
  { x: MX, yTop: 336, w: 240, h: 196 },
  { x: MX, yTop: 566, w: 240, h: 160, alignTop: true },
];
const TREND_SLOTS: Slot[] = [
  { x: MX, yTop: 178, w: FULL_W, h: 126 },
  { x: MX, yTop: 328, w: FULL_W, h: 126 },
  { x: MX, yTop: 478, w: FULL_W, h: 126 },
  { x: MX, yTop: 628, w: FULL_W, h: 126 },
];

export const OverallSuiteReportModule = {
  field(id: string): string {
    return (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() || '';
  },

  today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** Default the Report Date to today until the user edits it. */
  syncDefaults(): void {
    const el = document.getElementById('overall-report-date') as HTMLInputElement | null;
    if (el && el.dataset.touched !== '1') el.value = this.today();
  },

  /** Map every template placeholder to its live value — derived from the full run
      history (kept in step with scripts/overall-template.mjs). */
  buildMap(runs: Run[]): FillMap {
    const ordered = [...runs].sort((a, b) => b._dateMs - a._dateMs);
    const latest = ordered[0] || null;
    const earliest = ordered[ordered.length - 1] || null;
    const summary = AnalyticsModule.summarize(runs);

    // Aggregate test-outcome totals across the full run history.
    const sum = (k: keyof Run) => runs.reduce((a, r) => a + ((r[k] as number) || 0), 0);
    const outPassed = sum('passed'), outFailed = sum('failed'), outFlaky = sum('flaky'), outSkipped = sum('skipped');
    const outTotal = outPassed + outFailed + outFlaky + outSkipped;
    const opct = (v: number) => (outTotal ? `${Math.round((v / outTotal) * 100)}%` : '0%');
    const totalTests = sum('total');

    const avgPass = Math.round(summary.avgPass);
    const passingRuns = runs.length - summary.failingRuns;
    const avgDuration = Utils.formatDuration(Utils.avg(runs.filter(r => r.durationMin != null).map(r => r.durationMin as number)));

    // Net test growth across history: earliest vs latest run.
    const testsDelta = latest && earliest ? (latest.total || 0) - (earliest.total || 0) : 0;
    const growthText = `${testsDelta >= 0 ? '+' : ''}${testsDelta}`;

    // Readiness — same scoring as the sprint report: weighted pass rate docked
    // for flaky exposure and failing-run share.
    const flakyRate = outTotal ? (outFlaky / outTotal) * 100 : 0;
    const flakyDock = Utils.clamp(flakyRate * 0.5, 0, 16);
    const failShare = runs.length ? (summary.failingRuns / runs.length) * 100 : 0;
    const failDock = Utils.clamp(failShare * 0.3, 0, 20);
    const readinessScore = Math.round(Utils.clamp(summary.weightedPassRate - flakyDock - failDock, 0, 100));
    const suiteReadiness = ReportLabels.readiness(readinessScore);
    const readinessSummary = ReportLabels.readinessNote(suiteReadiness);

    // Overall Health mirrors the Overview "Overall Health" card (run-health model).
    const runHealth = summary.runHealth;
    const suiteStatus = ReportLabels.grade(runHealth);
    const suiteQuality = ReportLabels.grade(summary.weightedPassRate);
    const suiteStability = ReportLabels.stability(summary.failingRuns, summary.totalFlaky);

    // Risk uses the existing status/critical thresholds (left per-report).
    const suiteRisk = (latest?.status === 'FAIL' || summary.criticalFailingRuns > 0) ? 'High'
      : (summary.totalFlaky > 0 || summary.weightedPassRate < 90) ? 'Medium' : 'Low';

    return {
      reportDate: this.field('overall-report-date') ? Utils.formatDateOnly(this.field('overall-report-date')) : Utils.formatDateOnly(this.today()),
      preparedBy: this.field('overall-prepared-by') || 'Automation Team',
      audience: this.field('overall-audience') || 'Stakeholders',
      generated: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),

      totalTests: String(totalTests),
      passRate: Utils.pct(summary.weightedPassRate),
      failedTests: String(outFailed),
      flakyTests: String(outFlaky),
      skippedTests: String(outSkipped),

      suiteStatus,
      suiteQuality,
      suiteStability,
      suiteReadiness,
      readinessScore: String(readinessScore),
      readinessSummary,

      passRateInsight: `${avgPass}% avg pass rate over ${runs.length} runs`,
      successInsight: `${passingRuns}/${runs.length} runs passed`,
      durationInsight: `${avgDuration} average execution duration`,
      testGrowthInsight: `${growthText} tests across all runs`,

      outPassed: String(outPassed),
      outPassedPct: opct(outPassed),
      outFailed: String(outFailed),
      outFailedPct: opct(outFailed),
      outFlaky: String(outFlaky),
      outFlakyPct: opct(outFlaky),
      outSkipped: String(outSkipped),
      outSkippedPct: opct(outSkipped),

      overallHealth: ReportLabels.healthLine(runHealth),
      healthNote: `Weighted pass rate ${Utils.pct(summary.weightedPassRate)} across ${runs.length} run${runs.length === 1 ? '' : 's'}`,
      failingRuns: String(summary.failingRuns),
      flakyExposure: String(summary.totalFlaky),
      testSuiteScore: String(summary.releaseScore),
      suiteRiskLevel: suiteRisk,
    };
  },

  async build(): Promise<void> {
    // Guard up-front so the reason reaches the user — runWithButton's catch
    // otherwise replaces it with a generic "please try again" alert.
    const runs = State.allRuns;
    if (!runs.length) {
      ReportModule.toast('No test runs are available to build an overall test suite report.', 'error');
      return;
    }

    await ReportModule.runWithButton('report-overall-suite-btn', async () => {
      const map = this.buildMap(runs);
      const charts = await BuildReportModule.renderCharts(runs);

      const res = await fetch(templateUrl);
      if (!res.ok) throw new Error('Overall report template could not be loaded');
      const doc = await PDFDocument.load(await res.arrayBuffer());
      const changed = await BuildReportModule.fillDocument(doc, map);
      if (!changed) throw new Error('No placeholders were found in the overall report template');

      // Page index 2 = Quality & Overall charts; index 3 = Execution Trends.
      const pages = doc.getPages();
      if (pages[2]) await BuildReportModule.drawCharts(doc, pages[2], SUITE_SLOTS, charts.suite);
      if (pages[3]) await BuildReportModule.drawCharts(doc, pages[3], TREND_SLOTS, charts.trends);

      const bytes = await doc.save();
      ReportModule.downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `OrangeHRM-Overall-Test-Suite-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
      ReportModule.toast('Overall test suite report generated successfully');
    });
  },
};
