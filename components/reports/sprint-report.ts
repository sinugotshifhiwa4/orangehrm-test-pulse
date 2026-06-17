/* ══════════════════════════════════════════
   OrangeHRM Sprint Report (PDF) builder.

   A sprint-level evolution of the Build Report (components/reports/build-report.ts).
   Fills the clean template at data/template/OrangeHRM-Sprint-Report.pdf — see
   scripts/sprint-template.mjs — with live dashboard data and charts, derived
   EXCLUSIVELY from the runs executed inside the selected sprint date window.

   The token-fill mechanics and chart rendering are identical to the build report,
   so the generic helpers (fillDocument / renderCharts / drawCharts) are reused from
   BuildReportModule rather than duplicated here. This module owns only the
   sprint-specific scope, token map, and the page-3 delivery tables.
   ══════════════════════════════════════════ */
import { PDFDocument } from 'pdf-lib';
import templateUrl from '../../data/template/OrangeHRM-Sprint-Report.pdf?url';
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { AnalyticsModule } from '../../app/core/analytics';
import { ReportModule } from './report';
import { BuildReportModule } from './build-report';

type FillMap = Record<string, string>;
interface Slot { x: number; yTop: number; w: number; h: number; alignTop?: boolean; }

// Chart slots — MUST match scripts/sprint-template.mjs (same coordinates as the
// build report's Quality + Trends pages, which are now sprint pages 4 and 5).
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

// Row counts per page-3 table — keep in step with scripts/sprint-template.mjs.
const T1_ROWS = 5; // Completed Work
const T2_ROWS = 4; // Work In Progress & Blockers
const T3_ROWS = 6; // Sprint Goals & Achievements

export const SprintReportModule = {
  field(id: string): string {
    return (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value?.trim() || '';
  },

  ymd(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** Runs inside the sprint window (the Sprint tab's Date-from / Date-to). The
      selected date range is the ONLY filter — sourced from every run, so the
      dashboard's date-range pill and header filters never narrow the sprint scope.
      Blank dates fall back to all runs. */
  sprintRuns(): Run[] {
    const from = this.field('report-date-from');
    const to = this.field('report-date-to');
    if (!from && !to) return State.allRuns;
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const toMs = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;
    return State.allRuns.filter(r => r._dateMs >= fromMs && r._dateMs <= toMs);
  },

  /** Display dates for the cover — the typed window, else the actual run span. */
  sprintDates(runs: Run[]): { start: string; end: string } {
    const from = this.field('report-date-from');
    const to = this.field('report-date-to');
    const sorted = [...runs].sort((a, b) => a._dateMs - b._dateMs);
    const start = from ? Utils.formatDateOnly(from) : (sorted[0] ? Utils.formatDateOnly(this.ymd(sorted[0]._dateMs)) : '—');
    const end = to ? Utils.formatDateOnly(to) : (sorted.length ? Utils.formatDateOnly(this.ymd(sorted[sorted.length - 1]._dateMs)) : '—');
    return { start, end };
  },

  sprintNumber(): string {
    const raw = this.field('report-sprint');
    const m = raw.match(/(\d+)/);
    return m ? m[1] : '';
  },

  sprintTag(): string {
    return this.field('report-sprint') || (this.sprintNumber() ? `Sprint ${this.sprintNumber()}` : 'Sprint');
  },

  /** Parse a delivery-table textarea: one row per line, columns split on `|`. */
  parseRows(id: string, cols: number, maxRows: number): string[][] {
    const raw = (document.getElementById(id) as HTMLTextAreaElement | null)?.value || '';
    const rows = raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, maxRows)
      .map(line => {
        const parts = line.split('|').map(s => s.trim());
        return Array.from({ length: cols }, (_, i) => parts[i] || '');
      });
    while (rows.length < maxRows) rows.push(Array<string>(cols).fill(''));
    return rows;
  },

  /** Map every template placeholder to its live value — the single source of truth
      for the sprint template's `{{tokens}}` (kept in step with scripts/sprint-template.mjs). */
  buildMap(runs: Run[]): FillMap {
    const ordered = [...runs].sort((a, b) => b._dateMs - a._dateMs);
    const latest = ordered[0] || null;
    const earliest = ordered[ordered.length - 1] || null;
    const summary = AnalyticsModule.summarize(runs);
    const dates = this.sprintDates(runs);
    const num = this.sprintNumber();

    // Aggregate test-outcome totals across every run in the sprint window.
    const sum = (k: keyof Run) => runs.reduce((a, r) => a + ((r[k] as number) || 0), 0);
    const outPassed = sum('passed'), outFailed = sum('failed'), outFlaky = sum('flaky'), outSkipped = sum('skipped');
    const outTotal = outPassed + outFailed + outFlaky + outSkipped;
    const opct = (v: number) => (outTotal ? `${Math.round((v / outTotal) * 100)}%` : '0%');
    const totalTests = sum('total');

    const avgPass = Math.round(summary.avgPass);
    const passingRuns = runs.length - summary.failingRuns;
    const avgDuration = Utils.formatDuration(Utils.avg(runs.filter(r => r.durationMin != null).map(r => r.durationMin as number)));

    // Test growth across the sprint: earliest vs latest run in the window.
    const testsDelta = latest && earliest ? (latest.total || 0) - (earliest.total || 0) : 0;
    const growthText = `${testsDelta >= 0 ? '+' : ''}${testsDelta}`;

    // Sprint readiness — derived from sprint-wide data only: weighted pass rate,
    // docked for flaky exposure and failing-run share.
    const flakyRate = outTotal ? (outFlaky / outTotal) * 100 : 0;
    const flakyDock = Utils.clamp(flakyRate * 0.5, 0, 16);
    const failShare = runs.length ? (summary.failingRuns / runs.length) * 100 : 0;
    const failDock = Utils.clamp(failShare * 0.3, 0, 20);
    const readinessScore = Math.round(Utils.clamp(summary.weightedPassRate - flakyDock - failDock, 0, 100));
    const sprintReadiness = readinessScore >= 90 ? 'Ready' : readinessScore >= 75 ? 'Ready with Risks' : 'Not Ready';
    const readinessSummary = sprintReadiness === 'Ready'
      ? 'Cleared for release.'
      : sprintReadiness === 'Ready with Risks' ? 'Proceed with caution.' : 'Hold for fixes.';

    const sprintStatus = sprintReadiness === 'Ready' ? 'On Track' : sprintReadiness === 'Ready with Risks' ? 'At Risk' : 'Off Track';
    const passDelta = latest && earliest && latest.passRate != null && earliest.passRate != null
      ? +(latest.passRate - earliest.passRate).toFixed(1) : null;
    const sprintQuality = passDelta == null ? 'Stable' : passDelta > 1 ? 'Good' : passDelta < -1 ? 'Unstable' : 'Stable';
    const sprintStability = summary.failingRuns > 0 ? 'Unstable' : summary.totalFlaky > 0 ? 'Variable' : 'Stable';

    // Overall Health mirrors the Overview "Overall Health" card (run-health model).
    const runHealth = summary.runHealth;
    const healthLabel = runHealth >= 90 ? 'Healthy' : runHealth >= 75 ? 'Stable' : 'At Risk';
    const suiteRisk = (latest?.status === 'FAIL' || summary.criticalFailingRuns > 0) ? 'High'
      : (summary.totalFlaky > 0 || summary.weightedPassRate < 90) ? 'Medium' : 'Low';

    const map: FillMap = {
      sprintStartDate: dates.start,
      sprintEndDate: dates.end,
      preparedBy: this.field('sprint-prepared-by') || 'Automation Team',
      audience: this.field('sprint-audience') || 'Stakeholders',
      generated: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
      sprintTag: this.sprintTag(),
      healthTitle: num ? `Sprint ${num} Health Overview` : 'Sprint Health Overview',

      totalTests: String(totalTests),
      passRate: Utils.pct(summary.weightedPassRate),
      failedTests: String(outFailed),
      flakyTests: String(outFlaky),
      skippedTests: String(outSkipped),

      sprintStatus,
      sprintQuality,
      sprintStability,
      sprintReadiness,
      sprintReadinessScore: String(readinessScore),
      readinessSummary,

      passRateInsight: `${avgPass}% avg pass rate over ${runs.length} sprint runs`,
      successInsight: `${passingRuns}/${runs.length} runs passed`,
      durationInsight: `${avgDuration} average execution duration`,
      testGrowthInsight: `${growthText} tests across the sprint`,

      outPassed: String(outPassed),
      outPassedPct: opct(outPassed),
      outFailed: String(outFailed),
      outFailedPct: opct(outFailed),
      outFlaky: String(outFlaky),
      outFlakyPct: opct(outFlaky),
      outSkipped: String(outSkipped),
      outSkippedPct: opct(outSkipped),

      overallHealth: `${healthLabel} · ${runHealth}/100`,
      healthNote: `Weighted pass rate ${Utils.pct(summary.weightedPassRate)} across ${runs.length} run${runs.length === 1 ? '' : 's'}`,
      failingRuns: String(summary.failingRuns),
      flakyExposure: String(summary.totalFlaky),
      testSuiteScore: String(summary.releaseScore),
      suiteRiskLevel: suiteRisk,
    };

    // Page 3 — delivery tables (user-entered narrative content).
    this.parseRows('sprint-completed', 3, T1_ROWS).forEach((r, i) => {
      map[`t1_item_${i + 1}`] = r[0]; map[`t1_out_${i + 1}`] = r[1]; map[`t1_ref_${i + 1}`] = r[2];
    });
    this.parseRows('sprint-wip', 4, T2_ROWS).forEach((r, i) => {
      map[`t2_ws_${i + 1}`] = r[0]; map[`t2_status_${i + 1}`] = r[1]; map[`t2_owner_${i + 1}`] = r[2]; map[`t2_next_${i + 1}`] = r[3];
    });
    this.parseRows('sprint-goals', 2, T3_ROWS).forEach((r, i) => {
      map[`t3_area_${i + 1}`] = r[0]; map[`t3_detail_${i + 1}`] = r[1];
    });

    return map;
  },

  async build(): Promise<void> {
    // Guard up-front so the specific reason reaches the user — runWithButton's
    // catch otherwise replaces it with a generic "please try again" alert.
    const runs = this.sprintRuns();
    if (!runs.length) {
      const from = this.field('report-date-from');
      const to = this.field('report-date-to');
      ReportModule.toast((from || to)
        ? 'No test runs found in the selected sprint date range. Adjust the dates and try again.'
        : 'No test runs are available to build a sprint report.', 'error');
      return;
    }

    await ReportModule.runWithButton('report-sprint-pdf-btn', async () => {
      const map = this.buildMap(runs);
      // Reuse the build report's chart rendering (identical mechanics).
      const charts = await BuildReportModule.renderCharts(runs);

      const res = await fetch(templateUrl);
      if (!res.ok) throw new Error('Sprint report template could not be loaded');
      const doc = await PDFDocument.load(await res.arrayBuffer());
      const changed = await BuildReportModule.fillDocument(doc, map);
      if (!changed) throw new Error('No placeholders were found in the sprint report template');

      // Page index 3 = Quality & Sprint Overview charts; index 4 = Sprint Execution Trends.
      const pages = doc.getPages();
      if (pages[3]) await BuildReportModule.drawCharts(doc, pages[3], SUITE_SLOTS, charts.suite);
      if (pages[4]) await BuildReportModule.drawCharts(doc, pages[4], TREND_SLOTS, charts.trends);

      const bytes = await doc.save();
      const safe = (this.sprintNumber() ? `Sprint-${this.sprintNumber()}` : new Date().toISOString().slice(0, 10)).replace(/[^a-z0-9]+/gi, '-');
      ReportModule.downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `OrangeHRM-Sprint-Report-${safe}.pdf`);
      ReportModule.toast('Sprint report generated successfully');
    });
  },
};
