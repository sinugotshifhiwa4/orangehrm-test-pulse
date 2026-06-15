/* ══════════════════════════════════════════
   Shared application state (single source of truth)
   ══════════════════════════════════════════ */
import type { AppState } from './types';

export const State: AppState = {
  allRuns: [],
  filteredRuns: [],
  visualSection: 'quality',
  filters: {
    branch: '',
    env: '',
    testTags: [], // multi-select array (was testType)
    project: '',
    status: '',
  },
  dateRangeDays: 0,
  passThreshold: 100,
  sort: { col: 'formattedDate', dir: 'desc' },
  tableSearch: '',
  charts: {},
  refreshTimer: null,
  countdown: 60,
  compareIds: new Set<number>(),
  expandedRuns: new Set<number>(),
};
