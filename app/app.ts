/* ══════════════════════════════════════════
   App controller — wiring, refresh, render loop
   ══════════════════════════════════════════ */
import { State } from './state';
import { Utils } from './core/utils';
import { DataModule } from './core/data';
import { FilterModule } from './core/filters';
import { DropdownModule } from '../components/filters/dropdown';
import { NavModule } from '../components/layout/nav';
import { MobileModule } from '../components/layout/mobile';
import { TimerModule } from '../components/layout/timer';
import { VisualsModule } from '../components/visuals/visuals';
import { ExecutiveModule } from '../components/overview/executive';
import { LastRunModule } from '../components/overview/last-run';
import { OverviewModule } from '../components/overview/overview';
import { ChartModule } from '../components/trends/charts';
import { BreakdownModule } from '../components/visuals/breakdown';
import { TopFailingModule } from '../components/visuals/top-failing';
import { RiskModule } from '../components/visuals/risk';
import { TableModule } from '../components/history/table';
import { CompareModule } from '../components/history/compare';
import { ExportModule } from '../components/history/export-csv';
import { ExportImageModule } from '../components/reports/export-image';
import { ReportModule } from '../components/reports/report';
import { BuildReportModule } from '../components/reports/build-report';
import { SprintReportModule } from '../components/reports/sprint-report';

export const App = {
  bindClick(el: Element | null, handler: (e: Event) => void): void {
    if (!el) return;
    el.removeAttribute('onclick');
    (el as HTMLElement).onclick = null;
    el.addEventListener('click', handler);
  },

  syncSearchInputs(): void {
    const table = document.getElementById('table-search') as HTMLInputElement | null;
    if (table && table.value !== State.tableSearch) table.value = State.tableSearch;
  },

  bindStaticActions(): void {
    this.restoreSidebarCollapsed();
    this.bindClick(document.getElementById('sidebar-collapse'), () => this.toggleSidebarCollapsed());
    this.bindClick(document.getElementById('filter-sheet-overlay'), () => MobileModule.closeFilterSheet());
    this.bindClick(document.querySelector('#filter-sheet .modal-close'), () => MobileModule.closeFilterSheet());
    this.bindClick(document.querySelector('#compare-modal .modal-close'), () => CompareModule.close());
    this.bindClick(document.getElementById('last-run-modal-close'), () => LastRunModule.close());
    const compareModal = document.getElementById('compare-modal');
    compareModal?.removeAttribute('onclick');
    compareModal?.addEventListener('click', e => {
      if (e.target === e.currentTarget) CompareModule.close();
    });
    const lastRunModal = document.getElementById('last-run-modal');
    lastRunModal?.addEventListener('click', e => {
      if (e.target === e.currentTarget) LastRunModule.close();
    });
    this.bindClick(document.querySelector('#error-state .btn'), () => this.refresh());
    this.bindClick(document.querySelector('.mobile-filter-btn'), () => MobileModule.toggleFilterSheet());
    this.bindClick(document.querySelector('#header-filters .threshold-chip'), () => MobileModule.toggleFilterSheet());
    this.bindClick(document.querySelector('.header-right .btn[title="Refresh"]'), () => this.refresh());
    this.bindClick(document.getElementById('report-overall-btn'), () => ReportModule.downloadOverall());
    this.bindClick(document.getElementById('report-last-run-btn'), () => ReportModule.downloadLastRun());
    this.bindClick(document.getElementById('report-build-btn'), () => BuildReportModule.build());
    this.bindClick(document.getElementById('report-sprint-pdf-btn'), () => SprintReportModule.build());
    this.bindReportControls();

    document.querySelectorAll<HTMLElement>('.export-trigger').forEach(trigger => {
      this.bindClick(trigger, e => {
        e.stopPropagation();
        const wrap = trigger.closest('.dropdown-wrap');
        if (wrap?.id) DropdownModule.toggle(wrap.id);
      });
    });
    document.querySelectorAll<HTMLElement>('.export-option').forEach(opt => {
      this.bindClick(opt, () => {
        if (opt.dataset.format === 'excel') ExportModule.excel(State.filteredRuns).catch(console.error);
        else ExportModule.csv(State.filteredRuns);
        DropdownModule.closeAll({ target: document.body });
      });
    });

    const sheetButtons = document.querySelectorAll('.filter-sheet-footer .btn');
    this.bindClick(sheetButtons[0], () => MobileModule.clearFilters());
    this.bindClick(sheetButtons[1], () => MobileModule.closeFilterSheet());

    this.bindClick(document.querySelector('#compare-bar .btn:not(#compare-btn)'), () => CompareModule.clear());
    this.bindClick(document.getElementById('compare-btn'), () => CompareModule.open());

    ['dd-status', 'dd-branch', 'dd-env', 'dd-tags', 'dd-project'].forEach(id => {
      const trigger = document.querySelector(`#${id} .dropdown-trigger`);
      this.bindClick(trigger, e => {
        e.stopPropagation();
        DropdownModule.toggle(id);
      });
    });

    document.querySelectorAll<HTMLElement>('.visual-tab').forEach(tab => {
      this.bindClick(tab, () => VisualsModule.show(tab.dataset.visualSection || ''));
    });

    this.bindClick(document.getElementById('top-failing-viewall-ov'), () => {
      NavModule.show('breakdown');
      document.querySelectorAll<HTMLElement>('.mbn-item').forEach(b => b.classList.toggle('active', b.dataset.page === 'breakdown'));
      VisualsModule.show('failures');
    });

    ExportImageModule.enhance();
  },

  /** Reports page: sub-tab switching, Overall date/sprint scope, build defaults. */
  bindReportControls(): void {
    document.querySelectorAll<HTMLElement>('.report-tab').forEach(tab => {
      this.bindClick(tab, () => {
        const name = tab.dataset.reportTab || '';
        document.querySelectorAll<HTMLElement>('.report-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll<HTMLElement>('.report-panel').forEach(p => p.classList.toggle('active', p.dataset.reportPanel === name));
        // The Sprint tab scopes reports by the date/sprint controls; Overall uses all runs.
        ReportModule.scopeMode = name === 'sprint' ? 'sprint' : 'overall';
        ReportModule.renderScopeNote();
      });
    });

    const from = document.getElementById('report-date-from') as HTMLInputElement | null;
    const to = document.getElementById('report-date-to') as HTMLInputElement | null;
    const sprint = document.getElementById('report-sprint') as HTMLInputElement | null;
    const syncScope = (): void => {
      ReportModule.overrides = {
        from: from?.value || '',
        to: to?.value || '',
        sprint: sprint?.value.trim() || '',
      };
      ReportModule.renderScopeNote();
    };
    from?.addEventListener('change', syncScope);
    to?.addEventListener('change', syncScope);
    sprint?.addEventListener('input', syncScope);

    this.bindClick(document.getElementById('report-scope-reset'), () => {
      if (from) from.value = '';
      if (to) to.value = '';
      if (sprint) sprint.value = '';
      syncScope();
    });

    // Build number/date default to the Overview latest run until the user edits them.
    ['build-number', 'build-date'].forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.addEventListener('input', () => { el.dataset.touched = el.value.trim() ? '1' : ''; });
    });
  },

  SIDEBAR_COLLAPSED_KEY: 'qa-sidebar-collapsed',

  setCollapseLabel(collapsed: boolean): void {
    const btn = document.getElementById('sidebar-collapse');
    if (!btn) return;
    const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
  },

  restoreSidebarCollapsed(): void {
    const collapsed = localStorage.getItem(this.SIDEBAR_COLLAPSED_KEY) === '1';
    if (collapsed) document.getElementById('sidebar')?.classList.add('collapsed');
    this.setCollapseLabel(collapsed);
    this.applyContentScale();
    window.addEventListener('resize', () => this.applyContentScale());
  },

  toggleSidebarCollapsed(): void {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem(this.SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    this.setCollapseLabel(collapsed);
    this.applyContentScale();
  },

  _scaleTimer: 0,

  /** Collapsing changes the content width. A `body.sidebar-collapsed` flag lets the CSS
      scale things up, and we rebuild the charts once the width transition settles so they
      refit the new size instead of keeping their old (stretched) shape. */
  applyContentScale(): void {
    const collapsed = !!document.getElementById('sidebar')?.classList.contains('collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed && window.innerWidth > 680);
    clearTimeout(this._scaleTimer);
    this._scaleTimer = window.setTimeout(() => ChartModule.renderAll(State.filteredRuns), 260);
  },

  async init(): Promise<void> {
    this.bindStaticActions();
    NavModule.updateHeader();

    // Mobile bottom nav
    document.querySelectorAll<HTMLElement>('.mbn-item').forEach(btn => {
      btn.addEventListener('click', () => {
        NavModule.show(btn.dataset.page || '');
        document.querySelectorAll<HTMLElement>('.mbn-item').forEach(b => b.classList.toggle('active', b === btn));
        MobileModule.closeSidebar();
      });
    });

    // Sidebar nav items also close the drawer on mobile
    document.querySelectorAll<HTMLElement>('.nav-item').forEach(n => {
      n.addEventListener('click', () => {
        NavModule.show(n.dataset.page || '');
        document.querySelectorAll<HTMLElement>('.mbn-item').forEach(b => b.classList.toggle('active', b.dataset.page === n.dataset.page));
        MobileModule.closeSidebar();
      });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', e => DropdownModule.closeAll(e));

    // Date pills
    document.querySelectorAll<HTMLElement>('.date-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        State.dateRangeDays = Number(btn.dataset.days);
        FilterModule.syncDatePills();
        App.updateUI();
      });
    });

    // Pass threshold
    document.getElementById('pass-threshold')?.addEventListener('input', e => {
      State.passThreshold = Number((e.target as HTMLInputElement).value);
      const el = document.getElementById('threshold-val');
      if (el) el.textContent = `${State.passThreshold}%`;
      App.updateUI();
    });

    // Table search (Run History)
    document.getElementById('table-search')?.addEventListener('input', e => {
      State.tableSearch = (e.target as HTMLInputElement).value;
      this.syncSearchInputs();
      this.updateUI();
    });

    // Table sort
    document.querySelectorAll<HTMLElement>('#runs-table thead th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const c = th.dataset.col as string;
        if (State.sort.col === c) State.sort.dir = State.sort.dir === 'asc' ? 'desc' : 'asc';
        else { State.sort.col = c; State.sort.dir = 'asc'; }
        TableModule.render();
      });
    });

    await this.refresh();
  },

  async refresh(): Promise<void> {
    this.showLoading(true);
    TimerModule.start();
    try {
      const raw = await DataModule.fetch();
      State.allRuns = DataModule.normalize(raw);
      DropdownModule.populate();
      MobileModule.populateSheet();
      this.syncSearchInputs();
      this.updateUI();
      const lu = document.getElementById('last-updated');
      if (lu) lu.textContent = (DataModule.usingMock ? '⚠ Mock · ' : '') + 'Updated ' + new Date().toLocaleTimeString('en-ZA');
      const banner = document.getElementById('mock-banner');
      if (banner) {
        if (DataModule.usingMock) {
          banner.style.display = 'flex';
          const detail = document.getElementById('mock-error-detail');
          if (detail) detail.textContent = `(${DataModule.lastError})`;
        } else {
          banner.style.display = 'none';
        }
      }
      this.showLoading(false);
    } catch (e) {
      console.error(e);
      const loading = document.getElementById('loading-state');
      const error = document.getElementById('error-state');
      const msg = document.getElementById('error-message');
      if (loading) loading.style.display = 'none';
      if (error) error.style.display = 'flex';
      if (msg) msg.textContent = `Failed to load: ${(e as Error).message}`;
    }
  },

  updateUI(): void {
    FilterModule.apply();
    this.syncSearchInputs();
    this.updateAdvancedFilterTrigger();
    this.renderFilterChips();
    const runs = State.filteredRuns;
    ExecutiveModule.render(runs);
    OverviewModule.render(runs);
    LastRunModule.render(runs);
    ChartModule.renderAll(runs);
    BreakdownModule.renderAll(runs);
    TopFailingModule.render(runs);
    TopFailingModule.render(runs, 'top-failing-sub-ov', 'top-failing-list-ov', { limit: 5, windowDays: 30 });
    RiskModule.renderModules(runs);
    RiskModule.renderCategoryList(runs);
    VisualsModule.show(State.visualSection);
    TableModule.render();
    ReportModule.renderScopeSummary();
    ReportModule.renderScopeNote();
    BuildReportModule.syncDefaults();
    ExportImageModule.enhance();
  },

  updateAdvancedFilterTrigger(): void {
    const trigger = document.querySelector<HTMLElement>('#header-filters .threshold-chip');
    if (!trigger) return;
    const count = [
      State.dateRangeDays > 0,
      !!State.filters.status,
      !!State.filters.branch,
      !!State.filters.env,
      State.filters.testTags.length > 0,
      !!State.filters.project,
      State.passThreshold !== 100,
    ].filter(Boolean).length;
    trigger.dataset.count = count > 0 ? String(count) : '';
    trigger.classList.toggle('has-active-filters', count > 0);
  },

  /** Render a removable chip in the header for each active filter. */
  renderFilterChips(): void {
    const box = document.getElementById('filter-chips');
    if (!box) return;
    const f = State.filters;
    const chips: { kind: string; value?: string; label: string }[] = [];
    if (State.dateRangeDays > 0) chips.push({ kind: 'date', label: `Last ${State.dateRangeDays} days` });
    if (f.status) chips.push({ kind: 'status', label: f.status === 'PASS' ? 'Passed' : 'Failed' });
    if (f.branch) chips.push({ kind: 'branch', label: f.branch });
    if (f.env) chips.push({ kind: 'env', label: f.env });
    f.testTags.forEach(t => chips.push({ kind: 'tag', value: t, label: `@${t}` }));
    if (f.project) chips.push({ kind: 'project', label: f.project });
    if (State.passThreshold !== 100) chips.push({ kind: 'threshold', label: `Pass ≥ ${State.passThreshold}%` });

    if (chips.length === 0) { box.innerHTML = ''; return; }

    const x = `<svg viewBox="0 0 12 12" class="filter-chip-x"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    box.innerHTML = chips.map(c =>
      `<button class="filter-chip" data-kind="${c.kind}"${c.value != null ? ` data-value="${Utils.escape(c.value)}"` : ''} title="Remove filter">
        <span>${Utils.escape(c.label)}</span>${x}
      </button>`).join('')
      + (chips.length > 1 ? `<button class="filter-chip filter-chip-clear" data-kind="all" title="Clear all filters">Clear all</button>` : '');

    box.querySelectorAll<HTMLElement>('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => this.clearFilter(chip.dataset.kind || '', chip.dataset.value));
    });
  },

  _resetSheetRadio(name: string): void {
    document.querySelectorAll<HTMLInputElement>(`input[name="${name}"][value=""]`).forEach(r => (r.checked = true));
  },

  /** Clear a single active filter (or all) and re-render. */
  clearFilter(kind: string, value?: string): void {
    const f = State.filters;
    switch (kind) {
      case 'all': MobileModule.clearFilters(); return;
      case 'date':
        State.dateRangeDays = 0;
        document.querySelectorAll<HTMLElement>('.date-pill').forEach(p => p.classList.toggle('active', p.dataset.days === '0'));
        break;
      case 'status':
        f.status = '';
        document.querySelectorAll<HTMLInputElement>('input[name="filter-status-m"][value=""], input[name="filter-status"][value=""]').forEach(r => (r.checked = true));
        DropdownModule.updateSingleLabel('dd-status-label', 'Filter Status', '');
        break;
      case 'branch':
        f.branch = '';
        this._resetSheetRadio('filter-status-branch');
        DropdownModule.updateSingleLabel('dd-branch-label', 'All Branches', '');
        break;
      case 'env':
        f.env = '';
        this._resetSheetRadio('filter-status-env');
        DropdownModule.updateSingleLabel('dd-env-label', 'All Envs', '');
        break;
      case 'project':
        f.project = '';
        this._resetSheetRadio('filter-status-project');
        DropdownModule.updateSingleLabel('dd-project-label', 'All Projects', '');
        break;
      case 'tag':
        f.testTags = f.testTags.filter(t => t !== value);
        document.querySelectorAll<HTMLInputElement>('input[name="filter-tag-m"]').forEach(c => { if (c.value === value) c.checked = false; });
        DropdownModule.updateTagsLabel();
        break;
      case 'threshold':
        State.passThreshold = 100;
        ['pass-threshold', 'pass-threshold-m'].forEach(id => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = '100'; });
        ['threshold-val', 'threshold-val-m'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '100%'; });
        break;
      default: return;
    }
    this.updateUI();
  },


  showLoading(visible: boolean): void {
    const loading = document.getElementById('loading-state');
    const error = document.getElementById('error-state');
    if (loading) loading.style.display = visible ? 'flex' : 'none';
    if (error) error.style.display = 'none';
    document.querySelectorAll<HTMLElement>('.page').forEach(p =>
      p.classList.toggle('active', !visible && p.id === `page-${NavModule.current}`)
    );
  },
};
