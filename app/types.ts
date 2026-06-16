/* ══════════════════════════════════════════
   Shared domain types
   ══════════════════════════════════════════ */
import type { Chart } from 'chart.js';

/** A single failing test case attached to a run. */
export interface FailedTest {
  name?: string;
  classname?: string;
  failureMessage?: string;
}

/** A run exactly as it arrives from S3 / the mock generator (loosely typed). */
export interface RawRun {
  runNumber?: number;
  buildNumber?: number;
  date?: string;
  branch?: string;
  testType?: string;
  env?: string;
  project?: string;
  passed?: number;
  failed?: number;
  skipped?: number;
  flaky?: number;
  total?: number;
  passRate?: number | null;
  durationMin?: number | string | null;
  durationMs?: number | null;
  duration?: number | string | null;
  durationSec?: number | null;
  reportUrl?: string | null;
  ortoniUrl?: string | null;
  failedTests?: FailedTest[];
}

/** The raw payload shape: branch → testType → { runs }. */
export interface RawData {
  byBranch?: Record<string, { byTestType?: Record<string, { runs?: RawRun[] } | RawRun[]> } | Record<string, { runs?: RawRun[] } | RawRun[]>>;
}

export type RunStatus = 'PASS' | 'FAIL';

/** A normalized run used everywhere in the UI. */
export interface Run {
  runNumber?: number;
  buildNumber?: number;
  date?: string;
  branch: string;
  testType: string;
  env?: string;
  project: string;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  total: number;
  passRate: number | null;
  durationMin: number | null;
  reportUrl?: string | null;
  ortoniUrl?: string | null;
  failedTests: FailedTest[];
  formattedDate: string;
  _dateMs: number;
  status?: RunStatus;
  /** Allows dynamic key access used by table sorting / groupBy. */
  [key: string]: unknown;
}

export type StatusFilter = '' | RunStatus;

export interface Filters {
  branch: string;
  env: string;
  /** Multi-select tag filter (matched against testType). */
  testTags: string[];
  project: string;
  status: StatusFilter;
}

export interface SortState {
  col: string;
  dir: 'asc' | 'desc';
}

export interface AppState {
  allRuns: Run[];
  filteredRuns: Run[];
  visualSection: string;
  filters: Filters;
  dateRangeDays: number;
  passThreshold: number;
  sort: SortState;
  tableSearch: string;
  charts: Record<string, Chart>;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  countdown: number;
  compareIds: Set<number>;
  expandedRuns: Set<number>;
}

/** Failure rollups produced by the analytics engine. */
export interface LabelCount {
  label: string;
  count: number;
}

export interface RunSummary {
  latest: Run | null;
  avgPass: number;
  avgFailures: number;
  failingRuns: number;
  totalFailures: number;
  totalFlaky: number;
  /** Number of selected runs that contained at least one flaky test. */
  flakyRunCount: number;
  /** Share of selected runs that contained at least one flaky test, as a percentage. */
  flakyRunShare: number;
  criticalRuns: Run[];
  criticalFailingRuns: number;
  releaseScore: number;
  releaseStatus: string;
  decisionTone: 'good' | 'warn' | 'bad';
  /** Test-weighted pass rate (sum passed / sum total). */
  weightedPassRate: number;
  /** Share of selected runs that failed, as a percentage. */
  failedRunShare: number;
  /** Run-health score for the analytics Overview card (0–100). */
  runHealth: number;
  passDelta: number | null;
  failureDelta: number | null;
  flakyDelta: number | null;
  categoryCounts: LabelCount[];
  moduleCounts: LabelCount[];
  topCategory: LabelCount | null;
  topModule: LabelCount | null;
  categoryShare: number;
  moduleShare: number;
}

export type RgbColor = [number, number, number];
