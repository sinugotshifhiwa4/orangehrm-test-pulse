/* ══════════════════════════════════════════
   Run History table
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { CompareModule } from './compare';

export const TableModule = {
  toggleDetails(rn: number): void {
    if (State.expandedRuns.has(rn)) State.expandedRuns.delete(rn);
    else State.expandedRuns.add(rn);
    this.render();
  },

  /** Update the "showing X–Y of N" label and enable/disable the pager buttons.
      With a single page (e.g. fewer rows than the page size) both buttons are
      disabled and read as greyed out. */
  renderPager(total: number, start: number, end: number, pageCount: number): void {
    const ind = document.getElementById('page-indicator');
    if (ind) ind.textContent = total === 0 ? 'No runs' : `Showing ${start + 1}–${Math.min(end, total)} of ${total}`;
    const prev = document.getElementById('page-prev') as HTMLButtonElement | null;
    const next = document.getElementById('page-next') as HTMLButtonElement | null;
    if (prev) prev.disabled = State.tablePage <= 1;
    if (next) next.disabled = State.tablePage >= pageCount;
    const sel = document.getElementById('page-size-select') as HTMLSelectElement | null;
    if (sel && sel.value !== String(State.tablePageSize)) sel.value = String(State.tablePageSize);
  },

  render(): void {
    const avgDur = Utils.avg(State.filteredRuns.filter(r => r.durationMin != null && r.durationMin > 0).map(r => r.durationMin as number));
    const outlier = avgDur * 1.5;
    let rows = [...State.filteredRuns];
    const { col, dir } = State.sort;
    rows = rows.sort((a, b) => {
      let av: unknown = a[col], bv: unknown = b[col];
      if (col === 'formattedDate') { av = a._dateMs; bv = b._dateMs; }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return (av as number) < (bv as number) ? (dir === 'asc' ? -1 : 1) : (av as number) > (bv as number) ? (dir === 'asc' ? 1 : -1) : 0;
    });
    // Pagination: sort/filter run across the full set above, then slice the page.
    const total = rows.length;
    const size = State.tablePageSize; // 0 = show all
    const pageCount = size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
    State.tablePage = Math.min(Math.max(1, State.tablePage), pageCount);
    const start = size > 0 ? (State.tablePage - 1) * size : 0;
    const end = size > 0 ? start + size : total;
    const pageRows = rows.slice(start, end);
    this.renderPager(total, start, end, pageCount);

    const rClass = (r: Run) => (r.passRate ?? 0) >= State.passThreshold ? 'high' : (r.passRate ?? 0) >= 70 ? 'mid' : 'low';
    const tbody = document.getElementById('runs-tbody');
    if (!tbody) return;
    tbody.innerHTML = pageRows.map(r => {
      const sel = State.compareIds.has(r.runNumber as number);
      const expanded = State.expandedRuns.has(r.runNumber as number);
      const isOutlier = avgDur > 0 && r.durationMin != null && r.durationMin > outlier;
      const rLink = r.reportUrl
        ? `<a href="${Utils.escape(r.reportUrl)}" target="_blank" class="link-btn">Report</a>`
        : `<span class="link-btn disabled">Report</span>`;
      const aLink = r.ortoniUrl
        ? `<a href="${Utils.escape(r.ortoniUrl)}" target="_blank" class="link-btn">Ortoni</a>`
        : `<span class="link-btn disabled">Ortoni</span>`;
      return `<tr class="${r.status === 'FAIL' ? 'row-fail' : ''}${sel ? ' row-compare' : ''}">
        <td><input type="checkbox" class="cmp-cb" data-run-number="${r.runNumber}" ${sel ? 'checked' : ''} ${!sel && State.compareIds.size >= 2 ? 'disabled' : ''} /></td>
        <td class="mono">#${r.runNumber ?? '—'}</td>
        <td class="mono col-hide">${r.formattedDate}</td>
        <td class="mono">${Utils.escape(r.branch || '—')}</td>
        <td class="col-hide"><span class="pill pill-purple">@${Utils.escape(r.testType || '—')}</span></td>
        <td class="col-hide"><span class="pill pill-orange">${Utils.escape(r.project || '—')}</span></td>
        <td class="col-hide"><span class="pill pill-blue">${Utils.escape(r.env || '—')}</span></td>
        <td>
          <div class="rate-bar">
            <div class="rate-track"><div class="rate-fill ${rClass(r)}" style="width:${r.passRate ?? 0}%"></div></div>
            <span class="mono">${Utils.pct(r.passRate)}</span>
          </div>
        </td>
        <td class="mono" style="color:${r.failed > 0 ? 'var(--red)' : 'var(--green)'}">${r.failed}</td>
        <td class="mono col-hide" style="color:${(r.flaky || 0) > 0 ? 'var(--orange)' : 'var(--text-3)'}">${r.flaky || 0}</td>
        <td class="mono col-hide">${Utils.formatDuration(r.durationMin)}${isOutlier ? ' <span class="badge badge-skip" style="font-size:9px">slow</span>' : ''}</td>
        <td><span class="badge badge-${r.status === 'PASS' ? 'pass' : 'fail'}">${r.status}</span></td>
        <td class="col-hide"><div class="links-cell">${rLink}${aLink}</div></td>
        <td class="mobile-row-toggle-cell">
          <button class="mobile-row-toggle" type="button" data-run-number="${r.runNumber}" aria-expanded="${expanded ? 'true' : 'false'}">
            ${expanded ? 'Hide details' : 'View details'}
          </button>
        </td>
        <td class="mobile-row-details-cell">
          <div class="mobile-row-details ${expanded ? 'open' : ''}">
            <div class="mobile-detail-grid">
              <div class="mobile-detail-item">
                <span class="mobile-detail-label">Tag</span>
                <span class="pill pill-purple">@${Utils.escape(r.testType || '—')}</span>
              </div>
              <div class="mobile-detail-item">
                <span class="mobile-detail-label">Project</span>
                <span class="pill pill-orange">${Utils.escape(r.project || '—')}</span>
              </div>
              <div class="mobile-detail-item">
                <span class="mobile-detail-label">Env</span>
                <span class="pill pill-blue">${Utils.escape(r.env || '—')}</span>
              </div>
              <div class="mobile-detail-item">
                <span class="mobile-detail-label">Flaky</span>
                <span class="mono">${r.flaky || 0}</span>
              </div>
              <div class="mobile-detail-item">
                <span class="mobile-detail-label">Duration</span>
                <span class="mono">${Utils.formatDuration(r.durationMin)}${isOutlier ? ' slow' : ''}</span>
              </div>
              <div class="mobile-detail-item mobile-detail-links">
                <span class="mobile-detail-label">Links</span>
                <div class="links-cell">${rLink}${aLink}</div>
              </div>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('');
    document.querySelectorAll<HTMLInputElement>('.cmp-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        CompareModule.toggle(Number(cb.dataset.runNumber), cb.checked);
      });
    });
    document.querySelectorAll<HTMLButtonElement>('.mobile-row-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toggleDetails(Number(btn.dataset.runNumber));
      });
    });
    document.querySelectorAll<HTMLElement>('#runs-table thead th[data-col]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.col === col);
      const a = (th.textContent || '').replace(/[↑↓↕]/g, '').trim();
      th.textContent = a + ' ' + (th.dataset.col === col ? (dir === 'asc' ? '↑' : '↓') : '');
    });
  },
};
