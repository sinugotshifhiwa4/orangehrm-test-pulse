/* ══════════════════════════════════════════
   Filter pipeline — turns allRuns into filteredRuns
   ══════════════════════════════════════════ */
import type { RunStatus } from '../types';
import { State } from '../state';
import { Utils } from './utils';

export const FilterModule = {
  apply(): void {
    const { branch, env, testTags, userRole, status } = State.filters;
    const cutoff = State.dateRangeDays > 0 ? Date.now() - State.dateRangeDays * 86400000 : 0;
    const thr = State.passThreshold;
    const search = State.tableSearch.trim().toLowerCase();

    State.filteredRuns = State.allRuns
      .filter(r => {
        if (cutoff && r._dateMs < cutoff) return false;
        if (branch && r.branch !== branch) return false;
        if (env && r.env !== env) return false;
        if (testTags.length > 0 && !testTags.includes(r.testType)) return false;
        if (userRole && r.userRole !== userRole) return false;
        return true;
      })
      .map(r => ({
        ...r,
        status: ((r.passRate != null && r.passRate >= thr) || (r.failed === 0 && r.passed > 0) ? 'PASS' : 'FAIL') as RunStatus,
      }))
      .filter(r => {
        if (status && r.status !== status) return false;
        if (!Utils.matchesSearch(r, search)) return false;
        return true;
      });
  },

  syncDatePills(): void {
    document.querySelectorAll<HTMLElement>('.date-pill').forEach(p =>
      p.classList.toggle('active', Number(p.dataset.days) === State.dateRangeDays)
    );
  },
};
