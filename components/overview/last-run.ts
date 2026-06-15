/* ══════════════════════════════════════════
   Latest-run build summary panel + modal
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';

export const LastRunModule = {
  buildContent(target: Run | null): string {
    if (!target) return '';
    const summary = target.status === 'PASS' && (target.flaky || 0) === 0
      ? 'Build passed cleanly'
      : target.status === 'PASS'
        ? 'Build passed with flaky tests'
        : 'Build failed';
    const failedTests = (target.failedTests || []).slice(0, 6);
    const links = `
      <div class="links-cell">
        ${target.reportUrl ? `<a href="${Utils.escape(target.reportUrl)}" target="_blank" class="link-btn">Report</a>` : `<span class="link-btn disabled">Report</span>`}
        ${target.allureUrl ? `<a href="${Utils.escape(target.allureUrl)}" target="_blank" class="link-btn">Allure</a>` : `<span class="link-btn disabled">Allure</span>`}
      </div>`;

    return `
      <div class="last-run-modal-grid">
        <div class="last-run-modal-hero">
          <div class="hero-kicker">Build Summary</div>
          <div class="hero-title">Run #${Utils.escape(String(target.runNumber ?? '—'))}</div>
          <div class="hero-text">${Utils.escape(target.branch || 'unknown branch')} · ${Utils.escape(target.env || 'unknown env')} · ${Utils.escape(target.testType || 'unknown tag')} · ${target.formattedDate}</div>
          <div class="last-run-approval ${target.status === 'PASS' && (target.flaky || 0) === 0 ? 'good' : target.status === 'PASS' ? 'warn' : 'bad'}">${summary}</div>
        </div>
        <div class="last-run-modal-stats">
          <div class="last-run-modal-stat"><span>Pass rate</span><strong>${Utils.pct(target.passRate)}</strong></div>
          <div class="last-run-modal-stat"><span>Passed</span><strong>${target.passed}</strong></div>
          <div class="last-run-modal-stat"><span>Failed</span><strong>${target.failed}</strong></div>
          <div class="last-run-modal-stat"><span>Skipped</span><strong>${target.skipped}</strong></div>
          <div class="last-run-modal-stat"><span>Flaky</span><strong>${target.flaky || 0}</strong></div>
          <div class="last-run-modal-stat"><span>Duration</span><strong>${Utils.formatDuration(target.durationMin)}</strong></div>
        </div>
      </div>
      <div class="last-run-modal-section">
        <div class="section-hd">
          <div class="section-title"><span class="section-title-dot"></span>Build Details</div>
          ${links}
        </div>
        <div class="last-run-modal-notes">
          <div class="hero-bullet">Status is <strong>${target.status}</strong> against the pass threshold of ${State.passThreshold}%.</div>
          <div class="hero-bullet">${target.failed > 0 ? `${target.failed} failing tests in this build.` : 'No failing tests were recorded in this build.'}</div>
          <div class="hero-bullet">${(target.flaky || 0) > 0 ? `${target.flaky} flaky tests were detected in this build.` : 'No flaky tests were recorded in this build.'}</div>
        </div>
      </div>
      <div class="last-run-modal-section">
        <div class="section-hd">
          <div class="section-title"><span class="section-title-dot"></span>Latest Failures</div>
          <span class="section-sub">${failedTests.length} shown</span>
        </div>
        ${failedTests.length
          ? failedTests.map(test => `
            <div class="failing-item">
              <div class="failing-rank hot">!</div>
              <div style="flex:1;min-width:0">
                <div class="failing-name">${Utils.escape(test.name || 'Unnamed failure')}</div>
                <div class="failing-file">${Utils.escape(test.classname || 'No file path')}</div>
                ${test.failureMessage ? `<div class="failing-msg">${Utils.escape(String(test.failureMessage).split('\n')[0])}</div>` : ''}
              </div>
            </div>`).join('')
          : `<div class="failing-empty">No per-test failures were attached to the latest run</div>`}
      </div>`;
  },

  render(runs: Run[]): void {
    const panel = document.getElementById('last-run-panel');
    if (!panel) return;
    const latest = [...runs].sort((a, b) => b._dateMs - a._dateMs)[0];
    if (!latest) {
      panel.innerHTML = '';
      return;
    }

    const summary = latest.status === 'PASS' && (latest.flaky || 0) === 0
      ? { label: 'Build Passed', tone: 'good', detail: 'Latest run cleared the pass threshold with no flaky tests logged.' }
      : latest.status === 'PASS'
        ? { label: 'Passed With Flaky', tone: 'warn', detail: 'Latest run passed, but flaky activity was detected.' }
        : { label: 'Build Failed', tone: 'bad', detail: 'Latest run failed and has failing tests to review.' };

    panel.innerHTML = `
      <div class="last-run-card ${summary.tone}">
        <div class="last-run-copy">
          <div class="last-run-kicker">Latest ${Utils.escape(Utils.titleCase(latest.testType || 'Selected'))} Run</div>
          <div class="last-run-title">Run #${Utils.escape(String(latest.runNumber ?? '—'))} · ${Utils.escape(latest.branch || 'unknown branch')}</div>
          <div class="last-run-text">${latest.formattedDate} · ${Utils.escape(latest.env || 'unknown env')} · ${Utils.escape(latest.testType || 'unknown tag')}</div>
          <div class="last-run-text">${summary.detail}</div>
        </div>
        <div class="last-run-metrics">
          <div class="last-run-metric">
            <span class="last-run-metric-label">Status</span>
            <span class="badge badge-${latest.status === 'PASS' ? 'pass' : 'fail'}">${latest.status}</span>
          </div>
          <div class="last-run-metric">
            <span class="last-run-metric-label">Pass rate</span>
            <span class="last-run-metric-value">${Utils.pct(latest.passRate)}</span>
          </div>
          <div class="last-run-metric">
            <span class="last-run-metric-label">Failures</span>
            <span class="last-run-metric-value">${latest.failed}</span>
          </div>
          <div class="last-run-metric">
            <span class="last-run-metric-label">Flaky</span>
            <span class="last-run-metric-value">${latest.flaky || 0}</span>
          </div>
        </div>
        <div class="last-run-actions">
          <div class="last-run-approval ${summary.tone}">${summary.label}</div>
          <button class="btn btn-primary" id="last-run-open-btn" type="button">Review Last Run</button>
        </div>
      </div>`;

    document.getElementById('last-run-open-btn')?.addEventListener('click', () => this.open(latest));
  },

  open(run: Run | null = null): void {
    const modal = document.getElementById('last-run-modal');
    const body = document.getElementById('last-run-modal-body');
    if (!modal || !body) return;
    const target = run || [...State.filteredRuns].sort((a, b) => b._dateMs - a._dateMs)[0];
    if (!target) return;
    body.innerHTML = this.buildContent(target);
    modal.classList.add('open');
  },

  close(): void {
    document.getElementById('last-run-modal')?.classList.remove('open');
  },
};
