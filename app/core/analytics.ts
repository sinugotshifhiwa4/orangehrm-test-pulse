/* ══════════════════════════════════════════
   Release-health analytics engine
   ══════════════════════════════════════════ */
import type { FailedTest, LabelCount, Run, RunSummary } from '../types';
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

  classifyFailure(test: FailedTest = {}): string {
    const haystack = `${test.name || ''} ${test.classname || ''} ${test.failureMessage || ''}`.toLowerCase();
    if (/(api|request|response|endpoint|graphql)/.test(haystack)) return 'API';
    if (/(auth|login|logout|password|session|credential|token)/.test(haystack)) return 'Auth';
    if (/(data|fixture|db|database|employee|record|seed|sync)/.test(haystack)) return 'Data';
    if (/(ui|locator|page|modal|button|form|dashboard|grid|table|click|visible)/.test(haystack)) return 'UI';
    return 'Workflow';
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
    const flakyRunShare = Utils.ratio(runs.filter(r => (r.flaky || 0) > 0).length, runs.length);
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
    const windows = this.splitRuns(runs);
    const currentAvgPass = Utils.avg(windows.current.map(r => r.passRate || 0));
    const previousAvgPass = Utils.avg(windows.previous.map(r => r.passRate || 0));
    const currentAvgFailures = Utils.avg(windows.current.map(r => r.failed || 0));
    const previousAvgFailures = Utils.avg(windows.previous.map(r => r.failed || 0));
    const currentFlakyShare = Utils.ratio(windows.current.filter(r => (r.flaky || 0) > 0).length, windows.current.length);
    const previousFlakyShare = Utils.ratio(windows.previous.filter(r => (r.flaky || 0) > 0).length, windows.previous.length);
    const categoryCounts = this.countFailuresBy(runs, test => this.classifyFailure(test));
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
      flakyRunShare,
      criticalRuns,
      criticalFailingRuns,
      releaseScore,
      releaseStatus,
      decisionTone,
      passDelta: Utils.delta(currentAvgPass, previousAvgPass),
      failureDelta: Utils.delta(currentAvgFailures, previousAvgFailures),
      flakyDelta: Utils.delta(currentFlakyShare, previousFlakyShare),
      categoryCounts,
      moduleCounts,
      topCategory,
      topModule,
      categoryShare: topCategory ? Utils.ratio(topCategory.count, Math.max(1, categoryCounts.reduce((sum, item) => sum + item.count, 0))) : 0,
      moduleShare: topModule ? Utils.ratio(topModule.count, Math.max(1, moduleCounts.reduce((sum, item) => sum + item.count, 0))) : 0,
    };
  },
};
