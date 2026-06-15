# orangehrm-test-pulse

Frontend analytics dashboard for OrangeHRM Playwright test results, sourced from
a public S3 / Cloudflare R2 bucket. Built with **TypeScript** and **Vite** — no
UI framework, just typed ES modules, HTML partials, and modular CSS.

## Getting started

```bash
npm install      # install dependencies (once)
npm run dev      # start the dev server with HMR  → http://localhost:5173
npm run build    # type-check + produce a static bundle in dist/
npm run preview  # serve the production build locally
npm run typecheck # type-check only (no emit)
```

> The dashboard is no longer a single static file you open directly — it is
> compiled by Vite. Use `npm run dev` while developing and `npm run build` for a
> deployable `dist/`.

## Project structure

```text
index.html                 Thin shell — mounts #app and loads /app/main.ts
app/
  main.ts                  Entry: assembles HTML partials, boots the app
  app.ts                   App controller (wiring, refresh, render loop)
  state.ts                 Shared application state
  config.ts                Constants (data URL, chart theme, PDF palette)
  types.ts                 Shared domain types (Run, Filters, RunSummary, …)
  core/                    Framework-free logic
    utils.ts  analytics.ts  data.ts  mock-data.ts  filters.ts
components/                Feature modules (one folder per area)
  layout/                  Sidebar, mobile drawer/sheet, daily refresh timer
  filters/                 Header filter dropdowns + markup
  overview/                Executive hero, last-run panel, summary cards
  trends/                  Chart.js rendering
  visuals/                 Visual explorer, breakdowns, top-failing, risk
  history/                 Run table, comparison, CSV export
  reports/                 PDF report builder + per-section PNG export
css/
  index.css                Imports every stylesheet in cascade order
  global.css               Design tokens, reset, shared primitives
  layout/filters/overview/trends/visuals/history/reports/modals.css
  responsive.css           Tablet / mobile / desktop overrides
```

Each feature folder pairs its `*.ts` logic with a `*.html` partial that
`main.ts` imports (via Vite's `?raw`) and composes into the page at runtime.

## Data source

Live results are fetched from the R2 bucket configured in `app/config.ts`
(`DATA_URL`). If the fetch fails (e.g. CORS), the app falls back to a generated
mock dataset and shows a demo-mode banner.
