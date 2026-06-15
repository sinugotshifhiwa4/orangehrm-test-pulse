/* ══════════════════════════════════════════
   App controller — wiring, refresh, render loop
   ══════════════════════════════════════════ */
import { State } from './state';
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

export const App = {
  bindClick(el: Element | null, handler: (e: Event) => void): void {
    if (!el) return;
    el.removeAttribute('onclick');
    (el as HTMLElement).onclick = null;
    el.addEventListener('click', handler);
  },

  syncSearchInputs(): void {
    const header = document.getElementById('header-search') as HTMLInputElement | null;
    const table = document.getElementById('table-search') as HTMLInputElement | null;
    if (header && header.value !== State.tableSearch) header.value = State.tableSearch;
    if (table && table.value !== State.tableSearch) table.value = State.tableSearch;
  },

  bindStaticActions(): void {
    this.bindClick(document.getElementById('sidebar-overlay'), () => MobileModule.closeSidebar());
    this.bindClick(document.getElementById('hamburger'), () => MobileModule.openSidebar());
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

    document.querySelectorAll('button.btn').forEach(btn => {
      if (btn.textContent?.includes('CSV')) {
        this.bindClick(btn, () => this.exportCSV());
      }
    });

    const sheetButtons = document.querySelectorAll('.filter-sheet-footer .btn');
    this.bindClick(sheetButtons[0], () => MobileModule.clearFilters());
    this.bindClick(sheetButtons[1], () => MobileModule.closeFilterSheet());

    this.bindClick(document.querySelector('#compare-bar .btn:not(#compare-btn)'), () => CompareModule.clear());
    this.bindClick(document.getElementById('compare-btn'), () => CompareModule.open());

    ['dd-status', 'dd-branch', 'dd-env', 'dd-tags', 'dd-user'].forEach(id => {
      const trigger = document.querySelector(`#${id} .dropdown-trigger`);
      this.bindClick(trigger, e => {
        e.stopPropagation();
        DropdownModule.toggle(id);
      });
    });

    document.querySelectorAll<HTMLElement>('.visual-tab').forEach(tab => {
      this.bindClick(tab, () => VisualsModule.show(tab.dataset.visualSection || ''));
    });

    ExportImageModule.enhance();
  },

  async init(): Promise<void> {
    this.bindStaticActions();

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

    // Header search (mirrors to table search)
    document.getElementById('header-search')?.addEventListener('input', e => {
      State.tableSearch = (e.target as HTMLInputElement).value;
      this.syncSearchInputs();
      this.updateUI();
    });

    // Table search
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
    const runs = State.filteredRuns;
    ExecutiveModule.render(runs);
    OverviewModule.render(runs);
    LastRunModule.render(runs);
    ChartModule.renderAll(runs);
    BreakdownModule.renderAll(runs);
    TopFailingModule.render(runs);
    TopFailingModule.render(runs, 'top-failing-sub-ov', 'top-failing-list-ov');
    RiskModule.renderModules(runs);
    RiskModule.renderCategoryList(runs);
    VisualsModule.show(State.visualSection);
    TableModule.render();
    ReportModule.renderScopeSummary();
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
      !!State.filters.userRole,
      State.passThreshold !== 100,
    ].filter(Boolean).length;
    trigger.dataset.count = count > 0 ? String(count) : '';
    trigger.classList.toggle('has-active-filters', count > 0);
  },

  exportCSV(): void { ExportModule.download(State.filteredRuns); },

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
