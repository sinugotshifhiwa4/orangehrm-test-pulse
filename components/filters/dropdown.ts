/* ══════════════════════════════════════════
   Desktop header filter dropdowns
   ══════════════════════════════════════════ */
import type { Filters } from '../../app/types';
import { State } from '../../app/state';
import { Utils } from '../../app/core/utils';
import { App } from '../../app/app';

export const DropdownModule = {
  /** Toggle open/close for a dropdown by wrapper id */
  toggle(wrapperId: string): void {
    const wrap = document.getElementById(wrapperId);
    if (!wrap) return;
    const isOpen = wrap.classList.contains('open');
    // Close all
    document.querySelectorAll('.dropdown-wrap.open').forEach(w => w.classList.remove('open'));
    if (!isOpen) wrap.classList.add('open');
  },

  /** Close all dropdowns when clicking outside */
  closeAll(e: { target: EventTarget | null }): void {
    if (!(e.target as HTMLElement)?.closest?.('.dropdown-wrap')) {
      document.querySelectorAll('.dropdown-wrap.open').forEach(w => w.classList.remove('open'));
    }
  },

  /** Build a single-select radio panel (branch, env, project) */
  buildRadioPanel(panelId: string, values: string[], filterKey: keyof Filters, labelId: string, allLabel: string): void {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.innerHTML = `<label class="dd-option"><input type="radio" name="${filterKey}" value="" ${!State.filters[filterKey] ? 'checked' : ''} /> ${allLabel}</label>`
      + Utils.unique(values.filter(Boolean)).sort().map(v =>
        `<label class="dd-option"><input type="radio" name="${filterKey}" value="${Utils.escape(v)}" ${State.filters[filterKey] === v ? 'checked' : ''} /> ${Utils.escape(v)}</label>`
      ).join('');

    panel.querySelectorAll<HTMLInputElement>(`input[name="${filterKey}"]`).forEach(input => {
      input.addEventListener('change', () => {
        (State.filters[filterKey] as string) = input.value;
        DropdownModule.updateSingleLabel(labelId, allLabel, input.value);
        DropdownModule.closeAll({ target: document.body });
        App.updateUI();
      });
    });
  },

  /** Build the multi-select checkbox panel for Test Tags */
  buildTagsPanel(values: string[]): void {
    const panel = document.getElementById('dd-tags-panel');
    if (!panel) return;
    const sorted = Utils.unique(values.filter(Boolean)).sort();
    panel.innerHTML = sorted.map(v =>
      `<label class="dd-option">
        <input type="checkbox" name="filter-tag" value="${Utils.escape(v)}" ${State.filters.testTags.includes(v) ? 'checked' : ''} />
        <span class="pill pill-purple" style="pointer-events:none">@${Utils.escape(v)}</span>
      </label>`
    ).join('');

    panel.querySelectorAll<HTMLInputElement>('input[name="filter-tag"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = [...panel.querySelectorAll<HTMLInputElement>('input[name="filter-tag"]:checked')].map(c => c.value);
        State.filters.testTags = checked;
        DropdownModule.updateTagsLabel();
        App.updateUI();
        // Don't close panel so user can pick multiple
      });
    });
  },

  /** Update the label text for single-select dropdowns */
  updateSingleLabel(labelId: string, allLabel: string, value: string): void {
    const el = document.getElementById(labelId);
    if (!el) return;
    el.textContent = value || allLabel;
    el.classList.toggle('active', !!value);
  },

  /** Update the Tags label to show selected chip count or names */
  updateTagsLabel(): void {
    const el = document.getElementById('dd-tags-label');
    if (!el) return;
    const tags = State.filters.testTags;
    if (!tags.length) {
      el.textContent = 'Filter Tags';
      el.classList.remove('active');
    } else if (tags.length <= 2) {
      el.innerHTML = tags.map(t => `<span class="dd-chip">@${Utils.escape(t)}</span>`).join(' ');
      el.classList.add('active');
    } else {
      el.innerHTML = `<span class="dd-chip">${tags.length} tags</span>`;
      el.classList.add('active');
    }
  },

  /** Rebuild all dropdown panels with current data */
  populate(): void {
    const runs = State.allRuns;
    this.buildRadioPanel('dd-branch-panel', runs.map(r => r.branch), 'branch', 'dd-branch-label', 'All Branches');
    this.buildRadioPanel('dd-env-panel', runs.map(r => r.env || ''), 'env', 'dd-env-label', 'All Envs');
    this.buildTagsPanel(runs.map(r => r.testType));
    this.buildRadioPanel('dd-project-panel', runs.map(r => r.project), 'project', 'dd-project-label', 'All Projects');

    // Status radio listeners
    document.querySelectorAll<HTMLInputElement>('input[name="filter-status"]').forEach(input => {
      input.addEventListener('change', () => {
        State.filters.status = input.value as typeof State.filters.status;
        DropdownModule.updateSingleLabel('dd-status-label', 'Filter Status', input.value ? (input.value === 'PASS' ? 'Passed' : 'Failed') : '');
        DropdownModule.closeAll({ target: document.body });
        App.updateUI();
      });
    });
  },
};
