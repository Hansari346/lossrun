# Stack Research

**Domain:** Insurance loss run analysis tool (Cloudflare Worker, client-side processing)
**Researched:** 2026-02-12
**Confidence:** HIGH

Current state: a monolithic 3,348-line JavaScript file (`src/worker.js`) serving an inline SPA via template literal. No TypeScript, no build tool, no framework. Client libraries loaded via CDN: SheetJS (xlsx), Chart.js, PptxGenJS. Deployed on Cloudflare Workers with `wrangler deploy`.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why This |
|---|---|---|---|
| **TypeScript** | ~5.7 | Language | Catches column-mapping bugs at compile time. PptxGenJS is 96% TS — you'll get autocomplete on every slide API. SheetJS ships types. Zero runtime cost. |
| **Vite** | ^6.0 | Build / Dev server | Cloudflare's official plugin (`@cloudflare/vite-plugin`) runs your Worker code inside `workerd` during dev — true prod parity with HMR. Replaces the raw `wrangler dev` workflow. Enables code splitting, tree shaking, and serving the SPA as static assets. |
| **@cloudflare/vite-plugin** | ^1.24 | CF Workers integration | GA since April 2025, actively maintained (~weekly releases). Handles Worker entry, static asset serving, bindings, and `vite preview` against real runtime. Eliminates need for a separate asset pipeline. |
| **Preact** | ^10.28 | UI framework | 4 KB gzipped. React-compatible API means huge ecosystem of examples, but 90% smaller. Signals (`@preact/signals`) give you fine-grained reactivity without Redux/Zustand complexity. Perfect for a tool that reacts to file uploads and filter changes. No SSR needed — pure client-side SPA. |
| **Tailwind CSS** | ^4.0 | Styling | v4 is a Vite plugin — zero PostCSS config, zero `tailwind.config.js`. Just `npm install tailwindcss @tailwindcss/vite`, add the plugin, import in CSS, done. Produces only the classes you use. Professional-looking tables/charts/layout without writing custom CSS for every component. |

### Supporting Libraries

| Library | Version | Purpose | Why This |
|---|---|---|---|
| **SheetJS (xlsx)** | 0.20.3 | Excel parsing | Already in the project. 36K GitHub stars, 5M weekly downloads. Handles .xls, .xlsx, .csv, .ods — essential since insurance carriers send every format imaginable. Lightweight (7.5 MB installed) and focused on data extraction, which is the job here. Column-mapping logic will be custom regardless of library choice. Install from CDN tarball: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (npm registry is stuck at 0.18.5). |
| **ECharts** | ^6.0 | Charts / Visualization | **Replaces Chart.js.** Chart.js is fine for simple dashboards but struggles with the complex, data-driven, adaptive charts needed for loss run analysis (loss development triangles, frequency/severity trending, large combined ratio charts). ECharts 6 offers: tree-shakable imports (import only bar/line/pie → ~80-100KB vs 400KB full), axis breaks for loss data with outliers, built-in data zoom/brush for exploring claim history, native SVG+Canvas rendering, chart export to image for PPT embedding. The insurance data viz use case benefits from ECharts' rich interaction model. |
| **PptxGenJS** | ^4.0 | PowerPoint generation | **Keep it.** v4.0.1 (June 2025) is actively maintained with TypeScript-first API, 585K weekly downloads. No real competitor exists for client-side PPTX generation. Supports charts, tables, images, slide masters for branding — exactly what loss run reports need. |
| **@tanstack/table-core** | ^8.0 | Data tables | Headless table logic — sorting, filtering, pagination, column resizing — with zero UI opinions. 15 KB. Works with vanilla JS or Preact. You control the HTML/Tailwind rendering. Perfect for loss run data tables that need to appear in the app, get exported to PPT, and exported to Excel. The headless approach means the same column definitions can drive both the UI table and export logic. |
| **ExcelJS** | ^4.4 | Excel export (writing) | SheetJS is great for *reading* but limited for *writing* formatted output. ExcelJS provides full styling control (fonts, fills, borders, conditional formatting, formulas) needed for professional loss run Excel exports. Use SheetJS to read, ExcelJS to write. |
| **@preact/signals** | ^2.7 | State management | Lightweight reactive state for Preact. Automatically tracks which components depend on which signals — no boilerplate selectors. Perfect for: current file state, parsed data, active filters, chart configuration. |

### Development Tools

| Tool | Version | Purpose | Why This |
|---|---|---|---|
| **Vitest** | ~3.2 | Testing | Cloudflare's official testing integration (`@cloudflare/vitest-pool-workers` v0.12.x) runs tests inside `workerd`. Unit test your column-mapping logic, parser modules, and Worker routes with real runtime behavior. Jest-compatible API, built-in TypeScript, near-instant HMR reruns. Must use ~3.2 (pool-workers doesn't support v4 yet). |
| **@cloudflare/vitest-pool-workers** | ^0.12 | Workers test pool | Provides isolated per-test storage, access to KV/R2/D1 bindings, mocking for outbound requests. Tests match production behavior. |
| **Wrangler** | ^4.64 | CF Workers CLI | Already in the project. Handles deploy, types generation. With Vite plugin, `wrangler dev` is replaced by `vite dev` for the SPA workflow, but `wrangler deploy` remains the deploy path (or `vite build && wrangler deploy`). |
| **Prettier** | ^3.5 | Code formatting | Consistent formatting across the team. Tailwind plugin (`prettier-plugin-tailwindcss`) auto-sorts class names. |
| **ESLint** | ^9.0 | Linting | Flat config format. Use `@typescript-eslint/parser` for TS files. Catches bugs that TypeScript alone misses (unused vars, import order). |

---

## Installation

```bash
# Core build tooling
npm install -D vite @cloudflare/vite-plugin wrangler typescript

# UI framework + state
npm install preact @preact/signals

# Styling
npm install -D tailwindcss @tailwindcss/vite

# Excel parsing (read) — must install from SheetJS CDN, not npm registry
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# Excel export (write)
npm install exceljs

# Charts
npm install echarts

# PowerPoint generation
npm install pptxgenjs

# Data tables
npm install @tanstack/table-core

# Testing
npm install -D vitest@~3.2.0 @cloudflare/vitest-pool-workers

# Code quality
npm install -D prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier-plugin-tailwindcss
```

### Post-install setup

```bash
# Generate TypeScript types for Cloudflare bindings
npx wrangler types

# Initialize TypeScript config
npx tsc --init
```

### Key config files to create

- `vite.config.ts` — Vite + Cloudflare plugin + Tailwind plugin
- `tsconfig.json` — TypeScript configuration (target ESNext, jsx preact)
- `wrangler.jsonc` — Already exists, update `main` to `./src/worker.ts`

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not the Alternative |
|---|---|---|---|
| **Language** | TypeScript | JavaScript (status quo) | The column-mapping and carrier-format code is the most error-prone part of this app. TypeScript catches shape mismatches at compile time. The entire supporting library ecosystem ships TS types. Cost of adoption is near-zero with Vite handling compilation. |
| **Build tool** | Vite | esbuild standalone | esbuild is faster but has no dev server, no HMR, no plugin ecosystem. Cloudflare's official integration is Vite-only. Vite uses esbuild under the hood for transforms anyway. |
| **Build tool** | Vite | Webpack | Slower, more complex config, no official CF plugin. Vite is the clear winner for 2025+ projects. |
| **Charts** | ECharts 6 | Chart.js 4.5 (status quo) | Chart.js is 11KB and great for simple dashboards. But loss run analysis needs: data zoom for exploring 5-year claim history, axis breaks for outlier claims, brushing to select ranges, built-in export to image. Chart.js requires plugins for each of these. ECharts provides them natively with tree-shaking to keep bundle reasonable. |
| **Charts** | ECharts 6 | Plotly.js | Plotly is excellent for scientific viz but its bundle is massive (~3MB), it's React-centric, and the insurance domain doesn't need 3D surfaces or geographic maps. Overkill. |
| **Charts** | ECharts 6 | D3.js | D3 is a low-level toolkit, not a charting library. You'd spend weeks building what ECharts gives you declaratively. Wrong abstraction level for this project. |
| **Excel parsing** | SheetJS | ExcelJS | ExcelJS is better at *writing* formatted Excel but slower at *reading* and less format coverage. SheetJS reads .xls (legacy BIFF), .csv, .ods — carriers still send these. Use both: SheetJS reads, ExcelJS writes. |
| **Excel parsing** | SheetJS | read-excel-file | Read-only, .xlsx only. Too limited for carrier formats that include .xls and .csv. |
| **PPT generation** | PptxGenJS | Officegen | Officegen has 1/30th the downloads, less active maintenance, weaker API for chart/table generation. PptxGenJS dominates this space for good reason. |
| **UI framework** | Preact | React | React is 45KB gzipped vs Preact's 4KB. This app doesn't need React's concurrent features or server components. Preact's API compatibility means you can use React ecosystem docs/examples with `preact/compat`. |
| **UI framework** | Preact | Lit | Lit (5KB) uses Web Components/Shadow DOM, which makes Tailwind CSS integration harder (styles don't penetrate shadow boundaries without workarounds). Preact + Tailwind is a more natural pairing. |
| **UI framework** | Preact | Alpine.js | Alpine (10KB) is great for sprinkling interactivity on server-rendered HTML. It's not designed for building a full SPA with complex state management, component composition, and chart integration. |
| **UI framework** | Preact | Vanilla JS (status quo) | The current 3,348-line monolith demonstrates why vanilla JS doesn't scale. A component model (Preact) lets you break the UI into FileUpload, DataTable, ChartPanel, ExportControls, etc. Signals handle state without a state management library. |
| **CSS** | Tailwind v4 | CSS Modules | CSS Modules provide scoping but you still write all the CSS yourself. Tailwind's utility classes mean the data table, chart container, and export UI look professional immediately. The Tailwind v4 Vite plugin is zero-config. |
| **CSS** | Tailwind v4 | Vanilla CSS (status quo) | Nothing wrong with vanilla CSS, but the refactor is a chance to get consistent spacing, colors, and responsive design for free. Tailwind's utility approach also makes it easy to match PPT slide styling with app UI styling. |
| **Data tables** | TanStack Table | AG Grid | AG Grid Community is 298KB and enterprise features (grouping, Excel export) require a $999+/year license. TanStack Table is 15KB, MIT licensed, and headless — meaning you can render tables with the same Tailwind classes in the app and reuse column definitions for PPT/Excel export. |
| **Testing** | Vitest 3.2 | Jest | Cloudflare's official pool integration is Vitest-only. Jest has no `workerd` runtime support. Vitest is Jest-compatible API anyway, so the migration path is clear. |
| **Testing** | Vitest 3.2 | Vitest 4.x | `@cloudflare/vitest-pool-workers` only supports Vitest 2.0.x–3.2.x as of Feb 2026. Pin to ~3.2.0 until the pool package catches up. |

---

## What NOT to Use

| Technology | Why Not |
|---|---|
| **React** | 10x the size of Preact for zero benefit in this use case. No SSR, no server components, no concurrent rendering needed. |
| **Next.js / Remix / Astro** | Full-stack meta-frameworks that assume server rendering. This is a client-side SPA served by a Worker. Adding SSR complexity for an Excel-processing tool is counterproductive. |
| **Plotly.js** | ~3MB bundle. The insurance domain needs bar/line/pie charts with good interaction, not scientific visualization. |
| **D3.js (as primary)** | Too low-level. You'd build a charting library on top of D3 before you could render a loss ratio trend. Use ECharts which uses Canvas/SVG directly. |
| **AG Grid Enterprise** | $999+/yr per developer. TanStack Table + your own Tailwind-styled rows does everything this tool needs. |
| **Webpack** | No official Cloudflare plugin. Slower builds. More config. Vite is the standard for new CF Workers projects. |
| **Vitest 4.x** | Incompatible with `@cloudflare/vitest-pool-workers` as of Feb 2026. Wait for pool package update. |
| **State management libraries (Redux, Zustand, Jotai)** | Preact Signals handles reactive state natively. This app's state is straightforward: uploaded file → parsed data → filtered view → chart config. No need for external state management. |
| **Sass/Less** | Adding a CSS preprocessor alongside Tailwind is redundant complexity. Tailwind v4's Vite plugin handles everything. |
| **jQuery** | 2026. No. |

---

## Stack Patterns by Variant

### Pattern A: Full Recommended Stack (Best for this refactor)

```
Worker (TypeScript)
├── src/worker.ts              # CF Worker entry — serves SPA + API routes
├── src/client/                # Client-side SPA
│   ├── app.tsx                # Preact root
│   ├── components/            # UI components (FileUpload, DataTable, ChartPanel, etc.)
│   ├── lib/                   # Business logic
│   │   ├── parsers/           # SheetJS parsing + column mapping per carrier
│   │   ├── analysis/          # Loss run calculations, trending, ratios
│   │   ├── charts/            # ECharts configuration builders
│   │   ├── export/            # PptxGenJS + ExcelJS export logic
│   │   └── tables/            # TanStack Table column definitions
│   ├── state/                 # Preact Signals stores
│   └── styles/                # Tailwind entry CSS
├── vite.config.ts
├── tsconfig.json
└── wrangler.jsonc
```

**When to use:** This is the target. Full modularization, type safety, modern tooling.

### Pattern B: Incremental Migration (If you want to phase the refactor)

```
Worker (JavaScript → TypeScript gradually)
├── src/worker.js              # Keep existing worker, minimal changes
├── src/client/
│   ├── index.html             # Extract HTML from template literal
│   ├── main.ts                # New TS entry point
│   ├── legacy/                # Extracted functions from monolith (still JS)
│   └── modern/                # New code in TypeScript + Preact
├── vite.config.ts             # allowJs: true in tsconfig
└── wrangler.jsonc
```

**When to use:** If the monolith is too risky to rewrite in one pass. Vite compiles both JS and TS. Extract modules one at a time, convert to TS as you go.

### Pattern C: Minimal Tooling (If Preact feels like too much)

```
Worker (TypeScript)
├── src/worker.ts
├── src/client/
│   ├── index.html
│   ├── main.ts                # Vanilla TS, no framework
│   ├── components/            # Web Components or plain DOM manipulation
│   └── lib/                   # Same library structure as Pattern A
├── vite.config.ts
└── wrangler.jsonc
```

**When to use:** If the team is uncomfortable with JSX/Preact. You still get TypeScript, Vite, Tailwind, and all the libraries. Just no component framework — manage DOM manually. Works, but harder to maintain as UI grows.

---

## Version Compatibility

This matrix captures the verified compatibility constraints as of Feb 2026.

| Package A | Version | Package B | Version | Compatible | Notes |
|---|---|---|---|---|---|
| @cloudflare/vite-plugin | ^1.24 | Vite | ^6.0 | YES | GA since April 2025. Actively tested together. |
| @cloudflare/vite-plugin | ^1.24 | Wrangler | ^4.64 | YES | Same monorepo (`workers-sdk`), released in lockstep. |
| @cloudflare/vitest-pool-workers | ^0.12 | Vitest | ~3.2.0 | YES | Pool only supports 2.0.x–3.2.x. Pin Vitest to ~3.2.0. |
| @cloudflare/vitest-pool-workers | ^0.12 | Vitest | ^4.0 | NO | Not yet supported. Do not upgrade Vitest past 3.2.x. |
| Tailwind CSS | ^4.0 | @tailwindcss/vite | ^4.0 | YES | v4 Vite plugin is the primary integration path. |
| Tailwind CSS | ^4.0 | Older browsers | — | PARTIAL | Requires Safari 16.4+, Chrome 111+, Firefox 128+. Fine for a business tool. |
| Preact | ^10.28 | @preact/signals | ^2.7 | YES | Signals designed for Preact 10.x. |
| ECharts | ^6.0 | Tree shaking | — | YES | Import from `echarts/core` + specific charts/components. |
| PptxGenJS | ^4.0 | Vite | ^6.0 | YES | v4.0.0 specifically fixed Vite + Web Worker detection issues. |
| SheetJS | 0.20.3 | npm registry | — | CAUTION | Must install from `cdn.sheetjs.com` tarball, not npm (registry stuck at 0.18.5). |

---

## Sources

| Source | Type | Confidence | What It Informed |
|---|---|---|---|
| [Cloudflare Vite Plugin Docs](https://developers.cloudflare.com/workers/vite-plugin/) | Official docs | HIGH | Vite integration, SPA serving, dev workflow |
| [Cloudflare Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) | Official docs | HIGH | Testing strategy, pool-workers version constraints |
| [@cloudflare/vite-plugin npm](https://www.npmjs.com/package/@cloudflare/vite-plugin) | npm registry | HIGH | Version numbers, release cadence |
| [@cloudflare/vitest-pool-workers npm](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers) | npm registry | HIGH | Vitest version compatibility (2.0.x–3.2.x) |
| [PptxGenJS GitHub](https://github.com/gitbrent/PptxGenJS) | GitHub | HIGH | v4.0.1 features, TypeScript codebase, Vite fix |
| [SheetJS Docs](https://docs.sheetjs.com/docs) | Official docs | HIGH | Installation from CDN, format support, API |
| [ECharts 6 Features](https://echarts.apache.org/handbook/en/basics/release-note/v6-feature) | Official docs | HIGH | v6.0 new features, tree shaking approach |
| [ECharts Import Guide](https://echarts.apache.org/handbook/en/basics/import) | Official docs | HIGH | Tree-shakable modular imports |
| [Tailwind CSS v4 Vite Install](https://tailwindcss.com/docs/installation/using-vite) | Official docs | HIGH | v4 zero-config Vite integration |
| [TanStack Table Docs](https://tanstack.com/table/latest/docs/introduction) | Official docs | HIGH | Headless table, vanilla JS support, bundle size |
| [TanStack Table vs AG Grid](https://www.simple-table.com/blog/tanstack-table-vs-ag-grid-comparison) | Comparison article | MEDIUM | Bundle size (15KB vs 298KB), licensing |
| [npm-compare: Chart.js performance](https://chart.pdfmunk.com/blog/charting-libraries-performance-comparison) | Technical comparison | MEDIUM | Chart.js 11KB vs ECharts modular, rendering perf |
| [Preact Signals Docs](https://preactjs.com/guide/v10/signals/) | Official docs | HIGH | Signals API, reactive state model |
| [Vite 8 Beta Announcement](https://vite.dev/blog/announcing-vite8-beta) | Official blog | MEDIUM | Future direction (Rolldown). Not recommending beta — Vite 6 is stable and supported by CF plugin. |
| [npm-compare: ExcelJS vs xlsx](https://npm-compare.com/exceljs,xlsx) | Comparison | MEDIUM | Read vs write strengths, bundle sizes |
