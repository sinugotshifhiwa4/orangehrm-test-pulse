/* ══════════════════════════════════════════
   Generic formatting / math / search helpers
   ══════════════════════════════════════════ */
import type { Run } from '../types';

export const Utils = {
  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  },
  formatDateShort(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
  },
  formatDuration(min: number | null | undefined): string {
    if (min == null) return '—';
    if (min < 1) return `${Math.round(min * 60)}s`;
    const m = Math.floor(min), s = Math.round((min - m) * 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  },
  avg(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; },
  sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); },
  groupBy<T>(arr: T[], key: keyof T | string): Record<string, T[]> {
    return arr.reduce<Record<string, T[]>>((acc, item) => {
      const k = String((item as Record<string, unknown>)[key as string] ?? 'unknown') || 'unknown';
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  },
  unique<T>(arr: T[]): T[] { return [...new Set(arr)]; },
  pct(v: number | null | undefined): string { return v != null ? `${Math.round(v)}%` : '—'; },
  escape(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  delta(curr: number | null | undefined, prev: number | null | undefined): number | null {
    if (curr == null || prev == null) return null;
    return +(curr - prev).toFixed(1);
  },
  deltaLabel(delta: number | null | undefined, suffix = '%'): string {
    if (delta == null || Number.isNaN(delta)) return 'No prior baseline';
    const rounded = Math.abs(delta) >= 10 ? Math.round(delta) : delta.toFixed(1).replace(/\.0$/, '');
    return `${delta > 0 ? '+' : ''}${rounded}${suffix}`;
  },
  ratio(part: number, total: number): number {
    return total > 0 ? (part / total) * 100 : 0;
  },
  clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
  },
  titleCase(value: unknown): string {
    return String(value || 'Unknown')
      .replace(/[-_/]+/g, ' ')
      .replace(/\b\w/g, ch => ch.toUpperCase());
  },
  formatDateOnly(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-ZA', { dateStyle: 'medium' });
  },
  matchesSearch(run: Run, search: string): boolean {
    if (!search) return true;
    const haystacks = [
      run.branch,
      run.testType,
      run.env,
      run.project,
      run.runNumber,
      run.formattedDate,
      run.status,
      ...(run.failedTests || []).flatMap(t => [t.name, t.classname, t.failureMessage]),
    ];
    return haystacks.some(v => String(v || '').toLowerCase().includes(search));
  },
};
