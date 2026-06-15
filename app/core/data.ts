/* ══════════════════════════════════════════
   Data fetching + normalization
   ══════════════════════════════════════════ */
import type { RawData, RawRun, Run } from '../types';
import { DATA_URL } from '../config';
import { MOCK_DATA } from './mock-data';
import { Utils } from './utils';

export const DataModule = {
  URL: DATA_URL,
  usingMock: false,
  lastError: '' as string,

  async fetch(): Promise<RawData> {
    try {
      const res = await window.fetch(DataModule.URL, { cache: 'no-store', mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      DataModule.usingMock = false;
      return await res.json();
    } catch (e) {
      DataModule.usingMock = true;
      DataModule.lastError = (e as Error).message;
      return MOCK_DATA;
    }
  },

  normalize(raw: RawData): Run[] {
    const runs: Run[] = [];
    for (const [branch, bd] of Object.entries(raw.byBranch || {})) {
      const branchData = bd as { byTestType?: Record<string, { runs?: RawRun[] } | RawRun[]> } & Record<string, { runs?: RawRun[] } | RawRun[]>;
      const byTestType = branchData.byTestType || branchData;
      for (const [testType, td] of Object.entries(byTestType)) {
        const rawRuns: RawRun[] = Array.isArray(td) ? td : (td.runs || []);
        for (const run of rawRuns) {
          const passRate = run.passRate != null ? Number(run.passRate) : null;
          let durationMin: number | null = null;
          const rawD = run.durationMin ?? run.durationMs ?? run.duration ?? run.durationSec ?? null;
          if (rawD != null) {
            if (typeof rawD === 'number') {
              durationMin = run.durationMs != null && run.durationMin == null ? rawD / 60000 : rawD;
            } else {
              const s = String(rawD).trim();
              const mm = s.match(/(\d+(?:\.\d+)?)\s*m/);
              const sm = s.match(/(\d+(?:\.\d+)?)\s*s/);
              durationMin = (mm ? parseFloat(mm[1]) : 0) + (sm ? parseFloat(sm[1]) / 60 : 0) || parseFloat(s) || null;
            }
          }
          runs.push({
            ...run,
            branch: run.branch || branch,
            testType: run.testType || testType,
            passRate, durationMin,
            failed: Number(run.failed ?? 0),
            passed: Number(run.passed ?? 0),
            skipped: Number(run.skipped ?? 0),
            flaky: Number(run.flaky ?? 0),
            total: Number(run.total ?? 0),
            project: run.project || 'unknown',
            failedTests: Array.isArray(run.failedTests) ? run.failedTests : [],
            formattedDate: Utils.formatDate(run.date),
            _dateMs: run.date ? new Date(run.date).getTime() : 0,
          });
        }
      }
    }
    return runs.sort((a, b) => b._dateMs - a._dateMs);
  },
};
