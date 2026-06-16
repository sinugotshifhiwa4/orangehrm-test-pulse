/* ══════════════════════════════════════════
   Management PDF report builder (jsPDF + html2canvas)
   ══════════════════════════════════════════ */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { RgbColor, Run } from '../../app/types';
import { State } from '../../app/state';
import { REPORT_PALETTE } from '../../app/config';
import { Utils } from '../../app/core/utils';
import { AnalyticsModule } from '../../app/core/analytics';
import { ChartModule } from '../trends/charts';
import { ExportImageModule } from './export-image';

interface ReportOptions {
  focusLabel?: string;
  reportType?: string;
  footerNote?: string;
}

export const ReportModule = {
  palette: REPORT_PALETTE,

  /** Overall-tab scope overrides: date window + sprint label layered on the dashboard filters. */
  overrides: { from: '', to: '', sprint: '' } as { from: string; to: string; sprint: string },

  /** Runs used by the Overall reports — dashboard-filtered, optionally narrowed by date window. */
  scopedRuns(): Run[] {
    const { from, to } = this.overrides;
    if (!from && !to) return State.filteredRuns;
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const toMs = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;
    return State.filteredRuns.filter(r => r._dateMs >= fromMs && r._dateMs <= toMs);
  },

  sprintLabel(): string {
    return this.overrides.sprint ? `Sprint: ${this.overrides.sprint}` : '';
  },

  renderScopeNote(): void {
    const el = document.getElementById('report-scope-note');
    if (!el) return;
    const runs = this.scopedRuns();
    const { from, to, sprint } = this.overrides;
    const parts = [`${runs.length} run${runs.length === 1 ? '' : 's'} in scope`];
    parts.push((from || to)
      ? `Date: ${from ? Utils.formatDateOnly(from) : '…'} → ${to ? Utils.formatDateOnly(to) : '…'}`
      : 'Date: dashboard range');
    if (sprint) parts.push(`Sprint: ${sprint}`);
    el.textContent = parts.join('  ·  ');
  },

  getPdf(): jsPDF {
    return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  },

  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  savePdf(pdf: jsPDF, filename: string): void {
    const blob = pdf.output('blob');
    this.downloadBlob(blob, filename);
  },

  /** Brief green success toast, bottom-right, auto-dismissing. */
  toast(message: string): void {
    const el = document.createElement('div');
    el.className = 'app-toast app-toast-success';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  },

  async runWithButton(buttonId: string, task: () => Promise<void>): Promise<void> {
    const button = document.getElementById(buttonId) as HTMLButtonElement | null;
    const original = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Generating...';
    }
    try {
      await task();
    } catch (e) {
      console.error('Report generation failed', e);
      alert('Could not generate the report. Please try again.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  },

  currentTimestamp(): string {
    return new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  },

  latestRun(runs: Run[] = State.filteredRuns): Run | null {
    return [...runs].sort((a, b) => b._dateMs - a._dateMs)[0] || null;
  },

  scopeMeta(runs: Run[] = State.filteredRuns): { chips: string[]; dateSpan: string } {
    const sorted = [...runs].sort((a, b) => a._dateMs - b._dateMs);
    const from = sorted[0]?.date || null;
    const to = sorted[sorted.length - 1]?.date || null;
    const chips = [
      State.dateRangeDays > 0 ? `Range: last ${State.dateRangeDays}d` : 'Range: all history',
      `Runs: ${runs.length}`,
      State.filters.branch ? `Branch: ${State.filters.branch}` : 'Branch: all',
      State.filters.env ? `Env: ${State.filters.env}` : 'Env: all',
      State.filters.testTags.length ? `Tags: ${State.filters.testTags.join(', ')}` : 'Tags: all',
      State.filters.project ? `Project: ${State.filters.project}` : 'Project: all',
      State.filters.status ? `Status: ${State.filters.status}` : `Threshold: ${State.passThreshold}%`,
    ];
    const dateSpan = from && to
      ? `${Utils.formatDateOnly(from)} to ${Utils.formatDateOnly(to)}`
      : 'No date span available';
    return { chips, dateSpan };
  },

  renderScopeSummary(): void {
    const el = document.getElementById('report-scope-summary');
    if (!el) return;
    const meta = this.scopeMeta();
    el.innerHTML = meta.chips.map(chip => `<span class="report-scope-chip">${Utils.escape(chip)}</span>`).join('');
  },

  setFill(pdf: jsPDF, color: RgbColor): void {
    pdf.setFillColor(...color);
  },

  setText(pdf: jsPDF, color: RgbColor): void {
    pdf.setTextColor(...color);
  },

  async captureNode(node: HTMLElement): Promise<HTMLCanvasElement> {
    return html2canvas(node, {
      backgroundColor: '#0e0f13',
      scale: window.devicePixelRatio > 1 ? 2 : 1,
      useCORS: true,
      logging: false,
      onclone: clonedDoc => {
        clonedDoc.querySelectorAll('.btn-export-image').forEach(btn => btn.remove());
      },
    });
  },

  async captureClone(node: HTMLElement, width: number | null = null): Promise<HTMLCanvasElement> {
    const rect = node.getBoundingClientRect();
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-99999px';
    host.style.top = '0';
    host.style.padding = '16px';
    host.style.background = '#0e0f13';
    host.style.zIndex = '-1';

    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';
    clone.style.width = `${Math.ceil(width || rect.width || 820)}px`;
    clone.querySelectorAll('.btn-export-image').forEach(btn => btn.remove());
    ExportImageModule.replaceCanvases(node, clone);
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      return await this.captureNode(clone);
    } finally {
      document.body.removeChild(host);
    }
  },

  addImagePage(pdf: jsPDF, title: string, subtitle: string, canvas: HTMLCanvasElement): void {
    const sourceCanvas = this.trimCanvas(canvas);
    pdf.addPage();
    this.paintPageBackground(pdf);
    this.setText(pdf, this.palette.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(title, 16, 20);
    if (subtitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      this.setText(pdf, this.palette.muted);
      pdf.text(subtitle, 16, 27);
    }

    const pageWidth = 182;
    const ratio = sourceCanvas.height / sourceCanvas.width;
    const imgHeight = pageWidth * ratio;
    const maxHeight = 250;
    const drawHeight = Math.min(imgHeight, maxHeight);
    const imgData = sourceCanvas.toDataURL('image/png');
    pdf.setDrawColor(...this.palette.border);
    pdf.setFillColor(...this.palette.panel);
    pdf.roundedRect(14, 34, 182, Math.min(drawHeight + 12, 246), 4, 4, 'FD');
    pdf.addImage(imgData, 'PNG', 14, 40, pageWidth, drawHeight, undefined, 'FAST');
  },

  addCanvasPageById(pdf: jsPDF, canvasId: string, title: string, subtitle: string): boolean {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return false;
    this.addImagePage(pdf, title, subtitle, canvas);
    return true;
  },

  addCanvasPanel(pdf: jsPDF, canvasId: string, title: string, subtitle: string, y: number, panelHeight = 108): boolean {
    const source = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!source || !source.width || !source.height) return false;
    const canvas = this.trimCanvas(source);
    const x = 14;
    const w = 138;
    const innerX = x + 4;
    const innerW = w - 8;
    const titleY = y + 10;
    const subtitleY = y + 17;
    const imageY = y + 24;
    const imageH = panelHeight - 32;
    const ratio = canvas.height / canvas.width;
    const naturalH = innerW * ratio;
    const drawH = Math.min(imageH, naturalH);
    const drawW = drawH / ratio;
    const drawX = innerX + ((innerW - drawW) / 2);

    pdf.setDrawColor(...this.palette.border);
    pdf.setFillColor(...this.palette.panel);
    pdf.roundedRect(x, y, w, panelHeight, 4, 4, 'FD');
    this.setText(pdf, this.palette.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(title, x + 4, titleY);
    if (subtitle) {
      this.setText(pdf, this.palette.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(subtitle, x + 4, subtitleY);
    }

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', drawX, imageY, drawW, drawH, undefined, 'FAST');
    return true;
  },

  trimCanvas(sourceCanvas: HTMLCanvasElement, padding = 8): HTMLCanvasElement {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !width || !height) return sourceCanvas;

    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[((y * width) + x) * 4 + 3];
        if (alpha > 8) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1 || maxY === -1) return sourceCanvas;

    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, (maxX - minX) + (padding * 2));
    const cropH = Math.min(height - cropY, (maxY - minY) + (padding * 2));

    const trimmed = document.createElement('canvas');
    trimmed.width = cropW;
    trimmed.height = cropH;
    trimmed.getContext('2d')?.drawImage(
      sourceCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH,
    );
    return trimmed;
  },

  async withVisiblePage<T>(pageId: string, task: () => T | Promise<T>): Promise<T> {
    const page = document.getElementById(pageId);
    if (!page) return task();
    const wasActive = page.classList.contains('active');
    const previous = {
      position: page.style.position,
      left: page.style.left,
      top: page.style.top,
      width: page.style.width,
      zIndex: page.style.zIndex,
      visibility: page.style.visibility,
      pointerEvents: page.style.pointerEvents,
      display: page.style.display,
    };

    if (!wasActive) {
      page.classList.add('active');
      page.style.position = 'fixed';
      page.style.left = '-99999px';
      page.style.top = '0';
      page.style.width = '1280px';
      page.style.zIndex = '-1';
      page.style.visibility = 'visible';
      page.style.opacity = '0';
      page.style.pointerEvents = 'none';
      page.style.display = 'block';
    }

    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return await task();
    } finally {
      if (!wasActive) {
        page.classList.remove('active');
        page.style.position = previous.position;
        page.style.left = previous.left;
        page.style.top = previous.top;
        page.style.width = previous.width;
        page.style.zIndex = previous.zIndex;
        page.style.visibility = previous.visibility;
        page.style.opacity = '';
        page.style.pointerEvents = previous.pointerEvents;
        page.style.display = previous.display;
      }
    }
  },

  async ensureTrendChartsReady(runs: Run[]): Promise<void> {
    await this.withVisiblePage('page-trends', async () => {
      ChartModule.renderAll(runs);
      await new Promise(resolve => setTimeout(resolve, 120));
      ['chart-passrate-full', 'chart-failures-full', 'chart-flaky-full', 'chart-duration'].forEach(id => {
        const chart = State.charts[id];
        if (!chart) return;
        chart.resize();
        chart.update('none');
      });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
  },

  paintPageBackground(pdf: jsPDF): void {
    pdf.setFillColor(...this.palette.bg);
    pdf.rect(0, 0, 210, 297, 'F');
    pdf.setFillColor(...this.palette.panelSoft);
    pdf.rect(0, 0, 210, 16, 'F');
    pdf.setFillColor(...this.palette.blue);
    pdf.rect(160, 0, 50, 297, 'F');
    const anyPdf = pdf as unknown as { setGState?: (g: unknown) => void; GState: new (o: unknown) => unknown };
    anyPdf.setGState?.(new anyPdf.GState({ opacity: 0.08 }));
    pdf.setFillColor(...this.palette.navy);
    pdf.circle(182, 50, 36, 'F');
    pdf.circle(202, 120, 26, 'F');
    anyPdf.setGState?.(new anyPdf.GState({ opacity: 1 }));
    pdf.setFillColor(...this.palette.bg);
    pdf.roundedRect(12, 18, 144, 266, 8, 8, 'F');
  },

  addCover(pdf: jsPDF, title: string, body: string, decision: string, options: ReportOptions = {}): void {
    const focusLabel = options.focusLabel || 'REPORT FOCUS';
    const reportType = options.reportType || 'Management Report';
    const footerNote = options.footerNote || 'Prepared for management review';
    this.paintPageBackground(pdf);
    this.setFill(pdf, this.palette.blue);
    pdf.roundedRect(16, 24, 62, 8, 4, 4, 'F');
    this.setText(pdf, this.palette.panel);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('ORANGE HRM TEST PULSE', 20, 29);
    this.setText(pdf, this.palette.text);
    pdf.setFontSize(28);
    pdf.text(title, 16, 56);
    this.setText(pdf, this.palette.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(body, 118);
    pdf.text(lines, 16, 72);

    this.setFill(pdf, this.palette.panel);
    pdf.setDrawColor(...this.palette.border);
    pdf.roundedRect(16, 110, 128, 42, 6, 6, 'FD');
    this.setText(pdf, this.palette.blue);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(focusLabel, 22, 123);
    this.setText(pdf, this.palette.text);
    pdf.setFontSize(16);
    pdf.text(decision, 22, 137);

    this.setFill(pdf, this.palette.panel);
    pdf.setDrawColor(...this.palette.border);
    pdf.roundedRect(16, 166, 58, 24, 5, 5, 'FD');
    pdf.roundedRect(80, 166, 64, 24, 5, 5, 'FD');
    this.setText(pdf, this.palette.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('REPORT TYPE', 22, 175);
    pdf.text('GENERATED', 86, 175);
    this.setText(pdf, this.palette.text);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(reportType, 22, 185);
    pdf.text(this.currentTimestamp(), 86, 185);

    this.setText(pdf, this.palette.panel);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Release', 164, 44);
    pdf.text('Approval', 164, 54);
    pdf.text('Report', 164, 64);
    this.setText(pdf, this.palette.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(footerNote, 16, 210);
  },

  decisionMeta(run: Run | null): { text: string; color: RgbColor; short: string } {
    if (!run) return { text: 'No latest run available for approval review.', color: this.palette.muted, short: 'NO DATA' };
    if (run.status === 'PASS' && (run.flaky || 0) === 0) return { text: 'Recommendation: GO for release approval.', color: this.palette.green, short: 'GO' };
    if (run.status === 'PASS') return { text: 'Recommendation: GO with caution. Review flaky signals before approval.', color: this.palette.yellow, short: 'CAUTION' };
    return { text: 'Recommendation: NO GO until latest failures are resolved.', color: this.palette.red, short: 'NO GO' };
  },

  addSectionHeading(pdf: jsPDF, title: string, y: number): void {
    this.setText(pdf, this.palette.blue);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(title, 14, y);
  },

  addMetricCard(pdf: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string | number, color: RgbColor = REPORT_PALETTE.text): void {
    this.setFill(pdf, this.palette.panel);
    pdf.setDrawColor(...this.palette.border);
    pdf.roundedRect(x, y, w, h, 4, 4, 'FD');
    this.setText(pdf, this.palette.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(label.toUpperCase(), x + 4, y + 7);
    this.setText(pdf, color);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(String(value), x + 4, y + 18);
  },

  addBodyPage(pdf: jsPDF, heading: string): void {
    pdf.addPage();
    this.paintPageBackground(pdf);
    this.addSectionHeading(pdf, heading, 20);
  },

  addInsightBlock(pdf: jsPDF, x: number, y: number, w: number, h: number, title: string, value: string, body: string, tone: RgbColor = REPORT_PALETTE.text): void {
    this.setFill(pdf, this.palette.panel);
    pdf.setDrawColor(...this.palette.border);
    pdf.roundedRect(x, y, w, h, 4, 4, 'FD');
    this.setText(pdf, this.palette.blue);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(String(title).toUpperCase(), x + 4, y + 7);
    this.setText(pdf, tone);
    pdf.setFontSize(14);
    pdf.text(String(value), x + 4, y + 17);
    this.addWrappedText(pdf, body, x + 4, y + 25, w - 8, this.palette.muted, 9);
  },

  addWrappedText(pdf: jsPDF, text: string, x: number, y: number, width: number, color: RgbColor = REPORT_PALETTE.muted, size = 10): number {
    this.setText(pdf, color);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, width);
    pdf.text(lines, x, y);
    return y + (lines.length * (size * 0.45 + 2));
  },

  approvalDecision(run: Run | null): string {
    return this.decisionMeta(run).text;
  },

  async downloadOverall(): Promise<void> {
    await this.runWithButton('report-overall-btn', async () => {
      const pdf = this.getPdf();
      const runs = this.scopedRuns();
      const latest = this.latestRun(runs);
      const summary = AnalyticsModule.summarize(runs);
      const scope = this.scopeMeta(runs);
      const sprint = this.sprintLabel();
      await this.ensureTrendChartsReady(runs);
      this.addCover(
        pdf,
        'Overall Automation Report',
        `This report is designed for management and HOD review. It summarizes overall automation execution health, recent trends, risk concentration, and the latest run summary across the selected reporting scope. Date span: ${scope.dateSpan}.${sprint ? ` ${sprint}.` : ''}`,
        'Automation Health Summary',
        {
          focusLabel: 'REPORT FOCUS',
          reportType: 'Automation Summary',
          footerNote: 'Prepared for automation performance and trend review',
        },
      );

      this.addBodyPage(pdf, 'Executive Summary');
      const statusTone = summary.decisionTone === 'good'
        ? this.palette.green
        : summary.decisionTone === 'warn'
          ? this.palette.yellow
          : this.palette.red;
      this.setFill(pdf, this.palette.panel);
      pdf.setDrawColor(...this.palette.border);
      pdf.roundedRect(14, 28, 182, 30, 5, 5, 'FD');
      this.setText(pdf, this.palette.blue);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('AUTOMATION HEALTH', 20, 38);
      this.setText(pdf, statusTone);
      pdf.setFontSize(22);
      pdf.text(summary.releaseStatus, 20, 52);
      this.setText(pdf, this.palette.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Report scope: ${runs.length} runs in the selected report scope.`, 110, 38);
      pdf.text(`Date span: ${scope.dateSpan}`, 110, 54);
      pdf.text(`Latest run: #${latest?.runNumber ?? '-'} | ${latest?.testType || 'Unknown tag'} | ${latest?.env || 'Unknown env'}`, 110, 46);

      this.addMetricCard(pdf, 14, 68, 42, 26, 'Release Score', summary.releaseScore, statusTone);
      this.addMetricCard(pdf, 60, 68, 42, 26, 'Avg Pass Rate', Utils.pct(summary.avgPass), this.palette.green);
      this.addMetricCard(pdf, 106, 68, 42, 26, 'Failing Runs', summary.failingRuns, summary.failingRuns > 0 ? this.palette.red : this.palette.text);
      this.addMetricCard(pdf, 152, 68, 44, 26, 'Flaky Count', summary.totalFlaky, summary.totalFlaky > 0 ? this.palette.yellow : this.palette.text);
      this.addMetricCard(pdf, 14, 98, 42, 26, 'Total Runs', runs.length, this.palette.text);
      this.addMetricCard(pdf, 60, 98, 42, 26, 'Avg Failures', summary.avgFailures.toFixed(1), summary.avgFailures > 0 ? this.palette.red : this.palette.text);
      this.addMetricCard(pdf, 106, 98, 42, 26, 'Critical Fails', summary.criticalFailingRuns, summary.criticalFailingRuns > 0 ? this.palette.red : this.palette.text);
      this.addMetricCard(pdf, 152, 98, 44, 26, 'Latest Status', latest?.status || 'N/A', latest?.status === 'PASS' ? this.palette.green : this.palette.red);

      this.addInsightBlock(
        pdf, 14, 138, 56, 42,
        'Trend Movement',
        summary.passDelta == null ? 'Baseline' : `${Utils.deltaLabel(summary.passDelta)} pass`,
        summary.failureDelta == null
          ? 'Historical comparison is still forming for this reporting window.'
          : `Average failures per run moved ${Utils.deltaLabel(summary.failureDelta, '')} compared with the previous window.`,
        (summary.passDelta ?? 0) >= 0 ? this.palette.green : this.palette.red,
      );
      this.addInsightBlock(
        pdf, 77, 138, 56, 42,
        'Failure Driver',
        summary.topCategory?.label || 'No active driver',
        summary.topCategory
          ? `${summary.topCategory.count} logged failures mapped to this category in the current view.`
          : 'No failure category pattern stands out in the selected runs.',
        this.palette.yellow,
      );
      this.addInsightBlock(
        pdf, 140, 138, 56, 42,
        'Hot Module',
        summary.topModule?.label || 'No repeated hotspot',
        summary.topModule
          ? `${Math.round(summary.moduleShare)}% of repeated module-linked failures come from this module.`
          : 'No single module is repeating enough to stand out.',
        this.palette.red,
      );

      this.addBodyPage(pdf, 'Latest Run Summary');
      this.setFill(pdf, this.palette.panel);
      pdf.setDrawColor(...this.palette.border);
      pdf.roundedRect(14, 28, 182, 32, 5, 5, 'FD');
      this.setText(pdf, this.palette.blue);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(`LATEST ${Utils.titleCase(latest?.testType || 'Selected')} RUN`, 20, 39);
      this.setText(pdf, latest?.status === 'PASS' ? this.palette.green : this.palette.red);
      pdf.setFontSize(18);
      pdf.text(latest?.status === 'PASS' ? 'Latest Run Stable' : 'Latest Run Needs Attention', 20, 52);
      this.setText(pdf, this.palette.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Run #${latest?.runNumber ?? '-'} | ${latest?.branch || 'Unknown branch'} | ${latest?.env || 'Unknown env'}`, 110, 40);
      pdf.text(`${latest?.formattedDate || 'Unknown date'} | ${latest?.testType || 'Unknown tag'}`, 110, 48);

      this.addMetricCard(pdf, 14, 70, 42, 26, 'Pass Rate', Utils.pct(latest?.passRate || 0), this.palette.green);
      this.addMetricCard(pdf, 60, 70, 42, 26, 'Failures', latest?.failed || 0, (latest?.failed || 0) > 0 ? this.palette.red : this.palette.text);
      this.addMetricCard(pdf, 106, 70, 42, 26, 'Flaky', latest?.flaky || 0, (latest?.flaky || 0) > 0 ? this.palette.yellow : this.palette.text);
      this.addMetricCard(pdf, 152, 70, 44, 26, 'Duration', Utils.formatDuration(latest?.durationMin || 0), this.palette.text);

      let overallY = 114;
      overallY = this.addWrappedText(
        pdf,
        latest?.status === 'PASS' && (latest?.flaky || 0) === 0
          ? 'The latest selected run passed cleanly with no flaky exposure and reflects stable execution behavior.'
          : latest?.status === 'PASS'
            ? 'The latest selected run passed, but flaky exposure remains part of the current stability picture.'
            : 'The latest selected run failed and should be highlighted as part of the current automation risk picture.',
        18, overallY, 174, this.palette.text, 10,
      );
      overallY = this.addWrappedText(
        pdf,
        summary.criticalFailingRuns > 0
          ? `${summary.criticalFailingRuns} critical-tag runs failed in the current view, which raises automation risk in this reporting period.`
          : 'No critical-tag failures were observed in the selected reporting scope.',
        18, overallY + 5, 174,
      );
      overallY = this.addWrappedText(
        pdf,
        summary.topCategory
          ? `${summary.topCategory.label} is the leading failure category, while ${summary.topModule?.label || 'the current module set'} remains the main hotspot.`
          : 'No strong failure concentration was detected across the selected runs.',
        18, overallY + 5, 174,
      );

      this.addBodyPage(pdf, 'Trend Appendix');
      this.addWrappedText(pdf, 'Recent automation trends across the selected reporting scope.', 18, 34, 120, this.palette.muted, 10);
      this.addCanvasPanel(pdf, 'chart-passrate-full', 'Release Health Trend', 'Pass-rate direction across recent runs.', 48, 108);
      this.addCanvasPanel(pdf, 'chart-failures-full', 'Run Outcome Composition', 'Share of pass, fail, flaky, and skipped outcomes.', 164, 108);

      this.addBodyPage(pdf, 'Trend Appendix');
      this.addWrappedText(pdf, 'Execution stability and duration trends.', 18, 34, 120, this.palette.muted, 10);
      this.addCanvasPanel(pdf, 'chart-flaky-full', 'Risk Signals Trend', 'Recent instability signals, including flaky and failed behavior.', 48, 108);
      this.addCanvasPanel(pdf, 'chart-duration', 'Execution Duration Trend', 'Average run duration across the current reporting window.', 164, 108);

      this.savePdf(pdf, `overall-release-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      if (runs !== State.filteredRuns) ChartModule.renderAll(State.filteredRuns);
    });
  },

  async downloadLastRun(): Promise<void> {
    await this.runWithButton('report-last-run-btn', async () => {
      const runs = this.scopedRuns();
      const latest = this.latestRun(runs);
      if (!latest) throw new Error('No latest run available');
      await this.ensureTrendChartsReady(runs);
      const pdf = this.getPdf();
      const decision = this.decisionMeta(latest);
      const scope = this.scopeMeta(runs);
      const sprint = this.sprintLabel();

      this.addCover(
        pdf,
        'Last Run Approval Report',
        `This report focuses on the latest selected run and is intended to support an explicit management go / no-go approval decision. Reporting date span: ${scope.dateSpan}.${sprint ? ` ${sprint}.` : ''}`,
        decision.text,
        {
          focusLabel: 'RELEASE DECISION',
          reportType: 'Approval Pack',
          footerNote: 'Prepared for management go / no-go review',
        },
      );

      pdf.addPage();
      this.paintPageBackground(pdf);
      this.addSectionHeading(pdf, 'Approval Summary', 18);
      this.setFill(pdf, this.palette.panelSoft);
      pdf.roundedRect(14, 24, 182, 22, 4, 4, 'F');
      this.setText(pdf, decision.color);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text(decision.short, 20, 38);
      this.setText(pdf, this.palette.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Run #${latest.runNumber} | ${latest.branch || 'Unknown branch'} | ${latest.env || 'Unknown env'} | ${latest.testType || 'Unknown tag'}`, 55, 38);
      pdf.text(`Date span: ${scope.dateSpan}`, 55, 46);

      const statusColor = latest.status === 'PASS' ? this.palette.green : this.palette.red;
      this.addMetricCard(pdf, 14, 56, 42, 26, 'Status', latest.status || 'N/A', statusColor);
      this.addMetricCard(pdf, 60, 56, 42, 26, 'Pass Rate', Utils.pct(latest.passRate), this.palette.green);
      this.addMetricCard(pdf, 106, 56, 42, 26, 'Failures', latest.failed, latest.failed > 0 ? this.palette.red : this.palette.text);
      this.addMetricCard(pdf, 152, 56, 44, 26, 'Flaky', latest.flaky || 0, (latest.flaky || 0) > 0 ? this.palette.yellow : this.palette.text);
      this.addMetricCard(pdf, 14, 86, 42, 26, 'Passed', latest.passed, this.palette.text);
      this.addMetricCard(pdf, 60, 86, 42, 26, 'Skipped', latest.skipped, this.palette.muted);
      this.addMetricCard(pdf, 106, 86, 42, 26, 'Duration', Utils.formatDuration(latest.durationMin), this.palette.text);
      this.addMetricCard(pdf, 152, 86, 44, 26, 'Run ID', `#${latest.runNumber}`, this.palette.blue);

      this.addSectionHeading(pdf, 'Decision Notes', 128);
      let noteY = 138;
      noteY = this.addWrappedText(pdf, latest.status === 'PASS'
        ? 'The latest run met the current dashboard pass threshold.'
        : 'The latest run did not meet the current dashboard pass threshold.', 18, noteY, 174);
      noteY = this.addWrappedText(pdf, latest.failed > 0
        ? `${latest.failed} failing tests need resolution or explicit management acceptance before approval.`
        : 'No failing tests were logged in the latest run.', 18, noteY + 2, 174);
      noteY = this.addWrappedText(pdf, (latest.flaky || 0) > 0
        ? `${latest.flaky} flaky tests were detected and should be reviewed as a release-confidence risk.`
        : 'No flaky tests were detected in the latest run.', 18, noteY + 2, 174);

      if (latest.failedTests?.length) {
        this.addSectionHeading(pdf, 'Top Attached Failures', noteY + 12);
        let fy = noteY + 22;
        latest.failedTests.slice(0, 4).forEach((test, idx) => {
          this.setFill(pdf, this.palette.panel);
          pdf.roundedRect(14, fy - 5, 182, 18, 3, 3, 'F');
          this.setText(pdf, this.palette.red);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.text(`${idx + 1}. ${String(test.name || 'Unnamed failure').slice(0, 86)}`, 18, fy + 2);
          this.setText(pdf, this.palette.muted);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.text(String(test.classname || 'No file path').slice(0, 96), 18, fy + 9);
          fy += 22;
        });
      }

      pdf.addPage();
      this.paintPageBackground(pdf);
      this.addSectionHeading(pdf, 'Run Context', 18);
      this.setFill(pdf, this.palette.panelSoft);
      pdf.roundedRect(14, 26, 182, 30, 4, 4, 'F');
      this.setText(pdf, this.palette.text);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(`Latest ${Utils.titleCase(latest.testType || 'Selected')} Run`, 20, 40);
      this.setText(pdf, this.palette.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Branch: ${latest.branch || 'Unknown branch'}`, 20, 48);
      pdf.text(`Environment: ${latest.env || 'Unknown environment'}`, 95, 48);
      pdf.text(`Executed: ${latest.formattedDate || 'Unknown date'}`, 20, 54);

      this.addSectionHeading(pdf, 'Approval Guidance', 72);
      let guidanceY = 82;
      guidanceY = this.addWrappedText(
        pdf,
        latest.status === 'PASS' && (latest.flaky || 0) === 0
          ? 'This run is the strongest candidate for release sign-off because it passed cleanly with no flaky exposure.'
          : latest.status === 'PASS'
            ? 'This run passed, but instability signals were detected. Approval should depend on whether the flaky coverage is understood and accepted.'
            : 'This run failed. Release approval should be blocked until the open failures are resolved or explicitly accepted.',
        18, guidanceY, 174, this.palette.text,
      );

      guidanceY = this.addWrappedText(
        pdf,
        latest.reportUrl ? `Execution report: ${latest.reportUrl}` : 'Execution report link was not attached to this run.',
        18, guidanceY + 6, 174,
      );
      guidanceY = this.addWrappedText(
        pdf,
        latest.ortoniUrl ? `Ortoni report: ${latest.ortoniUrl}` : 'Ortoni link was not attached to this run.',
        18, guidanceY + 4, 174,
      );

      this.addSectionHeading(pdf, 'Failure Summary', guidanceY + 14);
      let failureY = guidanceY + 24;
      const failures = (latest.failedTests || []).slice(0, 6);
      if (failures.length) {
        failures.forEach((test, idx) => {
          this.setFill(pdf, this.palette.panel);
          pdf.roundedRect(14, failureY - 5, 182, 20, 3, 3, 'F');
          this.setText(pdf, this.palette.red);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.text(`${idx + 1}. ${String(test.name || 'Unnamed failure').slice(0, 84)}`, 18, failureY + 1);
          this.setText(pdf, this.palette.muted);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.text(String(test.classname || 'No file path').slice(0, 96), 18, failureY + 8);
          if (test.failureMessage) {
            pdf.text(String(test.failureMessage).split('\n')[0].slice(0, 110), 18, failureY + 14);
          }
          failureY += 24;
        });
      } else {
        this.addWrappedText(pdf, 'No attached per-test failures were included with the latest run.', 18, failureY, 174);
      }

      this.addBodyPage(pdf, 'Trend Appendix');
      this.addWrappedText(
        pdf,
        'Recent run-level trends for pass health and outcome composition across the selected reporting scope.',
        18, 34, 120, this.palette.muted, 10,
      );
      try {
        this.addCanvasPanel(pdf, 'chart-passrate-full', 'Pass Rate Trend', 'Recent pass performance in the selected filter window.', 48, 108);
        this.addCanvasPanel(pdf, 'chart-failures-full', 'Outcome Composition', 'How recent runs were split across pass, fail, flaky, and skipped outcomes.', 164, 108);
      } catch (e) {
        console.warn('Skipping last run trend appendix', e);
      }

      this.savePdf(pdf, `last-run-approval-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      if (runs !== State.filteredRuns) ChartModule.renderAll(State.filteredRuns);
    });
  },
};
