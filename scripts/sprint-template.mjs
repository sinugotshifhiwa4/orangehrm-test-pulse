/* ──────────────────────────────────────────────────────────────────────────
   Generates the clean OrangeHRM Sprint Report PDF template.

   A sprint-level evolution of the Build Report template (scripts/build-template.mjs).
   Same branding, layout, typography, colours, chart slots and footer treatment —
   build-specific wording swapped for sprint wording, with a new "Sprint Summary &
   Delivery Overview" page (three narrative tables) inserted after the health page.

   Built with the SAME single-encoding discipline as the build template: one
   standard font (Helvetica), all text as literal WinAnsi strings, every
   placeholder a unique, whole `{{token}}`, so the runtime fill
   (components/reports/sprint-report.ts) stays a trivial string replacement.

   Run with:  node scripts/sprint-template.mjs
   Output:    data/template/OrangeHRM-Sprint-Report.pdf
   ────────────────────────────────────────────────────────────────────────── */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/template/OrangeHRM-Sprint-Report.pdf');

// A4 portrait, points.
const W = 595.28;
const H = 841.89;
const MX = 40;             // page margin
const FULL_W = W - 2 * MX;

const C = {
  navy: rgb(0.078, 0.192, 0.373),
  blue: rgb(0.184, 0.435, 0.929),
  ink: rgb(0.106, 0.141, 0.227),
  muted: rgb(0.373, 0.420, 0.502),
  panel: rgb(0.957, 0.969, 0.984),
  border: rgb(0.765, 0.808, 0.875),
  white: rgb(1, 1, 1),
  green: rgb(0.133, 0.820, 0.482),
  red: rgb(0.949, 0.373, 0.361),
  yellow: rgb(0.961, 0.773, 0.259),
  grey: rgb(0.604, 0.643, 0.722),
};

const doc = await PDFDocument.create();
const reg = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

/** Draw text with a top-left origin (y measured down from the page top). */
function text(page, str, x, yTop, { size = 11, font = reg, color = C.ink } = {}) {
  page.drawText(str, { x, y: H - yTop - size, size, font, color });
}
function rectFill(page, x, yTop, w, h, color) {
  page.drawRectangle({ x, y: H - yTop - h, width: w, height: h, color });
}
function panel(page, x, yTop, w, h, { fill = C.panel, border = C.border } = {}) {
  page.drawRectangle({ x, y: H - yTop - h, width: w, height: h, color: fill, borderColor: border, borderWidth: 1 });
}
function dot(page, x, yTop, color) {
  page.drawRectangle({ x, y: H - yTop - 9, width: 9, height: 9, color, borderColor: color, borderWidth: 1 });
}
function pageHeader(page, title, subtitle) {
  // Light, integrated heading sitting just above the content — matches the build report.
  text(page, title, MX, 52, { size: 16, font: bold, color: C.navy });
  text(page, subtitle, MX, 75, { size: 10, color: C.muted });
  page.drawRectangle({ x: MX, y: H - 96, width: 44, height: 2.5, color: C.blue });
}
function footer(page, n) {
  text(page, 'OrangeHRM Test Pulse Sprint Report  {{sprintTag}}', MX, H - 38, { size: 8, color: C.muted });
  text(page, 'Confidential — Internal Use Only', W / 2 - 70, H - 38, { size: 8, color: C.muted });
  text(page, `Page ${n}`, W - MX - 36, H - 38, { size: 8, color: C.muted });
}
function caption(page, slot, label) {
  text(page, label, slot.x, slot.yTop - 16, { size: 9, font: bold, color: C.muted });
}

/** A header row + fixed number of token rows. Returns the y just below the table. */
function drawTable(page, title, yTop, colX, labels, rows) {
  text(page, title, MX, yTop, { size: 11, font: bold, color: C.navy });
  const headY = yTop + 18;
  const headH = 22;
  const rowH = 22;
  rectFill(page, MX, headY, FULL_W, headH, C.navy);
  labels.forEach((h, i) => text(page, h, colX[i] + 10, headY + 7, { size: 8.5, font: bold, color: C.white }));
  rows.forEach((cells, ri) => {
    const y = headY + headH + ri * rowH;
    if (ri % 2 === 0) rectFill(page, MX, y, FULL_W, rowH, C.panel);
    page.drawRectangle({ x: MX, y: H - y - rowH, width: FULL_W, height: rowH, borderColor: C.border, borderWidth: 0.5 });
    cells.forEach((cell, ci) => text(page, cell, colX[ci] + 10, y + rowH / 2 - 4, { size: 8.5, font: ci === 0 ? bold : reg, color: ci === 0 ? C.ink : C.muted }));
  });
  return headY + headH + rows.length * rowH;
}

/* ── Shared chart slots (keep in step with components/reports/sprint-report.ts) ── */
const DOUGHNUT_SLOT = { x: MX, yTop: 336, w: 240, h: 196 };
const GAUGE_SLOT = { x: MX, yTop: 566, w: 240, h: 160 };
const TREND_SLOTS = [
  { x: MX, yTop: 178, w: FULL_W, h: 126 },
  { x: MX, yTop: 328, w: FULL_W, h: 126 },
  { x: MX, yTop: 478, w: FULL_W, h: 126 },
  { x: MX, yTop: 628, w: FULL_W, h: 126 },
];

/* ── Page 1 — Cover ── */
{
  const p = doc.addPage([W, H]);
  const ell = (cx, cy, rx, ry, color, opacity = 1) =>
    p.drawEllipse({ x: cx, y: H - cy, xScale: rx, yScale: ry, color, opacity });

  ell(300, -130, 640, 380, rgb(0.20, 0.46, 0.86), 1);
  ell(140, -150, 430, 330, rgb(0.42, 0.62, 0.95), 0.50);
  ell(W - 30, -120, 300, 320, rgb(0.10, 0.31, 0.76), 0.55);
  ell(W + 40, 58, 86, 86, rgb(0.30, 0.55, 0.96), 0.9);
  ell(W + 70, 815, 170, 120, rgb(0.42, 0.62, 0.95), 0.18);

  const kicker = 'ORANGE HRM TEST PULSE';
  const kSize = 11;
  const kWidth = bold.widthOfTextAtSize(kicker, kSize);
  rectFill(p, MX, 70, kWidth + 28, 26, C.white);
  text(p, kicker, MX + 14, 78, { size: kSize, font: bold, color: C.navy });

  // Title + description (white on blue). "Sprint-Based Report" is longer than
  // "Build Report" — size 40 keeps it comfortably inside the margin.
  text(p, 'Sprint-Based Report', MX, 118, { size: 40, font: bold, color: C.white });
  const tag = rgb(0.9, 0.94, 1);
  text(p, 'Sprint test execution results, quality trends, sprint readiness,', MX, 184, { size: 11.5, color: tag });
  text(p, 'and test suite summary indicators.', MX, 202, { size: 11.5, color: tag });

  // Report details grid (on white, below the curve).
  text(p, 'REPORT DETAILS', MX, 322, { size: 9, font: bold, color: C.muted });
  rectFill(p, MX, 342, FULL_W, 1, C.border);
  const colX = [MX, MX + FULL_W / 2];
  [
    ['SPRINT START DATE', '{{sprintStartDate}}'],
    ['SPRINT END DATE', '{{sprintEndDate}}'],
    ['PREPARED BY', '{{preparedBy}}'],
    ['AUDIENCE', '{{audience}}'],
  ].forEach(([label, value], i) => {
    const x = colX[i % 2];
    const y = 364 + Math.floor(i / 2) * 66;
    text(p, label, x, y, { size: 8.5, font: bold, color: C.muted });
    text(p, value, x, y + 18, { size: 16, font: bold, color: C.ink });
  });
  rectFill(p, MX, 510, FULL_W, 1, C.border);
  text(p, 'Generated   {{generated}}', MX, 526, { size: 10, color: C.muted });

  footer(p, 1);
}

/* ── Page 2 — Sprint Health Overview ── */
{
  const p = doc.addPage([W, H]);
  // Title carries the sprint number via a single computed token ({{healthTitle}}),
  // so an empty sprint number doesn't leave a double space.
  pageHeader(p, '{{healthTitle}}', 'A quick overview of sprint quality, stability, delivery progress, and key test metrics.');

  // Five metric cards — aggregated across the sprint date range.
  const cards = [
    ['Total Tests', '{{totalTests}}'],
    ['Pass Rate', '{{passRate}}'],
    ['Failed Tests', '{{failedTests}}'],
    ['Flaky Tests', '{{flakyTests}}'],
    ['Skipped Tests', '{{skippedTests}}'],
  ];
  const gap = 10;
  const cw = (FULL_W - gap * (cards.length - 1)) / cards.length;
  cards.forEach(([label, value], i) => {
    const x = MX + i * (cw + gap);
    panel(p, x, 146, cw, 82);
    text(p, label.toUpperCase(), x + 8, 158, { size: 7, font: bold, color: C.muted });
    text(p, value, x + 8, 182, { size: 20, font: bold, color: C.navy });
  });

  // Left: Sprint Health bullets. Right: Sprint Readiness summary.
  const pw = (FULL_W - gap) / 2;
  const panelY = 256;
  const panelH = 178;

  panel(p, MX, panelY, pw, panelH);
  text(p, 'Sprint Health', MX + 16, panelY + 16, { size: 13, font: bold, color: C.navy });
  [
    'Sprint status:   {{sprintStatus}}',
    'Sprint quality:   {{sprintQuality}}',
    'Sprint stability:   {{sprintStability}}',
  ].forEach((r, i) => text(p, `•   ${r}`, MX + 16, panelY + 50 + i * 34, { size: 11, color: C.ink }));

  const rrx = MX + pw + gap;
  panel(p, rrx, panelY, pw, panelH);
  text(p, 'Sprint Readiness', rrx + 16, panelY + 16, { size: 13, font: bold, color: C.navy });
  text(p, '{{sprintReadiness}}', rrx + 16, panelY + 50, { size: 22, font: bold, color: C.navy });
  text(p, 'Sprint readiness score   {{sprintReadinessScore}} / 100', rrx + 16, panelY + 92, { size: 11, color: C.muted });
  text(p, '{{readinessSummary}}', rrx + 16, panelY + 118, { size: 11, color: C.muted });

  footer(p, 2);
}

/* ── Page 3 — Sprint Summary & Delivery Overview (new) ── */
{
  const p = doc.addPage([W, H]);
  pageHeader(p, 'Sprint Summary & Delivery Overview', 'Completed deliverables, work in progress and blockers, and sprint goals.');

  // Table 1 — Completed Work (3 cols, 5 rows).
  const t1cols = [MX, MX + 175, MX + 410];
  const t1rows = Array.from({ length: 5 }, (_, i) => [`{{t1_item_${i + 1}}}`, `{{t1_out_${i + 1}}}`, `{{t1_ref_${i + 1}}}`]);
  let y = drawTable(p, 'Completed Work', 112, t1cols, ['Completed Item', 'Outcome / Value Delivered', 'Reference'], t1rows);

  // Table 2 — Work In Progress & Blockers (4 cols, 4 rows).
  const t2cols = [MX, MX + 130, MX + 220, MX + 315];
  const t2rows = Array.from({ length: 4 }, (_, i) => [`{{t2_ws_${i + 1}}}`, `{{t2_status_${i + 1}}}`, `{{t2_owner_${i + 1}}}`, `{{t2_next_${i + 1}}}`]);
  y = drawTable(p, 'Work In Progress & Blockers', y + 22, t2cols, ['Workstream', 'Current Status', 'Owner', 'Next Action / Blocker'], t2rows);

  // Table 3 — Sprint Goals & Achievements (2 cols, 6 rows).
  const t3cols = [MX, MX + 130];
  const t3rows = Array.from({ length: 6 }, (_, i) => [`{{t3_area_${i + 1}}}`, `{{t3_detail_${i + 1}}}`]);
  drawTable(p, 'Sprint Goals & Achievements', y + 22, t3cols, ['Area', 'Details'], t3rows);

  footer(p, 3);
}

/* ── Page 4 — Quality & Sprint Overview (charts) ── */
{
  const p = doc.addPage([W, H]);
  pageHeader(p, 'Quality & Sprint Overview', 'Trend insights, outcome composition, and overall sprint quality across all executions within the sprint.');

  // Trend table.
  const cols = [MX, MX + 180, MX + 180 + 245];
  const headY = 116;
  const headH = 26;
  const rowH = 38;
  rectFill(p, MX, headY, FULL_W, headH, C.navy);
  ['Trend Area', 'Metric / Insight', 'Reference'].forEach((h, i) => text(p, h, cols[i] + 12, headY + 8, { size: 9.5, font: bold, color: C.white }));
  [
    ['Pass Rate Trend', '{{passRateInsight}}', 'Dashboard'],
    ['Sprint Execution Success Trend', '{{successInsight}}', 'Dashboard'],
    ['Execution Duration Trend', '{{durationInsight}}', 'Dashboard'],
    ['Test Growth Trend', '{{testGrowthInsight}}', 'Dashboard'],
  ].forEach((r, ri) => {
    const y = headY + headH + ri * rowH;
    if (ri % 2 === 0) rectFill(p, MX, y, FULL_W, rowH, C.panel);
    p.drawRectangle({ x: MX, y: H - y - rowH, width: FULL_W, height: rowH, borderColor: C.border, borderWidth: 0.5 });
    r.forEach((cell, ci) => text(p, cell, cols[ci] + 12, y + rowH / 2 - 5, { size: ci === 0 ? 10.5 : 9.5, font: ci === 0 ? bold : reg, color: ci === 0 ? C.ink : C.muted }));
  });

  // Outcome Composition: doughnut (left) + % breakdown (right).
  text(p, 'Outcome Composition', MX, 312, { size: 11, font: bold, color: C.navy });
  const sx = MX + DOUGHNUT_SLOT.w + 24;
  const sw = W - MX - sx;
  panel(p, sx, DOUGHNUT_SLOT.yTop, sw, DOUGHNUT_SLOT.h);
  text(p, 'OUTCOME BREAKDOWN', sx + 16, DOUGHNUT_SLOT.yTop + 16, { size: 8, font: bold, color: C.muted });
  [
    ['Passed', '{{outPassed}}', '{{outPassedPct}}', C.green],
    ['Failed', '{{outFailed}}', '{{outFailedPct}}', C.red],
    ['Flaky', '{{outFlaky}}', '{{outFlakyPct}}', C.yellow],
    ['Skipped', '{{outSkipped}}', '{{outSkippedPct}}', C.grey],
  ].forEach(([label, n, pct, col], i) => {
    const y = DOUGHNUT_SLOT.yTop + 50 + i * 36;
    dot(p, sx + 16, y + 2, col);
    text(p, label, sx + 34, y, { size: 11, font: bold, color: C.ink });
    text(p, n, sx + 140, y, { size: 11, color: C.muted });
    text(p, pct, sx + sw - 52, y, { size: 11, font: bold, color: C.navy });
  });

  // Run Success Rate: small 180° gauge (left) + Overall Health (right).
  text(p, 'Sprint Execution Success', MX, 548, { size: 11, font: bold, color: C.navy });
  const rx = MX + GAUGE_SLOT.w + 24;
  const rw = W - MX - rx;
  const ry = GAUGE_SLOT.yTop;
  panel(p, rx, ry, rw, 196);
  text(p, 'OVERALL HEALTH', rx + 16, ry + 16, { size: 8, font: bold, color: C.muted });
  text(p, '{{overallHealth}}', rx + 16, ry + 40, { size: 16, font: bold, color: C.navy });
  text(p, '{{healthNote}}', rx + 16, ry + 66, { size: 9, color: C.muted });
  [
    ['Failing runs', '{{failingRuns}}'],
    ['Flaky exposure', '{{flakyExposure}}'],
    ['Test suite score', '{{testSuiteScore}} / 100'],
    ['Risk level', '{{suiteRiskLevel}}'],
  ].forEach(([label, val], i) => {
    const y = ry + 94 + i * 26;
    text(p, label, rx + 16, y, { size: 10, color: C.ink });
    text(p, val, rx + rw - 78, y, { size: 10, font: bold, color: C.navy });
  });

  footer(p, 4);
}

/* ── Page 5 — Sprint Execution Trends (charts) ── */
{
  const p = doc.addPage([W, H]);
  pageHeader(p, 'Sprint Execution Trends', 'Pass rate, failures, flaky signals, and execution duration across all sprint executions.');
  ['Pass Rate Trend', 'Failures', 'Flaky Signals', 'Execution Duration'].forEach((c, i) => caption(p, TREND_SLOTS[i], c));
  footer(p, 5);
}

const bytes = await doc.save();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, bytes);
console.log(`Wrote ${OUT} (${bytes.length} bytes, ${doc.getPageCount()} pages)`);
