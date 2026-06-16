/* ══════════════════════════════════════════
   Entry point — assembles the page from HTML
   partials, loads styles, then boots the app.
   ══════════════════════════════════════════ */
import '../css/index.css';

// Markup partials (imported as raw strings via Vite's ?raw suffix)
import sidebar from '../components/layout/sidebar.html?raw';
import mobileNav from '../components/layout/mobile-nav.html?raw';
import states from '../components/layout/states.html?raw';
import header from '../components/filters/header.html?raw';
import filterSheet from '../components/filters/filter-sheet.html?raw';
import overview from '../components/overview/overview.html?raw';
import trends from '../components/trends/trends.html?raw';
import visuals from '../components/visuals/visuals.html?raw';
import history from '../components/history/history.html?raw';
import reports from '../components/reports/reports.html?raw';
import framework from '../components/framework/framework.html?raw';
import compareModal from '../components/history/compare-modal.html?raw';
import lastRunModal from '../components/overview/last-run-modal.html?raw';

import { App } from './app';

function mountLayout(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app mount point not found');
  root.innerHTML = `
    <div class="layout">
      ${sidebar}
      <div class="main">
        ${header}
        ${filterSheet}
        ${mobileNav}
        ${states}
        <div class="content" id="content">
          ${overview}
          ${trends}
          ${visuals}
          ${history}
          ${reports}
          ${framework}
        </div>
      </div>
    </div>
    ${compareModal}
    ${lastRunModal}
  `;
}

function boot(): void {
  mountLayout();
  void App.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
