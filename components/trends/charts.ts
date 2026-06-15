/* ══════════════════════════════════════════
   Chart.js rendering for trends + visuals
   ══════════════════════════════════════════ */
import Chart, { type ChartConfiguration } from 'chart.js/auto';
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { CHART_COLORS, CHART_DEFAULTS } from '../../app/config';

type TooltipItemLike = { dataIndex: number; dataset: { label?: string }; formattedValue: string };

interface CenterTextLine { text: string; font: string; color: string; }
interface CenterTextOpts { lines: CenterTextLine[]; gauge?: boolean; }

/**
 * Draws stacked lines of text in the hole of a doughnut/gauge chart.
 * Reads its config from options.plugins.centerText.
 */
const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart: { config: { options?: { plugins?: { centerText?: CenterTextOpts } } }; ctx: CanvasRenderingContext2D; chartArea: { left: number; right: number; top: number; bottom: number } }) {
    const opt = chart.config.options?.plugins?.centerText;
    if (!opt || !opt.lines?.length) return;
    const { ctx, chartArea: { left, right, top, bottom } } = chart;
    const cx = (left + right) / 2;
    const cy = opt.gauge ? top + (bottom - top) * 0.72 : (top + bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const n = opt.lines.length;
    opt.lines.forEach((line, i) => {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, cx, cy + (i - (n - 1) / 2) * 17);
    });
    ctx.restore();
  },
};

export const ChartModule = {
  destroy(id: string): void { if (State.charts[id]) { State.charts[id].destroy(); delete State.charts[id]; } },

  create(id: string, cfg: ChartConfiguration): void {
    this.destroy(id);
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) return;
    State.charts[id] = new Chart(canvas, cfg);
  },

  labels(sorted: Run[], compact = false): string[] {
    return sorted.map((r, i) => {
      const num = `#${r.runNumber ?? i + 1}`;
      if (compact || !r.date) return num;
      return `${num} ${Utils.formatDateShort(r.date)}`;
    });
  },

  ttTitle(sorted: Run[]) {
    return (items: { dataIndex: number }[]): string => {
      const r = sorted[items[0].dataIndex];
      return r ? `Run #${r.runNumber} · ${r.formattedDate}` : '';
    };
  },

  passRate(runs: Run[], id = 'chart-passrate', opts: { limit?: number; compactLabels?: boolean } = {}): void {
    const s = [...runs].sort((a, b) => a._dateMs - b._dateMs).slice(-(opts.limit ?? 40));
    this.create(id, {
      type: 'line',
      data: {
        labels: this.labels(s, opts.compactLabels),
        datasets: [
          {
            label: 'Pass Rate %',
            data: s.map(r => r.passRate),
            borderColor: CHART_COLORS.pass,
            backgroundColor: CHART_COLORS.passFill,
            fill: true,
            tension: .4,
            pointBackgroundColor: s.map(r => r.status === 'FAIL' ? CHART_COLORS.fail : CHART_COLORS.pass),
            pointBorderColor: '#0e0f13',
            pointBorderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS, responsive: true,
        plugins: { ...CHART_DEFAULTS.plugins, tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: { title: this.ttTitle(s) } } },
        scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: (v: number | string) => v + '%' } } },
      },
    } as ChartConfiguration);
  },

  failures(runs: Run[], id = 'chart-failures'): void {
    const s = [...runs].sort((a, b) => a._dateMs - b._dateMs).slice(-40);
    const isTrendsView = id === 'chart-failures-full';
    if (isTrendsView) {
      this.create(id, {
        type: 'bar',
        data: {
          labels: this.labels(s, true),
          datasets: [
            { label: 'Passed', data: s.map(r => r.passed || 0), backgroundColor: CHART_COLORS.passFill, borderColor: CHART_COLORS.pass, borderWidth: 1, borderRadius: 3, borderSkipped: false, stack: 'outcomes' },
            { label: 'Failed', data: s.map(r => r.failed || 0), backgroundColor: CHART_COLORS.failFill, borderColor: CHART_COLORS.fail, borderWidth: 1, borderRadius: 3, borderSkipped: false, stack: 'outcomes' },
            { label: 'Flaky', data: s.map(r => r.flaky || 0), backgroundColor: CHART_COLORS.flakyFill, borderColor: CHART_COLORS.flaky, borderWidth: 1, borderRadius: 3, borderSkipped: false, stack: 'outcomes' },
            { label: 'Skipped', data: s.map(r => r.skipped || 0), backgroundColor: CHART_COLORS.skippedFill, borderColor: CHART_COLORS.skipped, borderWidth: 1, borderRadius: 3, borderSkipped: false, stack: 'outcomes' },
          ],
        },
        options: {
          ...CHART_DEFAULTS,
          responsive: true,
          plugins: {
            ...CHART_DEFAULTS.plugins,
            tooltip: {
              ...CHART_DEFAULTS.plugins.tooltip,
              callbacks: {
                title: this.ttTitle(s),
                label: (ctx: TooltipItemLike) => {
                  const run = s[ctx.dataIndex];
                  const countMap: Record<string, number> = {
                    Passed: run.passed || 0,
                    Failed: run.failed || 0,
                    Flaky: run.flaky || 0,
                    Skipped: run.skipped || 0,
                  };
                  const total = (run.passed || 0) + (run.failed || 0) + (run.flaky || 0) + (run.skipped || 0);
                  const count = countMap[ctx.dataset.label ?? ''] ?? 0;
                  const pct = total > 0 ? ` (${Math.round((count / total) * 100)}%)` : '';
                  return `${ctx.dataset.label}: ${count}${pct}`;
                },
                footer: (items: TooltipItemLike[]) => {
                  const run = s[items[0].dataIndex];
                  const total = (run.passed || 0) + (run.failed || 0) + (run.flaky || 0) + (run.skipped || 0);
                  return `Total: ${total} tests`;
                },
              },
            },
          },
          scales: {
            ...CHART_DEFAULTS.scales,
            x: { ...CHART_DEFAULTS.scales.x, stacked: true },
            y: { ...CHART_DEFAULTS.scales.y, stacked: true, beginAtZero: true, ticks: { ...CHART_DEFAULTS.scales.y.ticks, precision: 0 } },
          },
        },
      } as ChartConfiguration);
      return;
    }
    this.create(id, {
      type: 'bar',
      data: {
        labels: this.labels(s, true),
        datasets: [{
          label: 'Failures',
          data: s.map(r => r.failed),
          backgroundColor: s.map(r => r.failed > 0 ? CHART_COLORS.failFill : CHART_COLORS.passFill),
          borderColor: s.map(r => r.failed > 0 ? CHART_COLORS.fail : CHART_COLORS.pass),
          borderWidth: 1, borderRadius: 3,
        }],
      },
      options: {
        ...CHART_DEFAULTS, responsive: true,
        plugins: { ...CHART_DEFAULTS.plugins, tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: { title: this.ttTitle(s) } } },
        scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1, precision: 0 } } },
      },
    } as ChartConfiguration);
  },

  flaky(runs: Run[], id = 'chart-flaky'): void {
    const s = [...runs].sort((a, b) => a._dateMs - b._dateMs).slice(-40);
    const isTrendsView = id === 'chart-flaky-full';
    if (isTrendsView) {
      this.create(id, {
        type: 'line',
        data: {
          labels: this.labels(s, true),
          datasets: [
            { label: 'Failed', data: s.map(r => r.failed || 0), borderColor: CHART_COLORS.fail, backgroundColor: CHART_COLORS.failFill, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2, yAxisID: 'y' },
            { label: 'Flaky', data: s.map(r => r.flaky || 0), borderColor: CHART_COLORS.flaky, backgroundColor: CHART_COLORS.flakyFill, fill: false, tension: .4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2, yAxisID: 'y' },
            { label: 'Skipped', data: s.map(r => r.skipped || 0), borderColor: CHART_COLORS.skipped, backgroundColor: CHART_COLORS.skippedFill, fill: false, tension: .4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 1.5, yAxisID: 'y' },
          ],
        },
        options: {
          ...CHART_DEFAULTS,
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: { ...CHART_DEFAULTS.plugins, tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: { title: this.ttTitle(s) } } },
          scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true, ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1, precision: 0 } } },
        },
      } as ChartConfiguration);
      return;
    }
    this.create(id, {
      type: 'bar',
      data: {
        labels: this.labels(s, true),
        datasets: [{
          label: 'Flaky', data: s.map(r => r.flaky || 0),
          backgroundColor: CHART_COLORS.flakyFill, borderColor: CHART_COLORS.flaky, borderWidth: 1, borderRadius: 3,
        }],
      },
      options: {
        ...CHART_DEFAULTS, responsive: true,
        scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1, precision: 0 } } },
      },
    } as ChartConfiguration);
  },

  duration(runs: Run[], id = 'chart-duration'): void {
    const withDur = runs.filter(r => r.durationMin != null && r.durationMin > 0);
    const avg = Utils.avg(withDur.map(r => r.durationMin as number));
    const s = [...withDur].sort((a, b) => a._dateMs - b._dateMs).slice(-50);
    if (!s.length) return;
    this.create(id, {
      type: 'line',
      data: {
        labels: this.labels(s, true),
        datasets: [
          {
            label: 'Duration (min)', data: s.map(r => +(r.durationMin as number).toFixed(2)),
            borderColor: CHART_COLORS.duration, backgroundColor: CHART_COLORS.durationFill, fill: true, tension: .4,
            pointRadius: 0, pointHoverRadius: 5, borderWidth: 2,
          },
          {
            label: `Avg ${Utils.formatDuration(avg)}`, data: s.map(() => +avg.toFixed(2)),
            borderColor: '#4f8ef744', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, fill: false,
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS, responsive: true,
        scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: (v: number | string) => v + 'm' } } },
      },
    } as ChartConfiguration);
  },

  barAvgPass(runs: Run[], key: string, id: string): void {
    const g = Utils.groupBy(runs, key);
    const labels = Object.keys(g).sort();
    const data = labels.map(k => Utils.avg(g[k].map(r => r.passRate || 0)).toFixed(1));
    const colors = data.map(v => +v >= 90 ? '#22d17b33' : +v >= 70 ? '#f5c54233' : '#f25f5c33');
    const borders = data.map(v => +v >= 90 ? '#22d17b' : +v >= 70 ? '#f5c542' : '#f25f5c');
    this.create(id, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Avg Pass Rate %', data: data.map(Number), backgroundColor: colors, borderColor: borders, borderWidth: 1, borderRadius: 4 }] },
      options: { ...CHART_DEFAULTS, responsive: true, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: (v: number | string) => v + '%' } } } },
    } as ChartConfiguration);
  },

  barCount(runs: Run[], key: string, id: string): void {
    const g = Utils.groupBy(runs, key);
    const labels = Object.keys(g).sort();
    const data = labels.map(k => g[k].length);
    const pal = ['#4f8ef7', '#22d17b', '#a78bfa', '#f5c542', '#f97316'];
    this.create(id, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Run Count', data, backgroundColor: labels.map((_, i) => pal[i % pal.length] + '33'), borderColor: labels.map((_, i) => pal[i % pal.length]), borderWidth: 1, borderRadius: 4 }] },
      options: { ...CHART_DEFAULTS, responsive: true },
    } as ChartConfiguration);
  },

  /** Ortoni-style "Test Trend": Passed/Failed counts (left axis) + Avg Duration (right axis). */
  testTrend(runs: Run[], id = 'chart-test-trend'): void {
    const s = [...runs].sort((a, b) => a._dateMs - b._dateMs).slice(-40);
    this.create(id, {
      type: 'line',
      data: {
        labels: this.labels(s, true),
        datasets: [
          {
            label: 'Passed',
            data: s.map(r => r.passed || 0),
            borderColor: CHART_COLORS.pass,
            backgroundColor: CHART_COLORS.passFill,
            tension: .4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Failed',
            data: s.map(r => r.failed || 0),
            borderColor: CHART_COLORS.fail,
            backgroundColor: CHART_COLORS.failFill,
            tension: .4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Avg Duration',
            data: s.map(r => r.durationMin != null ? +(r.durationMin).toFixed(2) : null),
            borderColor: CHART_COLORS.duration,
            backgroundColor: 'transparent',
            borderDash: [5, 4],
            tension: .4,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 1.5,
            spanGaps: true,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS,
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              title: this.ttTitle(s),
              label: (ctx: { parsed: { y: number | null }; dataset: { label?: string; yAxisID?: string } }) => {
                const v = ctx.parsed.y;
                if (v == null) return '';
                return ctx.dataset.yAxisID === 'y1'
                  ? ` ${ctx.dataset.label}: ${Utils.formatDuration(v)}`
                  : ` ${ctx.dataset.label}: ${v}`;
              },
            },
          },
        },
        scales: {
          x: CHART_DEFAULTS.scales.x,
          y: {
            ...CHART_DEFAULTS.scales.y,
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'Tests', color: '#44495e', font: { family: 'DM Mono, monospace', size: 9 } },
            ticks: { ...CHART_DEFAULTS.scales.y.ticks, precision: 0 },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: '#44495e', font: { family: 'DM Mono, monospace', size: 9 }, callback: (v: number | string) => Utils.formatDuration(Number(v)) },
          },
        },
      },
    } as ChartConfiguration);
  },

  outcomeDoughnut(runs: Run[], id = 'chart-outcome'): void {
    const passed = Utils.sum(runs.map(r => r.passed || 0));
    const failed = Utils.sum(runs.map(r => r.failed || 0));
    const flaky = Utils.sum(runs.map(r => r.flaky || 0));
    const skipped = Utils.sum(runs.map(r => r.skipped || 0));
    const total = passed + failed + flaky + skipped;
    this.create(id, {
      type: 'doughnut',
      data: {
        labels: ['Passed', 'Failed', 'Flaky', 'Skipped'],
        datasets: [{
          data: [passed, failed, flaky, skipped],
          backgroundColor: [CHART_COLORS.pass, CHART_COLORS.fail, CHART_COLORS.flaky, CHART_COLORS.skipped],
          // Thin border, no spacing/rounding so tiny slices (e.g. 2 flaky / 459)
          // aren't swallowed by their own border and stay visible.
          borderColor: '#0e0f13',
          borderWidth: 1,
          borderRadius: 2,
          spacing: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        cutout: '68%',
        layout: CHART_DEFAULTS.layout,
        plugins: {
          legend: CHART_DEFAULTS.plugins.legend,
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx: { label?: string; parsed: number }) =>
                ` ${ctx.label}: ${ctx.parsed} (${total ? Math.round((ctx.parsed / total) * 100) : 0}%)`,
            },
          },
          centerText: {
            lines: [
              { text: String(total), font: '700 26px "DM Sans", sans-serif', color: '#f0f1f5' },
              { text: 'Test Cases', font: '500 11px "DM Mono", monospace', color: '#7c82a0' },
            ],
          },
        },
      },
      plugins: [centerTextPlugin],
    } as ChartConfiguration);
  },

  successGauge(runs: Run[], id = 'chart-gauge'): void {
    const val = Math.round(Utils.avg(runs.map(r => r.passRate || 0)));
    const color = val >= 90 ? CHART_COLORS.pass : val >= 70 ? CHART_COLORS.flaky : CHART_COLORS.fail;
    this.create(id, {
      type: 'doughnut',
      data: {
        labels: ['Success', 'Remaining'],
        datasets: [{
          data: [val, 100 - val],
          backgroundColor: [color, '#21263a'],
          borderColor: '#0e0f13',
          borderWidth: 2,
          borderRadius: 6,
          circumference: 180,
          rotation: 270,
          cutout: '74%',
        }],
      },
      options: {
        responsive: true,
        layout: CHART_DEFAULTS.layout,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          centerText: {
            gauge: true,
            lines: [
              { text: `${val}%`, font: '700 24px "DM Sans", sans-serif', color },
              { text: 'Avg Success Rate', font: '500 10px "DM Mono", monospace', color: '#7c82a0' },
            ],
          },
        },
      },
      plugins: [centerTextPlugin],
    } as unknown as ChartConfiguration);
  },

  renderAll(runs: Run[]): void {
    this.testTrend(runs, 'chart-test-trend');
    this.outcomeDoughnut(runs, 'chart-outcome');
    this.outcomeDoughnut(runs, 'chart-outcome-ov');
    this.successGauge(runs, 'chart-gauge');
    this.passRate(runs, 'chart-passrate-ov', { limit: 7, compactLabels: true });
    this.passRate(runs, 'chart-passrate', { compactLabels: true });
    this.failures(runs, 'chart-failures');
    this.flaky(runs, 'chart-flaky');
    this.passRate(runs, 'chart-passrate-full', { compactLabels: true });
    this.failures(runs, 'chart-failures-full');
    this.flaky(runs, 'chart-flaky-full');
    this.duration(runs, 'chart-duration');
    this.barAvgPass(runs, 'testType', 'chart-bar-type');
    this.barAvgPass(runs, 'branch', 'chart-bar-branch');
    this.barCount(runs, 'env', 'chart-bar-env');
    this.barAvgPass(runs, 'project', 'chart-bar-project');
  },
};
