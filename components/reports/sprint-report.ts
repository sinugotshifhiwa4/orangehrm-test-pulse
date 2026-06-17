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
import { ReportLabels } from './report-labels';

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

// Page-3 delivery tables. `max` MUST match the fixed row slots in
// scripts/sprint-template.mjs; `tokens` are the per-column placeholder prefixes.
interface ColSpec { label: string; token: string; placeholder?: string; type?: 'text' | 'select'; options?: string[]; }
interface TableSpec { id: string; title: string; grid: string; max: number; cols: ColSpec[]; }

const TABLE_SPECS: TableSpec[] = [
  {
    id: 't1', title: 'Completed Work', max: 5, grid: '1.2fr 1.6fr 1fr 26px',
    cols: [
      { label: 'Completed Item', token: 't1_item', placeholder: 'New Login Automation' },
      { label: 'Outcome / Value Delivered', token: 't1_out', placeholder: 'Faster regression coverage' },
      { label: 'Reference', token: 't1_ref', placeholder: 'JIRA-1234' },
    ],
  },
  {
    id: 't2', title: 'Work In Progress & Blockers', max: 4, grid: '1.2fr 1fr 1fr 1.6fr 26px',
    cols: [
      { label: 'Workstream', token: 't2_ws', placeholder: 'Payroll API tests' },
      { label: 'Current Status', token: 't2_status', type: 'select', options: ['', 'In Progress', 'Blocked'] },
      { label: 'Owner', token: 't2_owner', placeholder: 'A. Naidoo' },
      { label: 'Next Action / Blocker', token: 't2_next', placeholder: 'Waiting on staging data' },
    ],
  },
  {
    id: 't3', title: 'Sprint Goals & Achievements', max: 6, grid: '1fr 2.4fr 26px',
    cols: [
      { label: 'Area', token: 't3_area', placeholder: 'Quality' },
      { label: 'Details', token: 't3_detail', placeholder: 'Raised suite pass rate above 95%' },
    ],
  },
];

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

  /* ── Page-3 delivery table editors ────────────────────────────────────────
     A small structured row editor per table (one input/select per column, with
     Add row / × remove), replacing the old pipe-delimited textareas. */

  /** Build the three editors into #sprint-tables. Idempotent. */
  mountTables(): void {
    const host = document.getElementById('sprint-tables');
    if (!host || host.dataset.mounted === '1') return;
    host.dataset.mounted = '1';
    host.innerHTML = TABLE_SPECS.map(spec => `
      <div class="ste" data-table="${spec.id}" style="--ste-grid:${spec.grid}">
        <div class="ste-title">${Utils.escape(spec.title)}</div>
        <div class="ste-rows" id="ste-rows-${spec.id}">
          <div class="ste-row ste-head">${spec.cols.map(c => `<span>${Utils.escape(c.label)}</span>`).join('')}<span></span></div>
        </div>
        <button type="button" class="btn ste-add" data-add="${spec.id}">+ Add row</button>
      </div>`).join('');
    TABLE_SPECS.forEach(spec => {
      this.addRow(spec.id);
      host.querySelector(`[data-add="${spec.id}"]`)?.addEventListener('click', () => this.addRow(spec.id));
    });
  },

  /** Append one empty input row to a table, up to its max. */
  addRow(tableId: string): void {
    const spec = TABLE_SPECS.find(s => s.id === tableId);
    const rows = document.getElementById(`ste-rows-${tableId}`);
    if (!spec || !rows) return;
    if (rows.querySelectorAll('.ste-row:not(.ste-head)').length >= spec.max) return;
    const row = document.createElement('div');
    row.className = 'ste-row';
    row.innerHTML = spec.cols.map(c =>
      c.type === 'select'
        ? `<select class="report-input ste-input">${(c.options || []).map(o => `<option value="${Utils.escape(o)}">${o ? Utils.escape(o) : 'Select…'}</option>`).join('')}</select>`
        : `<input type="text" class="report-input ste-input" placeholder="${Utils.escape(c.placeholder || '')}" />`,
    ).join('') + `<button type="button" class="ste-remove" aria-label="Remove row" title="Remove row">×</button>`;
    rows.appendChild(row);
    row.querySelector('.ste-remove')?.addEventListener('click', () => { row.remove(); this.refreshAddState(tableId); });
    this.refreshAddState(tableId);
  },

  /** Disable a table's Add button once it has hit its row cap. */
  refreshAddState(tableId: string): void {
    const spec = TABLE_SPECS.find(s => s.id === tableId);
    const rows = document.getElementById(`ste-rows-${tableId}`);
    const add = document.querySelector<HTMLButtonElement>(`[data-add="${tableId}"]`);
    if (!spec || !rows || !add) return;
    add.disabled = rows.querySelectorAll('.ste-row:not(.ste-head)').length >= spec.max;
  },

  /** Read a table's rows as ordered cell values, padded/truncated to its max so
      every fixed template slot gets a value (blank slots clear the placeholder). */
  readRows(spec: TableSpec): string[][] {
    const rows = document.getElementById(`ste-rows-${spec.id}`);
    const got = rows
      ? [...rows.querySelectorAll('.ste-row:not(.ste-head)')].map(row =>
          [...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.ste-input')].map(el => el.value.trim()))
      : [];
    const out = got.slice(0, spec.max).map(r => spec.cols.map((_, i) => r[i] || ''));
    while (out.length < spec.max) out.push(spec.cols.map(() => ''));
    return out;
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
    const sprintReadiness = ReportLabels.readiness(readinessScore);
    const readinessSummary = ReportLabels.readinessNote(sprintReadiness);

    // Overall Health mirrors the Overview "Overall Health" card (run-health model).
    const runHealth = summary.runHealth;
    const sprintStatus = ReportLabels.grade(runHealth);
    const sprintQuality = ReportLabels.grade(summary.weightedPassRate);
    const sprintStability = ReportLabels.stability(summary.failingRuns, summary.totalFlaky);

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

      overallHealth: ReportLabels.healthLine(runHealth),
      healthNote: `Weighted pass rate ${Utils.pct(summary.weightedPassRate)} across ${runs.length} run${runs.length === 1 ? '' : 's'}`,
      failingRuns: String(summary.failingRuns),
      flakyExposure: String(summary.totalFlaky),
      testSuiteScore: String(summary.releaseScore),
      suiteRiskLevel: suiteRisk,
    };

    // Page 3 — delivery tables (user-entered narrative content from the editors).
    TABLE_SPECS.forEach(spec => {
      this.readRows(spec).forEach((cells, i) => {
        spec.cols.forEach((c, ci) => { map[`${c.token}_${i + 1}`] = cells[ci]; });
      });
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
