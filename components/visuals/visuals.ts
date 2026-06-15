/* ══════════════════════════════════════════
   Visual Explorer tab switching
   ══════════════════════════════════════════ */
import { State } from '../../app/state';
import { ChartModule } from '../trends/charts';
import { NavModule } from '../layout/nav';

export const VisualsModule = {
  show(section: string): void {
    State.visualSection = section;
    document.querySelectorAll<HTMLElement>('.visual-tab').forEach(tab =>
      tab.classList.toggle('active', tab.dataset.visualSection === section)
    );
    document.querySelectorAll<HTMLElement>('.visual-section').forEach(panel =>
      panel.classList.toggle('active', panel.dataset.visualSection === section)
    );
    if (NavModule.current === 'breakdown') {
      setTimeout(() => ChartModule.renderAll(State.filteredRuns), 50);
    }
  },
};
