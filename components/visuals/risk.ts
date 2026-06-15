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
    const categories = AnalyticsModule.summarize(runs).categoryCounts.slice(0, 5);
    const total = categories.reduce((sum, item) => sum + item.count, 0);
    sub.textContent = total ? `${total} categorized failure points` : 'No categorized failure data';
    list.innerHTML = categories.length
      ? categories.map(item => `
        <div class="failing-item">
          <div class="failing-rank">${Utils.escape(String(item.count))}</div>
          <div style="flex:1;min-width:0">
            <div class="failing-name">${Utils.escape(item.label)}</div>
            <div class="failing-file">${Math.round(Utils.ratio(item.count, total))}% of categorized failures</div>
          </div>
          <div class="failing-badge">${item.count}x</div>
        </div>`).join('')
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
