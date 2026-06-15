/* ══════════════════════════════════════════
   Daily auto-refresh timer
   ══════════════════════════════════════════ */
import { State } from '../../app/state';
import { App } from '../../app/app';

export const TimerModule = {
  nextMidnightDelay(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return next.getTime() - now.getTime();
  },

  updateLabel(): void {
    const el = document.getElementById('countdown');
    if (!el) return;
    el.textContent = 'Refresh daily at 00:00';
  },

  start(): void {
    if (State.refreshTimer) clearTimeout(State.refreshTimer);
    this.updateLabel();
    State.refreshTimer = setTimeout(() => {
      App.refresh();
    }, this.nextMidnightDelay());
  },
};
