/* ══════════════════════════════════════════
   Page navigation (sidebar + bottom nav)
   ══════════════════════════════════════════ */
import { State } from '../../app/state';
import { ChartModule } from '../trends/charts';

export const NavModule = {
  current: 'overview',
  show(page: string): void {
    this.current = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll<HTMLElement>('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    const el = document.getElementById(`page-${page}`);
    if (el) { el.classList.add('active'); el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in'); }
    if (['trends', 'breakdown'].includes(page)) setTimeout(() => ChartModule.renderAll(State.filteredRuns), 50);
  },
};
