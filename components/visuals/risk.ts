/* ══════════════════════════════════════════
   Failure categories + module hotspots
   ══════════════════════════════════════════ */
import type { Run } from '../../app/types';
import { Utils } from '../../app/core/utils';
import { AnalyticsModule } from '../../app/core/analytics';

export const RiskModule = {
  renderCategoryList(runs: Run[]): void {
    const sub = document.getElementById('failure-categories-sub');
    const list = document.getElementById('failure-categories-list');
    if (!sub || !list) return;
    const groups = AnalyticsModule.summarize(runs).failureGroups;
    const total = groups.reduce((sum, g) => sum + g.count, 0);
    // Expand each area into one row per failure type ("UI → Timeout", "UI → Assertion"),
    // plus a bare-area row for failures whose feed carried no error message to judge.
    const rows = groups.flatMap(g => {
      const typed = g.types.map(t => ({ area: g.area, type: t.label, count: t.count }));
      const untyped = g.count - g.types.reduce((sum, t) => sum + t.count, 0);
      return untyped > 0 ? [...typed, { area: g.area, type: null as string | null, count: untyped }] : typed;
    }).sort((a, b) => b.count - a.count).slice(0, 6);

    sub.textContent = total ? `${total} categorized failure points` : 'No categorized failure data';
    list.innerHTML = rows.length
      ? rows.map(r => {
          const typeTag = r.type
            ? ` <span style="color:var(--text-3);font-weight:500">→ ${Utils.escape(r.type)}</span>`
            : '';
          const detail = r.type
            ? `${Math.round(Utils.ratio(r.count, total))}% of failures`
            : `${Math.round(Utils.ratio(r.count, total))}% of failures · cause not captured`;
          return `
        <div class="failing-item">
          <div class="failing-rank">${Utils.escape(String(r.count))}</div>
          <div style="flex:1;min-width:0">
            <div class="failing-name">${Utils.escape(r.area)}${typeTag}</div>
            <div class="failing-file">${detail}</div>
          </div>
          <div class="failing-badge">${r.count}x</div>
        </div>`;
        }).join('')
      : `<div class="failing-empty">No failure categories found for the selected runs</div>`;
  },

  renderModules(runs: Run[]): void {
    const sub = document.getElementById('top-modules-sub');
    const list = document.getElementById('top-modules-list');
    if (!sub || !list) return;
    const modules = AnalyticsModule.summarize(runs).moduleCounts.slice(0, 6);
    const total = modules.reduce((sum, item) => sum + item.count, 0);
    sub.textContent = total ? `${modules.length} modules with repeated failures` : 'No module hotspots';
    list.innerHTML = modules.length
      ? modules.map((item, i) => `
        <div class="failing-item">
          <div class="failing-rank ${i < 2 ? 'hot' : ''}">${i + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="failing-name">${Utils.escape(item.label)}</div>
            <div class="failing-file">${Math.round(Utils.ratio(item.count, total))}% of module-linked failures</div>
          </div>
          <div class="failing-badge">${item.count}x</div>
        </div>`).join('')
      : `<div class="failing-empty">No module-level hotspots found for the selected runs</div>`;
  },
};
