/* ══════════════════════════════════════════
   App-wide constants
   ══════════════════════════════════════════ */
import type { RgbColor } from './types';

/** Public R2 bucket holding the rolling test-results history. */
export const DATA_URL =
  'https://pub-1a2929fbcaf44458951bbb84b49b5f3f.r2.dev/orangehrm-automation/test-results-history.json';

/** Shared Chart.js look-and-feel. */
export const CHART_DEFAULTS = {
  plugins: {
    legend: {
      position: 'bottom' as const,
      align: 'start' as const,
      labels: {
        color: '#7c82a0',
        font: { family: 'DM Mono, monospace', size: 10 },
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: 'rectRounded' as const,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: '#1a1d26',
      borderColor: '#ffffff17',
      borderWidth: 1,
      titleColor: '#f0f1f5',
      bodyColor: '#7c82a0',
      titleFont: { family: 'DM Sans, sans-serif', size: 11 },
      bodyFont: { family: 'DM Mono, monospace', size: 10 },
      padding: 8,
      cornerRadius: 5,
    },
  },
  layout: {
    padding: { top: 6, right: 6, bottom: 2, left: 2 },
  },
  scales: {
    x: { ticks: { color: '#44495e', font: { family: 'DM Mono, monospace', size: 9 }, maxRotation: 40, maxTicksLimit: 10 }, grid: { color: '#ffffff08' } },
    y: { ticks: { color: '#44495e', font: { family: 'DM Mono, monospace', size: 9 } }, grid: { color: '#ffffff08' } },
  },
};

export const CHART_COLORS = {
  pass: '#22d17b',
  passFill: '#22d17b24',
  fail: '#f25f5c',
  failFill: '#f25f5c3d',
  flaky: '#f5c542',
  flakyFill: '#f5c54233',
  skipped: '#c1c7d6',
  skippedFill: '#c1c7d633',
  duration: '#4f8ef7',
  durationFill: '#4f8ef71f',
};

/** Palette used by the PDF report builder (jsPDF wants RGB tuples). */
export const REPORT_PALETTE: Record<string, RgbColor> = {
  bg: [235, 240, 246],
  panel: [248, 250, 252],
  panelSoft: [220, 228, 240],
  text: [27, 36, 58],
  muted: [95, 107, 128],
  blue: [73, 104, 149],
  green: [34, 209, 123],
  yellow: [212, 168, 74],
  red: [242, 95, 92],
  border: [195, 206, 223],
  navy: [42, 56, 84],
};
