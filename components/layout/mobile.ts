/* ══════════════════════════════════════════
   Mobile chrome — sidebar drawer, filter sheet,
   and the mobile-only filter controls.
   ══════════════════════════════════════════ */
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { DropdownModule } from '../filters/dropdown';
import { App } from '../../app/app';

export const MobileModule = {
  openSidebar(): void {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('visible');
    document.body.style.overflow = 'hidden';
  },
  closeSidebar(): void {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
    document.body.style.overflow = '';
  },
  toggleFilterSheet(): void {
    const sheet = document.getElementById('filter-sheet');
    const overlay = document.getElementById('filter-sheet-overlay');
    if (!sheet || !overlay) return;
    const isOpen = sheet.classList.contains('open');
    if (isOpen) {
      this.closeFilterSheet();
    } else {
      sheet.classList.add('open');
      overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
    }
  },
  closeFilterSheet(): void {
    document.getElementById('filter-sheet')?.classList.remove('open');
    document.getElementById('filter-sheet-overlay')?.classList.remove('visible');
    document.body.style.overflow = '';
  },
  clearFilters(): void {
    State.filters = { branch: '', env: '', testTags: [], userRole: '', status: '' };
    State.dateRangeDays = 0;
    State.passThreshold = 100;
    // Reset all radios/checkboxes in sheet
    document.querySelectorAll<HTMLInputElement>('#filter-sheet input[type=radio][value=""]').forEach(r => r.checked = true);
    document.querySelectorAll<HTMLInputElement>('#filter-sheet input[type=checkbox]').forEach(c => c.checked = false);
    document.querySelectorAll<HTMLElement>('.date-pill').forEach(p => p.classList.toggle('active', p.dataset.days === '0'));
    document.querySelectorAll<HTMLInputElement>('input[name="filter-status"][value=""]').forEach(r => r.checked = true);
    const desk = document.getElementById('pass-threshold') as HTMLInputElement | null;
    const mobile = document.getElementById('pass-threshold-m') as HTMLInputElement | null;
    if (desk) desk.value = '100';
    if (mobile) mobile.value = '100';
    const deskVal = document.getElementById('threshold-val');
    const mobileVal = document.getElementById('threshold-val-m');
    if (deskVal) deskVal.textContent = '100%';
    if (mobileVal) mobileVal.textContent = '100%';
    DropdownModule.updateSingleLabel('dd-status-label', 'Filter Status', '');
    DropdownModule.updateSingleLabel('dd-branch-label', 'All Branches', '');
    DropdownModule.updateSingleLabel('dd-env-label', 'All Envs', '');
    DropdownModule.updateSingleLabel('dd-user-label', 'All Users', '');
    DropdownModule.updateTagsLabel();
    App.updateUI();
  },

  /** Build filter sheet panels (called after data loads) */
  populateSheet(): void {
    const runs = State.allRuns;
    this._buildSheetRadio('fs-branch-panel', Utils.unique(runs.map(r => r.branch)).sort(), 'branch', 'filter-status-branch');
    this._buildSheetRadio('fs-env-panel', Utils.unique(runs.map(r => r.env || '')).sort(), 'env', 'filter-status-env');
    this._buildSheetRadio('fs-user-panel', Utils.unique(runs.map(r => r.userRole)).sort(), 'userRole', 'filter-status-user');
    this._buildSheetCheckbox('fs-tags-panel', Utils.unique(runs.map(r => r.testType)).sort());

    // Status radios
    document.querySelectorAll<HTMLInputElement>('input[name="filter-status-m"]').forEach(input => {
      input.addEventListener('change', () => {
        State.filters.status = input.value as typeof State.filters.status;
        // sync desktop dropdown label
        DropdownModule.updateSingleLabel('dd-status-label', 'Filter Status',
          input.value ? (input.value === 'PASS' ? 'Passed' : 'Failed') : '');
        App.updateUI();
      });
    });

    // Mobile date pills
    document.querySelectorAll<HTMLElement>('#date-group-mobile .date-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        State.dateRangeDays = Number(btn.dataset.days);
        // sync both pill groups
        document.querySelectorAll<HTMLElement>('.date-pill').forEach(p =>
          p.classList.toggle('active', Number(p.dataset.days) === State.dateRangeDays)
        );
        App.updateUI();
      });
    });

    // Mobile threshold
    document.getElementById('pass-threshold-m')?.addEventListener('input', e => {
      State.passThreshold = Number((e.target as HTMLInputElement).value);
      const mVal = document.getElementById('threshold-val-m');
      if (mVal) mVal.textContent = `${State.passThreshold}%`;
      // sync desktop slider
      const desk = document.getElementById('pass-threshold') as HTMLInputElement | null;
      if (desk) desk.value = String(State.passThreshold);
      const dVal = document.getElementById('threshold-val');
      if (dVal) dVal.textContent = `${State.passThreshold}%`;
      App.updateUI();
    });
  },

  _buildSheetRadio(panelId: string, values: string[], filterKey: keyof typeof State.filters, radioName: string): void {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.innerHTML = `<label class="dd-option"><input type="radio" name="${radioName}" value="" checked /> All</label>`
      + values.filter(Boolean).map(v =>
        `<label class="dd-option"><input type="radio" name="${radioName}" value="${Utils.escape(v)}" /> ${Utils.escape(v)}</label>`
      ).join('');
    panel.querySelectorAll<HTMLInputElement>(`input[name="${radioName}"]`).forEach(input => {
      input.addEventListener('change', () => {
        (State.filters[filterKey] as string) = input.value;
        // sync desktop dropdown label
        const labelMap: Record<string, string> = { branch: 'dd-branch-label', env: 'dd-env-label', userRole: 'dd-user-label' };
        const allMap: Record<string, string> = { branch: 'All Branches', env: 'All Envs', userRole: 'All Users' };
        if (labelMap[filterKey]) DropdownModule.updateSingleLabel(labelMap[filterKey], allMap[filterKey], input.value);
        App.updateUI();
      });
    });
  },

  _buildSheetCheckbox(panelId: string, values: string[]): void {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.innerHTML = values.filter(Boolean).map(v =>
      `<label class="dd-option">
        <input type="checkbox" name="filter-tag-m" value="${Utils.escape(v)}" ${State.filters.testTags.includes(v) ? 'checked' : ''} />
        <span class="pill pill-purple" style="pointer-events:none">@${Utils.escape(v)}</span>
      </label>`
    ).join('');
    panel.querySelectorAll<HTMLInputElement>('input[name="filter-tag-m"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = [...panel.querySelectorAll<HTMLInputElement>('input[name="filter-tag-m"]:checked')].map(c => c.value);
        State.filters.testTags = checked;
        DropdownModule.updateTagsLabel();
        App.updateUI();
      });
    });
  },
};
