/* ══════════════════════════════════════════
   Release-health analytics engine
   ══════════════════════════════════════════ */
import type { FailedTest, FailureClass, FailureGroup, LabelCount, Run, RunSummary } from '../types';
import { Utils } from './utils';

export const AnalyticsModule = {
  criticalTags: new Set(['smoke', 'sanity', 'critical', 'authenticate']),

  splitRuns(runs: Run[]): { current: Run[]; previous: Run[] } {
    const ordered = [...runs].sort((a, b) => b._dateMs - a._dateMs);
    const midpoint = Math.max(1, Math.floor(ordered.length / 2));
    return {
      current: ordered.slice(0, midpoint),
      previous: ordered.slice(midpoint),
    };
  },

  /** Two-axis failure classification: WHERE it broke (area) and WHY (type). */
  classifyFailure(test: FailedTest = {}): FailureClass {
    return { area: this.failureArea(test), type: this.failureType(test) };
  },

  /** Failure TYPE — the "why" — derived from the error message only. Returns null
      when the feed carries no message, since the path/title can't tell us how it broke. */
  failureType(test: FailedTest = {}): string | null {
    // Directory paths (.../login/..., .../ui/...) are misleading for failure type,
    // so type signals are matched against the message text, never the path.
    const msg = String(test.failureMessage || '').toLowerCase();
    if (!msg.trim()) return null;
    // HTTP 5xx (500 and up) is a server/infrastructure fault — e.g. a 502/503/504
    // gateway error. Word boundaries keep "500" from matching inside "5000".
    if (/\b5\d{2}\b/.test(msg)) return 'Server Error';
    // Browser launch / runtime / environment faults: bad CLI args, closed browser,
    // missing executable, OOM on /dev/shm.
    if (/browsertype\.launch|browser has been closed|target (?:page|context|browser).*(?:closed|crashed)|unknown option|cannot parse arguments|executable doesn'?t exist|playwright install|pw_run|ms-playwright|dev\/shm/.test(msg)) return 'Config';
    // Navigation / routing: the page never reached the expected URL (e.g. a login
    // that stayed on /auth/login), a failed goto, or a connection-level error.
    // Keyed on the URL assertion itself so a toBeVisible timeout stays a Timeout.
    if (/tohaveurl|to have url|page\.goto|net::err|err_connection|err_name_not_resolved|err_aborted/.test(msg)) return 'Navigation';
    // A locator/assertion that never resolved — the most common Playwright failure.
    // Covers explicit timeouts ("timed out", "timeout 100000ms", "waiting for ...")
    // and the bare auto-waiting assertions that exhaust their wait without saying so
    // (e.g. "expect(locator).toBeVisible() failed", "element(s) not found").
    if (/(timed out|timeout \d|exceeded.*timeout|waiting for|element\(s\) not found|expect\([^)]*\)\.\w+\([^)]*\) failed|\.(?:tobevisible|tohavetext|tohavecount|tobeenabled|tobechecked|tocontaintext)\b)/.test(msg)) return 'Timeout';
    // Any other expectation that resolved but mismatched (value/state assertion).
    if (/(expect|assert|to equal|tobe|received|expected)/.test(msg)) return 'Assertion';
    return 'Error';
  },

  /** Functional AREA — the "where" — derived from the test title + spec file name. */
  failureArea(test: FailedTest = {}): string {
    // Use only the spec file's basename, not its folder path, so a footer test that
    // happens to live under .../login/ isn't mislabelled "Auth".
    const file = String(test.classname || '').split(/[\\/]/).pop() || '';
    const title = `${test.name || ''} ${file}`.toLowerCase();
    if (/(login|logout|password|sign[ -]?in|sign[ -]?out|credential|session|token|otp|auth)/.test(title)) return 'Auth';
    if (/(api|request|response|endpoint|graphql|status code)/.test(title)) return 'API';
    if (/(footer|header|menu|sidebar|navbar|nav|breadcrumb|dashboard|page|modal|dialog|button|form|grid|table|column|link|icon|banner|tooltip|label|text|title|element|display|visible|render)/.test(title)) return 'UI';
    if (/(employee|record|leave|pim|admin|recruit|payroll|report|data|fixture|seed|import|export)/.test(title)) return 'Data';
    return 'Workflow';
  },

  /** Group failures by functional area, tallying the failure types within each. */
  groupFailures(runs: Run[]): FailureGroup[] {
    const groups: Record<string, { count: number; types: Record<string, number> }> = {};
    runs.forEach(run => {
      (run.failedTests || []).forEach(test => {
        const { area, type } = this.classifyFailure(test);
        const g = (groups[area] ||= { count: 0, types: {} });
        g.count += 1;
        if (type) g.types[type] = (g.types[type] || 0) + 1;
      });
    });
    return Object.entries(groups)
      .map(([area, g]) => {
        const types = Object.entries(g.types)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);
        return { area, count: g.count, topType: types[0]?.label || null, types };
      })
      .sort((a, b) => b.count - a.count);
  },

  moduleName(test: FailedTest = {}): string {
    const raw = test.classname || test.name || 'unknown';
    const normalized = String(raw).replace(/\\/g, '/').toLowerCase();
    const parts = normalized.split('/').filter(Boolean);
    const specLike = parts.find(part => part.includes('.spec'));
    const base = specLike
      ? specLike.replace(/\.[^.]+$/, '').replace(/\.spec$/i, '')
      : parts.reverse().find(part => !part.includes('.')) || parts[parts.length - 1] || 'unknown';
    return Utils.titleCase(base || 'unknown');
  },

  countFailuresBy(runs: Run[], mapper: (test: FailedTest, run: Run) => string): LabelCount[] {
    const map: Record<string, number> = {};
    runs.forEach(run => {
      (run.failedTests || []).forEach(test => {
        const key = mapper(test, run) || 'Unknown';
        map[key] = (map[key] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  },

  summarize(runs: Run[]): RunSummary {
    const ordered = [...runs].sort((a, b) => b._dateMs - a._dateMs);
    const latest = ordered[0] || null;
    const avgPass = Utils.avg(runs.map(r => r.passRate || 0));
    const avgFailures = Utils.avg(runs.map(r => r.failed || 0));
    const failingRuns = runs.filter(r => r.status === 'FAIL').length;
    const totalFailures = Utils.sum(runs.map(r => r.failed || 0));
    const totalFlaky = Utils.sum(runs.map(r => r.flaky || 0));
    const flakyRunCount = runs.filter(r => (r.flaky || 0) > 0).length;
    const flakyRunShare = Utils.ratio(flakyRunCount, runs.length);
    const criticalRuns = runs.filter(r => this.criticalTags.has(String(r.testType || '').toLowerCase()));
    const criticalFailingRuns = criticalRuns.filter(r => r.status === 'FAIL').length;
    const passPenalty = 100 - avgPass;
    const failPenalty = Utils.clamp(avgFailures * 7, 0, 28);
    const flakyPenalty = Utils.clamp(flakyRunShare * 0.35, 0, 16);
    const criticalPenalty = criticalFailingRuns > 0 ? 18 : 0;
    const releaseScore = Math.round(Utils.clamp(100 - passPenalty - failPenalty - flakyPenalty - criticalPenalty, 0, 100));
    const releaseStatus = releaseScore >= 90 && criticalFailingRuns === 0
      ? 'Ready to Release'
      : releaseScore >= 75 && criticalFailingRuns === 0
        ? 'Release With Caution'
        : 'Hold Release';
    const decisionTone: RunSummary['decisionTone'] = releaseStatus === 'Ready to Release' ? 'good' : releaseStatus === 'Release With Caution' ? 'warn' : 'bad';

    // Run-health model for the analytics Overview card: a test-weighted pass rate
    // docked lightly for the share of runs that failed and the share that were flaky.
    // Unlike releaseScore (a release gate), this has no hard critical-tag override —
    // it simply reflects how healthy the *currently selected* runs were.
    const weightedPassRate = Utils.ratio(Utils.sum(runs.map(r => r.passed || 0)), Utils.sum(runs.map(r => r.total || 0)));
    const failedRunShare = Utils.ratio(failingRuns, runs.length);
    const runHealth = Math.round(Utils.clamp(weightedPassRate - failedRunShare * 0.1 - flakyRunShare * 0.1, 0, 100));
    const windows = this.splitRuns(runs);
    const currentAvgPass = Utils.avg(windows.current.map(r => r.passRate || 0));
    const previousAvgPass = Utils.avg(windows.previous.map(r => r.passRate || 0));
    const currentAvgFailures = Utils.avg(windows.current.map(r => r.failed || 0));
    const previousAvgFailures = Utils.avg(windows.previous.map(r => r.failed || 0));
    const currentFlakyShare = Utils.ratio(windows.current.filter(r => (r.flaky || 0) > 0).length, windows.current.length);
    const previousFlakyShare = Utils.ratio(windows.previous.filter(r => (r.flaky || 0) > 0).length, windows.previous.length);
    const failureGroups = this.groupFailures(runs);
    // Keep categoryCounts (area + count) for the existing "Failure Driver" consumers.
    const categoryCounts = failureGroups.map(g => ({ label: g.area, count: g.count }));
    const moduleCounts = this.countFailuresBy(runs, test => this.moduleName(test));
    const topCategory = categoryCounts[0] || null;
    const topModule = moduleCounts[0] || null;

    return {
      latest,
      avgPass,
      avgFailures,
      failingRuns,
      totalFailures,
      totalFlaky,
      flakyRunCount,
      flakyRunShare,
      criticalRuns,
      criticalFailingRuns,
      releaseScore,
      releaseStatus,
      decisionTone,
      weightedPassRate,
      failedRunShare,
      runHealth,
      passDelta: Utils.delta(currentAvgPass, previousAvgPass),
      failureDelta: Utils.delta(currentAvgFailures, previousAvgFailures),
      flakyDelta: Utils.delta(currentFlakyShare, previousFlakyShare),
      categoryCounts,
      failureGroups,
      moduleCounts,
      topCategory,
      topModule,
      categoryShare: topCategory ? Utils.ratio(topCategory.count, Math.max(1, categoryCounts.reduce((sum, item) => sum + item.count, 0))) : 0,
      moduleShare: topModule ? Utils.ratio(topModule.count, Math.max(1, moduleCounts.reduce((sum, item) => sum + item.count, 0))) : 0,
    };
  },
};
