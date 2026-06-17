/* ══════════════════════════════════════════
   Shared qualitative labels for all PDF reports (Build / Sprint / Overall).

   Centralising these means the same score band always produces the same word
   across every report — no more "Off Track" vs "Degraded" vs "At Risk" for the
   same underlying number. Risk levels are intentionally left to each report,
   since they derive from status/critical signals rather than a single score.
   ══════════════════════════════════════════ */

export type Grade = 'Excellent' | 'Good' | 'Unstable';
export type Readiness = 'Ready' | 'Conditional' | 'Not Ready';
export type Band = 'good' | 'warn' | 'bad';

/** The single source of truth for health/pass-rate band thresholds (0–100).
    Everything that colours or labels a rate — report grades, the Overview cards,
    KPI success, recent-run bars — routes through these so a tweak is one edit. */
export const HEALTH_BANDS = { good: 90, warn: 70 } as const;

export const ReportLabels = {
  /** A 0–100 rate/score → good / warn / bad tone band. */
  rateBand(value: number): Band {
    return value >= HEALTH_BANDS.good ? 'good' : value >= HEALTH_BANDS.warn ? 'warn' : 'bad';
  },

  /** Graded 0–100 score → Excellent / Good / Unstable. Used for status,
      quality, and overall health across all reports. Shares HEALTH_BANDS, so
      Excellent = good band, Good = warn band, Unstable = bad band. */
  grade(score: number): Grade {
    const band = this.rateBand(score);
    return band === 'good' ? 'Excellent' : band === 'warn' ? 'Good' : 'Unstable';
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
