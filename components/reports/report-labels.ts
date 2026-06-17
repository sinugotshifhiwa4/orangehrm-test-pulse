/* ══════════════════════════════════════════
   Shared qualitative labels for all PDF reports (Build / Sprint / Overall).

   Centralising these means the same score band always produces the same word
   across every report — no more "Off Track" vs "Degraded" vs "At Risk" for the
   same underlying number. Risk levels are intentionally left to each report,
   since they derive from status/critical signals rather than a single score.
   ══════════════════════════════════════════ */

export type Grade = 'Excellent' | 'Good' | 'Unstable';
export type Readiness = 'Ready' | 'Conditional' | 'Not Ready';

export const ReportLabels = {
  /** Graded 0–100 score → Excellent / Good / Unstable. Used for status,
      quality, and overall health across all reports. */
  grade(score: number): Grade {
    return score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Unstable';
  },

  /** Instability signals → Stable / Unstable. */
  stability(failingRuns: number, flaky: number): 'Stable' | 'Unstable' {
    return failingRuns > 0 || flaky > 0 ? 'Unstable' : 'Stable';
  },

  /** Ship-readiness verdict from a 0–100 readiness score. */
  readiness(score: number): Readiness {
    return score >= 90 ? 'Ready' : score >= 75 ? 'Conditional' : 'Not Ready';
  },

  /** One-line action note matching a readiness verdict. */
  readinessNote(verdict: Readiness): string {
    return verdict === 'Ready' ? 'Ready to ship.' : verdict === 'Conditional' ? 'Proceed with caution.' : 'Hold for fixes.';
  },

  /** "Grade · score/100" — the Overall Health summary line. */
  healthLine(score: number): string {
    return `${this.grade(score)} · ${score}/100`;
  },
};
