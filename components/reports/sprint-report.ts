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
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
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
const PW = 595.28;
const PH = 841.89;
const FULL_W = PW - 2 * MX;
// Report palette — MUST match scripts/sprint-template.mjs so the runtime-drawn
// delivery tables (and continuation pages) are visually identical to the template.
const RC = {
  navy: rgb(0.078, 0.192, 0.373),
  blue: rgb(0.184, 0.435, 0.929),
  ink: rgb(0.106, 0.141, 0.227),
  muted: rgb(0.373, 0.420, 0.502),
  panel: rgb(0.957, 0.969, 0.984),
  border: rgb(0.765, 0.808, 0.875),
  white: rgb(1, 1, 1),
};
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

// Page-3 delivery tables. Rows are unbounded — they're drawn at runtime (see
// drawDeliveryTables) and flow onto continuation pages, so there is no fixed row
// cap. `colX` are the point-based column origins for the PDF renderer (top-left,
// x from the page left edge); `grid` is the matching CSS grid for the HTML editor.
interface ColSpec { label: string; placeholder?: string; type?: 'text' | 'select'; options?: string[]; }
interface TableSpec { id: string; title: string; grid: string; colX: number[]; cols: ColSpec[]; }

const TABLE_SPECS: TableSpec[] = [
  {
    id: 't1', title: 'Completed Work', grid: '1.2fr 1.6fr 1fr 26px', colX: [MX, MX + 175, MX + 410],
    cols: [
      { label: 'Completed Item', placeholder: 'New Login Automation' },
      { label: 'Outcome / Value Delivered', placeholder: 'Faster regression coverage' },
      { label: 'Reference', placeholder: 'JIRA-1234' },
    ],
  },
  {
    id: 't2', title: 'Work In Progress & Blockers', grid: '1.2fr 1fr 1fr 1.6fr 26px', colX: [MX, MX + 130, MX + 220, MX + 315],
    cols: [
      { label: 'Workstream', placeholder: 'Payroll API tests' },
      { label: 'Current Status', type: 'select', options: ['', 'In Progress', 'Blocked'] },
      { label: 'Owner', placeholder: 'A. Naidoo' },
      { label: 'Next Action / Blocker', placeholder: 'Waiting on staging data' },
    ],
  },
  {
    id: 't3', title: 'Sprint Goals & Achievements', grid: '1fr 2.4fr 26px', colX: [MX, MX + 130],
    cols: [
      { label: 'Area', placeholder: 'Quality' },
      { label: 'Details', placeholder: 'Raised suite pass rate above 95%' },
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

  /** Append one empty input row to a table. Rows are unbounded — overflow flows
      onto continuation pages at PDF-build time (see drawDeliveryTables). */
  addRow(tableId: string): void {
    const spec = TABLE_SPECS.find(s => s.id === tableId);
    const rows = document.getElementById(`ste-rows-${tableId}`);
    if (!spec || !rows) return;
    const row = document.createElement('div');
    row.className = 'ste-row';
    row.innerHTML = spec.cols.map(c =>
      c.type === 'select'
        ? `<select class="report-input ste-input">${(c.options || []).map(o => `<option value="${Utils.escape(o)}">${o ? Utils.escape(o) : 'Select…'}</option>`).join('')}</select>`
        : `<input type="text" class="report-input ste-input" placeholder="${Utils.escape(c.placeholder || '')}" />`,
    ).join('') + `<button type="button" class="ste-remove" aria-label="Remove row" title="Remove row">×</button>`;
    rows.appendChild(row);
    row.querySelector('.ste-remove')?.addEventListener('click', () => row.remove());
  },

  /** Read a table's filled rows as ordered cell values, skipping any fully-empty
      row. Returns only real content — the renderer sizes the table to fit. */
  readRows(spec: TableSpec): string[][] {
    const rows = document.getElementById(`ste-rows-${spec.id}`);
    if (!rows) return [];
    return [...rows.querySelectorAll('.ste-row:not(.ste-head)')]
      .map(row => [...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.ste-input')].map(el => el.value.trim()))
      .map(r => spec.cols.map((_, i) => r[i] || ''))
      .filter(r => r.some(c => c));
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

    // Page 3 delivery tables are NOT token-filled — they're drawn at runtime from
    // the editors (see drawDeliveryTables), so they can grow past one page.
    return map;
  },

  /* ── Page-3 delivery tables: runtime renderer ─────────────────────────────────
     The three tables are drawn directly with pdf-lib onto the template's page-3
     anchor, flowing top-to-bottom. When a row would cross the bottom margin the
     renderer inserts a continuation page (same heading/footer + a repeated column
     header) and carries on, so any number of rows is supported. Returns the number
     of continuation pages inserted (used to correct later pages' page numbers). */
  async drawDeliveryTables(doc: PDFDocument, startPage: PDFPage, sprintTag: string, reg: PDFFont, bold: PDFFont): Promise<number> {
    const TITLE_GAP = 18, HEAD_H = 22, ROW_H = 22, TABLE_GAP = 22;
    const TOP_Y = 112;        // first table title, just under the page heading
    const BOTTOM = 770;       // last drawable y before the footer band

    const startIdx = doc.getPages().indexOf(startPage);
    let page = startPage;
    let cont = 0;

    // Top-left-origin helpers (the template measures y down from the page top).
    const tText = (pg: PDFPage, font: PDFFont, str: string, x: number, yTop: number, size: number, color: typeof RC.ink) =>
      pg.drawText(str, { x, y: PH - yTop - size, size, font, color });
    const tRect = (pg: PDFPage, x: number, yTop: number, w: number, h: number, color: typeof RC.ink) =>
      pg.drawRectangle({ x, y: PH - yTop - h, width: w, height: h, color });
    const tBorder = (pg: PDFPage, x: number, yTop: number, w: number, h: number) =>
      pg.drawRectangle({ x, y: PH - yTop - h, width: w, height: h, borderColor: RC.border, borderWidth: 0.5 });

    const drawHeadRow = (pg: PDFPage, spec: TableSpec, headY: number) => {
      tRect(pg, MX, headY, FULL_W, HEAD_H, RC.navy);
      spec.cols.forEach((c, i) => tText(pg, bold, c.label, spec.colX[i] + 10, headY + 7, 8.5, RC.white));
    };
    const drawFooter = (pg: PDFPage, n: number) => {
      tText(pg, reg, `OrangeHRM Test Pulse Sprint Report  ${sprintTag}`, MX, PH - 38, 8, RC.muted);
      tText(pg, reg, 'Confidential — Internal Use Only', PW / 2 - 70, PH - 38, 8, RC.muted);
      tText(pg, reg, `Page ${n}`, PW - MX - 36, PH - 38, 8, RC.muted);
    };
    // A fresh continuation page, inserted right after the anchor (and after any
    // earlier continuation pages), mirroring the template's heading + footer.
    const newPage = (): PDFPage => {
      const idx = startIdx + (++cont);
      const pg = doc.insertPage(idx, [PW, PH]);
      tText(pg, bold, 'Sprint Summary & Delivery Overview', MX, 52, 16, RC.navy);
      tText(pg, reg, 'Delivery tables (continued).', MX, 75, 10, RC.muted);
      pg.drawRectangle({ x: MX, y: PH - 96, width: 44, height: 2.5, color: RC.blue });
      drawFooter(pg, idx + 1);
      return pg;
    };

    let y = TOP_Y;
    for (const spec of TABLE_SPECS) {
      const rows = this.readRows(spec);
      if (!rows.length) continue;                          // skip a table with no content
      // Keep the title + header + first row together (never orphan a header).
      if (y + TITLE_GAP + HEAD_H + ROW_H > BOTTOM) { page = newPage(); y = TOP_Y; }
      tText(page, bold, spec.title, MX, y, 11, RC.navy);
      let headY = y + TITLE_GAP;
      drawHeadRow(page, spec, headY);
      let ry = headY + HEAD_H;
      for (let i = 0; i < rows.length; i++) {
        if (ry + ROW_H > BOTTOM) {                         // overflow → continuation page
          page = newPage();
          tText(page, bold, `${spec.title} (continued)`, MX, TOP_Y, 11, RC.navy);
          headY = TOP_Y + TITLE_GAP;
          drawHeadRow(page, spec, headY);
          ry = headY + HEAD_H;
        }
        if (i % 2 === 0) tRect(page, MX, ry, FULL_W, ROW_H, RC.panel);
        tBorder(page, MX, ry, FULL_W, ROW_H);
        rows[i].forEach((cell, ci) => {
          if (!cell) return;
          tText(page, ci === 0 ? bold : reg, cell, spec.colX[ci] + 10, ry + ROW_H / 2 - 4, 8.5, ci === 0 ? RC.ink : RC.muted);
        });
        ry += ROW_H;
      }
      y = ry + TABLE_GAP;
    }
    return cont;
  },

  /** Overlay the correct "Page N" onto a page whose baked number was shifted by
      inserted continuation pages (footer band is white on the content pages). */
  stampPageNumber(page: PDFPage, n: number, reg: PDFFont): void {
    page.drawRectangle({ x: PW - MX - 50, y: 26, width: 56, height: 18, color: RC.white });
    page.drawText(`Page ${n}`, { x: PW - MX - 36, y: 30, size: 8, font: reg, color: RC.muted });
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

      const reg = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);

      // Page index 2 = Sprint Summary & Delivery Overview anchor. Draw the delivery
      // tables first: they may insert continuation pages, which shifts everything
      // after them — so the chart pages must be resolved AFTER this, as the last two.
      const startPage = doc.getPages()[2];
      const cont = startPage ? await this.drawDeliveryTables(doc, startPage, map.sprintTag, reg, bold) : 0;

      // Charts always live on the final two pages (Quality, then Trends), regardless
      // of how many delivery continuation pages were inserted before them.
      const pages = doc.getPages();
      const qualityPage = pages[pages.length - 2];
      const trendsPage = pages[pages.length - 1];
      if (qualityPage) await BuildReportModule.drawCharts(doc, qualityPage, SUITE_SLOTS, charts.suite);
      if (trendsPage) await BuildReportModule.drawCharts(doc, trendsPage, TREND_SLOTS, charts.trends);

      // Continuation pages pushed the chart pages down, so their baked "Page 4/5"
      // footers are now wrong — restamp them with the correct numbers.
      if (cont > 0) {
        if (qualityPage) this.stampPageNumber(qualityPage, 4 + cont, reg);
        if (trendsPage) this.stampPageNumber(trendsPage, 5 + cont, reg);
      }

      const bytes = await doc.save();
      const safe = (this.sprintNumber() ? `Sprint-${this.sprintNumber()}` : new Date().toISOString().slice(0, 10)).replace(/[^a-z0-9]+/gi, '-');
      ReportModule.downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `OrangeHRM-Sprint-Report-${safe}.pdf`);
      ReportModule.toast('Sprint report generated successfully');
    });
  },
};
