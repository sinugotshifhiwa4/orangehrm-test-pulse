/* ══════════════════════════════════════════
   OrangeHRM Build Report (PDF) builder.

   Fills the clean template at data/template/OrangeHRM-Build-Report.pdf — see
   scripts/build-template.mjs — with live dashboard data and charts:

   • Text: the template is built with a single standard font (Helvetica), so all
     visible text is single-byte WinAnsi `<hex>` show-strings, each holding a
     whole `{{token}}`. Filling is a reliable round trip — inflate each page
     content stream, decode each hex string, swap `{{token}}` for its value,
     re-encode, and let pdf-lib re-serialise the file.

   • Charts: the Test Suite Overview and Execution Trends pages carry fixed image
     slots (SUITE_SLOTS / TREND_SLOTS, kept in step with the generator). The live
     dashboard charts are rendered off-screen at high resolution, recoloured for
     the report's light background, embedded as PNGs, and drawn into the slots.

   No font subsetting, CID encoding, or split-token problems — those plagued the
   original ilovepdf-exported template and are why it was regenerated cleanly.
   ══════════════════════════════════════════ */
import { PDFDocument, PDFName, PDFRef, PDFArray, PDFRawStream } from 'pdf-lib';
import templateUrl from '../../data/template/OrangeHRM-Build-Report.pdf?url';
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { CHART_DEFAULTS } from '../../app/config';
import { AnalyticsModule } from '../../app/core/analytics';
import { ChartModule } from '../trends/charts';
import { ReportModule } from './report';
import { ReportLabels } from './report-labels';

/** Deep-restore source values into target, preserving target's object identity
    (the live charts hold references to CHART_DEFAULTS' nested objects). */
function deepRestore(target: any, source: any): void {
  for (const k of Object.keys(source)) {
    const sv = source[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepRestore(target[k], sv);
    } else {
      target[k] = sv; // overwrite (covers primitives and object⇄primitive type changes, e.g. layout.padding)
    }
  }
}

interface BuildMeta {
  buildNumber: string;
  buildDate: string;
  preparedBy: string;
  audience: string;
}

type FillMap = Record<string, string>;
interface ChartImg { data: string; w: number; h: number; }
interface Slot { x: number; yTop: number; w: number; h: number; alignTop?: boolean; }

// A `<…>` hex show-string in a content stream (the only `<…>` form pdf-lib emits there).
const HEX_STRING = /<([0-9A-Fa-f\s]+)>/g;
// A `{{token}}` placeholder.
const TOKEN = /\{\{(\w+)\}\}/g;

// Chart slots — MUST match scripts/build-template.mjs. A4 points, top-left origin.
const PAGE_H = 841.89;
const MX = 40;
const FULL_W = 595.28 - 2 * MX;
// [0] = Outcome doughnut (left, beside the % breakdown); [1] = Success gauge (full-width below).
const SUITE_SLOTS: Slot[] = [
  { x: MX, yTop: 336, w: 240, h: 196 },
  // Gauge: top-aligned so it lines up with the Overall Health panel and sits close
  // to its "Run Success Rate" header (the semicircle is short, leaving room below).
  { x: MX, yTop: 566, w: 240, h: 160, alignTop: true },
];
const TREND_SLOTS: Slot[] = [
  { x: MX, yTop: 178, w: FULL_W, h: 126 },
  { x: MX, yTop: 328, w: FULL_W, h: 126 },
  { x: MX, yTop: 478, w: FULL_W, h: 126 },
  { x: MX, yTop: 628, w: FULL_W, h: 126 },
];

export const BuildReportModule = {
  field(id: string): string {
    return (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() || '';
  },

  /** Most recent run in scope — the same run shown on the Overview "Latest <tag> Run" card. */
  latestRun(): Run | null {
    return [...State.filteredRuns].sort((a, b) => b._dateMs - a._dateMs)[0] || null;
  },

  ymd(run: Run): string {
    const d = new Date(run._dateMs);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** Pre-fill Build number / date from the Overview latest run (unless the user edited them). */
  syncDefaults(): void {
    const latest = this.latestRun();
    const numEl = document.getElementById('build-number') as HTMLInputElement | null;
    const dateEl = document.getElementById('build-date') as HTMLInputElement | null;
    // Defaults: latest build number + today's date. Both stay editable (the
    // dataset.touched guard leaves any value the user has typed untouched).
    if (numEl && numEl.dataset.touched !== '1') numEl.value = latest ? String(latest.runNumber ?? latest.buildNumber ?? '') : '';
    if (dateEl && dateEl.dataset.touched !== '1') dateEl.value = this.today();
  },

  today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  meta(latest: Run | null): BuildMeta {
    const rawDate = this.field('build-date');
    return {
      buildNumber: this.field('build-number') || String(latest?.runNumber ?? latest?.buildNumber ?? '—'),
      buildDate: rawDate
        ? Utils.formatDateOnly(rawDate)
        : (latest?.formattedDate || Utils.formatDateOnly(new Date().toISOString())),
      preparedBy: this.field('build-prepared-by') || 'Automation Team',
      audience: this.field('build-audience') || 'Stakeholders',
    };
  },

  /* ── Hex string helpers (single-byte WinAnsi, as written by pdf-lib) ── */
  hexToText(hex: string): string {
    const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
    let s = '';
    for (let i = 0; i + 1 < clean.length; i += 2) s += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    return s;
  },
  textToHex(text: string): string {
    let h = '';
    for (let i = 0; i < text.length; i++) h += (text.charCodeAt(i) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    return h;
  },
  dataUrlToBytes(dataUrl: string): Uint8Array {
    const bin = atob(dataUrl.split(',')[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  /** Inflate a FlateDecode (zlib) stream using the browser's native decoder. */
  async inflate(bytes: Uint8Array): Promise<Uint8Array> {
    const ds = new (globalThis as unknown as { DecompressionStream: new (f: string) => GenericTransformStream }).DecompressionStream('deflate');
    const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  },

  /** Replace every `{{token}}` inside one decoded content stream by rewriting the
      hex show-strings that contain placeholders. */
  fillStreamText(text: string, map: FillMap): string {
    return text.replace(HEX_STRING, (full, hex: string) => {
      const decoded = this.hexToText(hex);
      if (!decoded.includes('{{')) return full;
      const filled = decoded.replace(TOKEN, (m, key: string) => (key in map ? map[key] : m));
      return `<${this.textToHex(filled)}>`;
    });
  },

  /** Walk every page's content stream(s), inflating, filling, and writing each
      back uncompressed. Returns the number of streams actually changed. */
  async fillDocument(doc: PDFDocument, map: FillMap): Promise<number> {
    let changed = 0;
    for (const page of doc.getPages()) {
      const contents = page.node.get(PDFName.of('Contents'));
      const refs: PDFRef[] = [];
      if (contents instanceof PDFRef) refs.push(contents);
      else if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
          const e = contents.get(i);
          if (e instanceof PDFRef) refs.push(e);
        }
      }
      for (const ref of refs) {
        const stream = doc.context.lookup(ref);
        if (!(stream instanceof PDFRawStream)) continue;
        const filter = stream.dict.get(PDFName.of('Filter'));
        const filterName = filter ? filter.toString() : '';
        let decoded: Uint8Array;
        if (filterName.includes('FlateDecode')) decoded = await this.inflate(stream.contents);
        else if (!filter) decoded = stream.contents;
        else continue; // unknown/unsupported filter — leave as designed
        const text = new TextDecoder('latin1').decode(decoded);
        const filled = this.fillStreamText(text, map);
        if (filled === text) continue;
        const outBytes = Uint8Array.from(filled, c => c.charCodeAt(0) & 0xff);
        doc.context.assign(ref, doc.context.stream(outBytes)); // uncompressed; pdf-lib sets /Length
        changed++;
      }
    }
    return changed;
  },

  /* ── Chart rendering ──────────────────────────────────────────────────────
     The dashboard charts are styled for the dark dashboard surface. For the
     light report we recolour text/grid to dark equivalents and scale the type up
     (the styles are tuned for the small ~370px card), render off-screen at high
     resolution onto white, and frame each as a soft-bordered panel. */
  lightTheme(chart: { options: any; data: { datasets: any[] } }): void {
    const INK = '#1b243a';
    const MUTED = '#5f6b80';
    const GRID = 'rgba(13,24,45,0.08)';
    const TRACK = '#e6ebf2';
    const o = chart.options;
    if (o.plugins?.legend?.labels) o.plugins.legend.labels.color = MUTED;
    for (const axis of ['x', 'y'] as const) {
      const s = o.scales?.[axis];
      if (s?.ticks) s.ticks.color = MUTED;
      if (s?.grid) s.grid.color = GRID;
    }
    o.plugins?.centerText?.lines?.forEach((l: { color?: string }) => {
      if (l.color === '#f0f1f5') l.color = INK;
      else if (l.color === '#7c82a0') l.color = MUTED;
    });
    chart.data.datasets.forEach(ds => {
      if (ds.borderColor === '#0e0f13') ds.borderColor = '#ffffff';
      if (Array.isArray(ds.backgroundColor)) {
        // Gauge "remaining" → light track; and darken the pale Skipped slice
        // (#c1c7d6) so it stays visible on the white report instead of reading as
        // an empty gap in the ring.
        ds.backgroundColor = ds.backgroundColor.map((c: string) => (c === '#21263a' ? TRACK : c === '#c1c7d6' ? '#9aa3b8' : c));
      }
    });
  },

  scaleForReport(chart: { options: any }, scale: number): void {
    const o = chart.options;
    const ct = o.plugins?.centerText;
    if (ct?.lines?.length) {
      ct.lines.forEach((l: { font: string }) => {
        l.font = l.font.replace(/(\d+(?:\.\d+)?)px/, (_m, n) => `${Math.round(Number(n) * scale)}px`);
      });
      ct.lineStep = Math.round((ct.lineStep ?? 17) * scale);
    }
    const lab = o.plugins?.legend?.labels;
    if (lab) {
      if (!lab.font) lab.font = {};
      lab.font.size = Math.round((lab.font.size ?? 10) * scale);
      lab.boxWidth = Math.round((lab.boxWidth ?? 10) * scale);
      lab.boxHeight = Math.round((lab.boxHeight ?? 10) * scale);
      lab.padding = Math.round((lab.padding ?? 16) * 1.3);
    }
    for (const axis of ['x', 'y'] as const) {
      const t = o.scales?.[axis]?.ticks;
      if (t) { if (!t.font) t.font = {}; t.font.size = Math.round((t.font.size ?? 9) * scale); }
    }
    if (o.layout) o.layout.padding = Math.round(8 * scale);
  },

  async renderChartImage(draw: (id: string) => void, W: number, H: number, hideLegend = false, fullCircle = false): Promise<ChartImg | null> {
    // lightTheme/scaleForReport recolour and rescale via chart.options, which share
    // CHART_DEFAULTS' nested objects by reference. Snapshot now and restore in the
    // finally so neither the live dashboard charts nor sibling report charts inherit
    // these one-off report tweaks.
    const defaultsSnapshot = structuredClone(CHART_DEFAULTS);
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${W}px;height:${H}px;background:#ffffff;`;
    const canvas = document.createElement('canvas');
    const id = `__bld_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    canvas.id = id;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    host.appendChild(canvas);
    document.body.appendChild(host);
    try {
      draw(id);
      const chart = State.charts[id];
      if (!chart) return null;
      // Capture the final static frame: the doughnut/gauge play an entry animation
      // (the arc sweeping from 0° to full). animation=false alone does not cancel
      // the already-running animation, so we also chart.stop() before the capture —
      // otherwise the in-progress sweep is caught and reads as a partial ring.
      chart.options.animation = false;
      chart.options.maintainAspectRatio = false;
      // Single-series trend charts already have a panel caption; their scaled-up
      // legend would overflow the slot, so drop it. Keep it for the doughnut/gauge
      // where the Passed/Failed/Flaky/Skipped key is meaningful.
      if (hideLegend && chart.options.plugins?.legend) chart.options.plugins.legend.display = false;
      // Render the doughnut/gauge as a full 360° ring for the report (the dashboard
      // success gauge is a 180° half-ring) and centre its label.
      if (fullCircle) {
        const ds = chart.data.datasets[0] as { circumference?: number; rotation?: number } | undefined;
        if (ds) { ds.circumference = 360; ds.rotation = 0; }
        const ct = (chart.options.plugins as { centerText?: { gauge?: boolean } } | undefined)?.centerText;
        if (ct) ct.gauge = false;
      }
      this.lightTheme(chart);
      this.scaleForReport(chart, 3);
      await new Promise(resolve => setTimeout(resolve, 120));
      chart.resize(W, H);
      chart.stop();          // cancel any in-flight entry animation
      chart.update('none');
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const src = chart.canvas;
      const out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0);
      const lw = Math.max(2, Math.round(out.width / 360));
      const radius = Math.round(Math.min(out.width, out.height) * 0.03);
      ctx.strokeStyle = '#c3cedf';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.roundRect(lw, lw, out.width - 2 * lw, out.height - 2 * lw, radius);
      ctx.stroke();
      return { data: out.toDataURL('image/png'), w: out.width, h: out.height };
    } finally {
      ChartModule.destroy(id);
      document.body.removeChild(host);
      deepRestore(CHART_DEFAULTS, defaultsSnapshot);
    }
  },

  /** Embed each chart PNG and draw it into its slot, fit preserving aspect ratio. */
  async drawCharts(doc: PDFDocument, page: ReturnType<PDFDocument['getPage']>, slots: Slot[], imgs: (ChartImg | null)[]): Promise<void> {
    for (let i = 0; i < slots.length; i++) {
      const img = imgs[i];
      if (!img) continue;
      const png = await doc.embedPng(this.dataUrlToBytes(img.data));
      const slot = slots[i];
      const ar = img.w / img.h;
      const rectAr = slot.w / slot.h;
      const w = ar > rectAr ? slot.w : slot.h * ar;
      const h = ar > rectAr ? slot.w / ar : slot.h;
      const x = slot.x + (slot.w - w) / 2;
      const yTop = slot.alignTop ? slot.yTop : slot.yTop + (slot.h - h) / 2;
      page.drawImage(png, { x, y: PAGE_H - yTop - h, width: w, height: h });
    }
  },

  /** Render the six dashboard charts the report uses, off-screen, in document order. */
  async renderCharts(runs: Run[]): Promise<{ suite: (ChartImg | null)[]; trends: (ChartImg | null)[] }> {
    // Outcome doughnut: square canvas + full 360° ring. Success gauge: wide canvas,
    // kept as its native 180° semicircle (the Visuals "Quality" tab style).
    const suite = [
      await this.renderChartImage(id => ChartModule.outcomeDoughnut(runs, id), 820, 820, false, true),
      await this.renderChartImage(id => ChartModule.successGauge(runs, id), 760, 420, false, false),
    ];
    // Wide aspect matching the full-width trend slots, so each chart fills its row.
    const trends = [
      await this.renderChartImage(id => ChartModule.passRate(runs, id, { compactLabels: true }), 1560, 400, true),
      await this.renderChartImage(id => ChartModule.failures(runs, id), 1560, 400, true),
      await this.renderChartImage(id => ChartModule.flaky(runs, id), 1560, 400, true),
      await this.renderChartImage(id => ChartModule.duration(runs, id), 1560, 400, true),
    ];
    return { suite, trends };
  },

  /** Map every template placeholder to its live value — the single source of truth
      for the template's `{{tokens}}` (kept in step with scripts/build-template.mjs). */
  buildMap(runs: Run[]): FillMap {
    const ordered = [...runs].sort((a, b) => b._dateMs - a._dateMs);
    const latest = ordered[0] || null;
    const prev = ordered[1] || null;
    const summary = AnalyticsModule.summarize(runs);
    const meta = this.meta(latest);

    const testsDelta = latest && prev ? (latest.total || 0) - (prev.total || 0) : 0;
    const testsDeltaText = `${testsDelta >= 0 ? '+' : ''}${testsDelta}`;
    const testGrowthPct = prev && (prev.total || 0) > 0 ? Math.round((testsDelta / (prev.total as number)) * 100) : 0;
    const passingRuns = runs.length - summary.failingRuns;
    const avgPass = Math.round(summary.avgPass);
    // Aggregate test-outcome totals across all runs in scope (matches the Overview
    // "Outcome Composition" doughnut + breakdown, which sum every run's outcomes).
    const sum = (k: keyof Run) => runs.reduce((a, r) => a + ((r[k] as number) || 0), 0);
    const outPassed = sum('passed'), outFailed = sum('failed'), outFlaky = sum('flaky'), outSkipped = sum('skipped');
    const outTotal = outPassed + outFailed + outFlaky + outSkipped;
    const opct = (v: number) => (outTotal ? `${Math.round((v / outTotal) * 100)}%` : '0%');
    const moduleHealth = Math.round(summary.weightedPassRate);
    const avgDuration = Utils.formatDuration(Utils.avg(runs.filter(r => r.durationMin != null).map(r => r.durationMin as number)));
    // Suite risk: across the runs in scope (includes critical-tag failures) — shown
    // on Overall Health. Build risk (below) is for this build alone.
    const suiteRisk = (latest?.status === 'FAIL' || summary.criticalFailingRuns > 0) ? 'High'
      : (summary.totalFlaky > 0 || summary.weightedPassRate < 90) ? 'Medium' : 'Low';
    // Quality for this build, graded on its pass rate (shared report vocabulary).
    const qualityTrend = ReportLabels.grade(latest?.passRate ?? 0);
    // Two page-4 summary pieces beside the gauge.
    // Overall Health mirrors the Overview "Overall Health" card exactly: the
    // run-health score (NOT the release-gate score) + weighted pass rate context.
    const runHealth = summary.runHealth;
    // Build Release score: a release gate for THIS build's run (the latest run) —
    // distinct from the suite-wide Test Suite score (summary.releaseScore, which is
    // computed across the runs in scope) and the run-health model. It is the run's
    // pass rate, docked for flaky exposure and a hard dock if the run failed.
    const buildPass = latest?.passRate ?? 0;
    const buildFlakyDock = latest && latest.total ? Utils.clamp(((latest.flaky || 0) / latest.total) * 100 * 0.5, 0, 16) : 0;
    const buildReleaseScore = Math.round(Utils.clamp(buildPass - buildFlakyDock - (latest?.status === 'FAIL' ? 15 : 0), 0, 100));
    const releaseReadiness = ReportLabels.readiness(buildReleaseScore);
    const readinessSummary = ReportLabels.readinessNote(releaseReadiness);
    // Build risk: this build's own risk, derived from its release score (so a
    // healthy passing build reads Low even when the suite is at risk).
    const buildRisk = buildReleaseScore >= 90 ? 'Low' : buildReleaseScore >= 75 ? 'Medium' : 'High';

    return {
      buildNumber: meta.buildNumber,
      buildDate: meta.buildDate,
      preparedBy: meta.preparedBy,
      audience: meta.audience,
      generated: new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }),
      totalTests: String(latest?.total ?? 0),
      passRate: Utils.pct(latest?.passRate),
      failedTests: String(latest?.failed ?? 0),
      flakyTests: String(latest?.flaky ?? 0),
      skippedTests: String(latest?.skipped ?? 0),
      suiteHealth: `${moduleHealth}%`,
      testGrowth: `${testGrowthPct >= 0 ? '+' : ''}${testGrowthPct}%`,
      topFailing: String(latest?.failed ?? 0),
      buildStatus: latest?.status === 'PASS' ? 'Passed' : 'Failed',
      qualityTrend,
      riskLevel: buildRisk,
      suiteRiskLevel: suiteRisk,
      overallHealth: ReportLabels.healthLine(runHealth),
      healthNote: `Weighted pass rate ${Utils.pct(summary.weightedPassRate)} across ${runs.length} run${runs.length === 1 ? '' : 's'}`,
      runsCount: String(runs.length),
      failingRuns: String(summary.failingRuns),
      flakyExposure: String(summary.totalFlaky),
      testSuiteScore: String(summary.releaseScore),
      releaseReadiness,
      buildReleaseScore: String(buildReleaseScore),
      readinessSummary,
      outPassed: String(outPassed),
      outPassedPct: opct(outPassed),
      outFailed: String(outFailed),
      outFailedPct: opct(outFailed),
      outFlaky: String(outFlaky),
      outFlakyPct: opct(outFlaky),
      outSkipped: String(outSkipped),
      outSkippedPct: opct(outSkipped),
      passRateInsight: `${avgPass}% avg pass rate over ${runs.length} runs`,
      buildSuccessInsight: `${passingRuns}/${runs.length} runs passed`,
      durationInsight: `${avgDuration} average run duration`,
      testGrowthInsight: `${testsDeltaText} tests vs previous build`,
    };
  },

  async build(): Promise<void> {
    // Guard up-front so the reason reaches the user — runWithButton's catch
    // otherwise replaces it with a generic "please try again" alert.
    const runs = State.filteredRuns;
    if (!runs.length) {
      ReportModule.toast('No runs in scope to build a build report. Adjust the dashboard filters and try again.', 'error');
      return;
    }

    await ReportModule.runWithButton('report-build-btn', async () => {
      const map = this.buildMap(runs);
      // Render charts first (needs a live DOM), then patch the template.
      const charts = await this.renderCharts(runs);

      const res = await fetch(templateUrl);
      if (!res.ok) throw new Error('Build report template could not be loaded');
      const doc = await PDFDocument.load(await res.arrayBuffer());
      const changed = await this.fillDocument(doc, map);
      if (!changed) throw new Error('No placeholders were found in the build report template');

      // Page index 2 = merged Quality & Test Suite page; index 3 = Execution Trends.
      const pages = doc.getPages();
      if (pages[2]) await this.drawCharts(doc, pages[2], SUITE_SLOTS, charts.suite);
      if (pages[3]) await this.drawCharts(doc, pages[3], TREND_SLOTS, charts.trends);

      const bytes = await doc.save();
      const safe = map.buildNumber.replace(/[^a-z0-9]+/gi, '-') || new Date().toISOString().slice(0, 10);
      ReportModule.downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `OrangeHRM-Build-Report-${safe}.pdf`);
      ReportModule.toast('Build report generated successfully');
    });
  },
};
