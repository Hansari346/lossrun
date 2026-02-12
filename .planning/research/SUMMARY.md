# Project Research Summary

**Project:** Loss Run Analyzer
**Domain:** Insurance loss run analysis tool (client-side SPA on Cloudflare Workers)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

The Loss Run Analyzer is a brownfield refactor of an existing, working 3,348-line monolithic Cloudflare Worker that ingests insurance carrier loss run spreadsheets and produces branded analytical outputs for Voxel's sales and customer success teams. Experts build tools like this as **layered data pipelines** — ingestion, normalization, calculation, visualization, export — with each layer isolated and testable. The recommended approach is a modern Vite + TypeScript + Preact stack deployed on Cloudflare Workers, replacing the current inline template literal architecture with proper module separation while keeping all processing client-side for data privacy. ECharts replaces Chart.js for richer adaptive visualization, and a chart registry pattern makes the entire output layer data-driven rather than hardcoded.

The critical insight across all research is that **dimension detection is the architectural keystone**. Every downstream decision — which charts render, which PPT slides appear, which data tables display — flows from knowing what data dimensions are actually present in the uploaded file. The current tool treats all 11 charts as static; the refactored tool must treat charts as conditional on data availability. This single change eliminates the most common user complaint (empty/broken charts) and enables the most impactful differentiator (adaptive visualization).

The highest-risk area is data ingestion. Date parsing with `new Date()` silently produces off-by-one errors across timezones. Currency parsing silently drops rows with `$$` prefixes or parenthetical negatives. Header detection misfires on HIPAA disclaimers. Composite fields in "Generic Field 1-8" columns are invisible to header-based mapping. These bugs exist in production today and corrupt analysis results. The refactor must fix ingestion **first**, before any UI or visualization work, because every downstream feature depends on correct, complete data.

## Key Findings

### Recommended Stack

The stack modernizes the build and UI layer while keeping the deployment model (Cloudflare Workers) and core libraries (SheetJS, PptxGenJS) intact. TypeScript is the highest-value addition — the column-mapping and carrier-format code is the most error-prone part of the app, and TS catches shape mismatches at compile time. Vite with `@cloudflare/vite-plugin` provides true prod parity via `workerd` during dev, replacing the raw `wrangler dev` workflow.

**Core technologies:**
- **Vite 6 + @cloudflare/vite-plugin**: Build tooling — official CF integration with HMR, code splitting, static asset serving
- **TypeScript ~5.7**: Language — catches column-mapping bugs at compile time; all libraries ship types
- **Preact 10 + @preact/signals**: UI framework — 4KB gzipped, React-compatible API, fine-grained reactivity for filter/chart state
- **Tailwind CSS v4**: Styling — zero-config Vite plugin, utility classes for professional tables/charts/layout
- **ECharts 6**: Visualization — replaces Chart.js; tree-shakable, built-in data zoom/brush, native image export for PPT
- **SheetJS 0.20.3 + ExcelJS 4.4**: Excel I/O — SheetJS reads all formats (.xls, .xlsx, .csv), ExcelJS writes formatted exports
- **PptxGenJS 4.0**: PowerPoint generation — kept; v4 is TypeScript-first with Vite compatibility fixes
- **@tanstack/table-core**: Data tables — 15KB headless table logic; same column definitions drive UI and export
- **Vitest ~3.2 + @cloudflare/vitest-pool-workers**: Testing — runs inside `workerd` for prod-parity unit tests

**Critical version constraint:** Vitest must be pinned to ~3.2.0 — `@cloudflare/vitest-pool-workers` does not yet support Vitest 4.x.

### Expected Features

**Must have (table stakes — users expect these):**
- Multi-format Excel parsing (.xlsx, .xls, .csv) with header row auto-detection
- Fuzzy column matching with synonym dictionary and manual override
- Generic/composite field parsing (extract "Nature of Injury: Contusion" from "Generic Field 1")
- Multi-sheet workbook handling with smart sheet selection
- Data preview before proceeding + validation with clear error messages
- Loss frequency, severity, trend, and category breakdown analysis
- Open vs. closed claim distinction with paid + reserves math
- Current vs. improved comparison (Prospect and Customer modes)
- Data table alongside every chart showing exact values
- Branded PowerPoint export with narrative structure

**Should have (differentiators):**
- Dimension-aware chart registry — charts auto-appear/hide based on available data dimensions
- Carrier format fingerprinting — auto-detect known carrier formats and apply preset mappings
- Data quality scorecard — show parse results, skipped rows, and quality metrics
- Narrative annotations on charts — auto-generated callouts ("Largest category: Sprains, 34%")
- Department/location breakdown, severity tiering, lost time analysis
- Excel data export with multi-tab formatted workbook

**Defer (v2+):**
- Carrier fingerprint persistence and mapping template save/reuse
- Time-of-day heatmap, tenure analysis, litigation analysis (enable when data available, simple bar charts first)
- Interactive chart filtering / drill-down
- Assumption scenario comparison (side-by-side Conservative vs. Aggressive)
- PDF export, per-chart PNG export, shareable URLs

**Explicitly NOT building:** AI/LLM column mapping, server-side processing, actuarial models, user accounts, mobile layout, real-time carrier API integrations.

### Architecture Approach

The refactored architecture follows a **layered pipeline** where each layer is a pure-function module with no DOM dependencies. Data flows down through the pipeline; events flow up via a lightweight pub/sub bus. The canonical data schema is the single source of truth — carrier data is normalized into this schema immediately after ingestion, and every downstream module (calculations, charts, tables, export) consumes the same shape. The chart registry pattern replaces the current 500-line `drawCharts()` god function with self-contained chart renderers that declare their data requirements and are conditionally rendered by the registry.

**Major components:**
1. **Ingestion layer** — SheetJS parsing, header detection, sheet selection, sample extraction
2. **Column mapping engine** — multi-signal scored matching (header names, data types, composite content), manual override
3. **Canonical transform** — normalize raw rows into canonical schema; detect available dimensions
4. **Calculation engine** — produces a single Results Object consumed by all downstream layers (no DOM reading)
5. **Chart registry** — declares chart types with data requirements; renders only charts whose requirements are met
6. **Data table renderer** — headless table logic (TanStack Table) paired with each chart
7. **Export layer** — PPT (per-slide builders) and Excel (multi-tab workbook) consuming the Results Object
8. **UI shell** — Preact components for wizard flow, mapping UI, adjustments, results display

**Build approach:** Start with Vite + @cloudflare/vite-plugin serving the SPA as static assets. Worker entry becomes thin (routing + headers only). This is the smallest viable delta from the current architecture that unlocks proper module imports, TypeScript, and HMR.

### Critical Pitfalls

1. **Date parsing minefield** — `new Date('2024-05-28')` parses as UTC (off-by-one day in US timezones); `new Date('28/05/2024')` is Invalid Date. Use SheetJS `cellDates: true` and explicit format detection. Never rely on `new Date(string)` for ambiguous formats.

2. **Currency parsing silently drops rows** — Current regex only strips `$` and commas. `$$12,345`, `($1,234.56)` (accounting negatives), and European decimals all produce NaN and rows are silently discarded. Build a robust `parseCurrency()` function and report skipped rows to users.

3. **Composite field blindness** — "Generic Field 1" columns contain structured data like "Nature of Injury: Contusion" that header-based matching can never detect. Requires a two-pass strategy: first match by headers, then sample cell values in remaining columns to detect `Key: Value` patterns.

4. **Blurry PPT charts** — Canvas-to-image export at 1x DPI produces pixelated charts when embedded in 10" PPT slides. Set `devicePixelRatio: 3-4` before export, or use PptxGenJS native `addChart()` for vector-based resolution-independent charts.

5. **Wrong sheet auto-selection** — First sheet is often a cover page or HIPAA notice. Auto-scan all sheets and rank by likelihood of containing claims data (row count, column count, numeric content, header-like rows).

6. **Global state and DOM-coupled logic** — 5 global mutable variables and business logic that reads from DOM elements must be resolved before module extraction, or the refactor creates worse coupling than the monolith.

## Implications for Roadmap

This is a brownfield refactor. The existing tool works and is deployed. Each phase must deliver incremental improvement without breaking what's currently functional. The phase structure follows the dependency chain discovered in research: architecture foundations → data layer → visualization layer → export layer.

### Phase 1: Foundation & Build Infrastructure

**Rationale:** Nothing else can happen safely until the monolith is cracked open. Global state, DOM coupling, and the template-literal architecture must be addressed first. This phase creates the scaffolding that all subsequent phases build on.
**Delivers:** Vite build pipeline, TypeScript configuration, Preact shell, module boundaries, state management via Signals, static asset serving, existing functionality preserved.
**Addresses:** TD-1 (global state), TD-2 (DOM-coupled logic), TD-4 (error boundaries), PT-4 (Worker script size), UX-4 (navigation guards).
**Key risk:** Breaking the existing working tool during extraction. Mitigate by keeping the current worker.js as fallback and using the Vite dev server for the new code path.

### Phase 2: Data Ingestion & Column Mapping

**Rationale:** Everything downstream depends on correct, complete data. The current parsing has silent data loss bugs (currency, dates) and can't handle the most common carrier formats (Generic Fields, multi-sheet). This is the highest-risk, highest-value phase.
**Delivers:** Robust Excel parsing with `cellDates: true`, multi-signal column mapping engine, composite field detection, smart sheet selection, data validation with user-facing quality report, canonical data schema.
**Addresses:** P1 (date parsing), P2 (currency parsing), P3 (date system mismatch), P4 (composite fields), P6 (sheet selection), P7 (header detection), UX-1 (opaque errors), UX-2 (dropdown overload).
**Key risk:** Composite field detection is high-complexity. Start with the known `Key: Value` pattern and iterate.

### Phase 3: Calculation Engine & Data Store

**Rationale:** Decoupling calculations from DOM rendering is a prerequisite for both the chart registry (Phase 4) and export layer (Phase 5). The Results Object pattern eliminates the current anti-pattern of reading calculated values back from DOM elements.
**Delivers:** Pure-function calculation engine returning a comprehensive Results Object, dimension detection, reactive data store via Preact Signals, debounced recalculation.
**Addresses:** TD-2 (DOM-as-data-store anti-pattern), PT-2 (recalc on every input), calculation correctness for open/closed claims, annualization edge cases.

### Phase 4: Adaptive Visualization & Data Tables

**Rationale:** With clean data (Phase 2) and a proper Results Object (Phase 3), the chart layer can be rebuilt using the registry pattern. This is the most user-visible improvement — charts become adaptive, data tables appear alongside every chart, and empty/broken chart sections disappear.
**Delivers:** ECharts integration, chart registry with conditional rendering, data tables (TanStack Table) alongside each chart, Voxel-branded theme, interactive filtering basics.
**Addresses:** Dimension-aware chart registry (P0 feature), data tables alongside charts (P0 feature), TD-3 (chart copy-paste), UX-3 (empty charts), PT-2 (chart instance reuse).
**Key risk:** ECharts is a new library for this project. Mitigate by building one chart type end-to-end first (loss trend line), then applying the pattern to others.

### Phase 5: Professional Export

**Rationale:** The PPT deck is the primary deliverable. With the chart registry and Results Object in place, the export layer can generate adaptive, narrative-structured decks where slides are conditionally included based on data availability.
**Delivers:** Narrative-structured PPT (Title → Summary → Trend → Categories → Impact → Appendix), high-resolution chart embedding, conditional slide inclusion, Excel data export, export summary showing included/excluded slides.
**Addresses:** P5 (blurry charts), UX-5 (silent PPT gaps), professional branded output (P0 feature), Excel export (P2 feature).
**Key risk:** PPT formatting is fiddly and time-consuming. Budget extra time for layout polish. Consider PptxGenJS native charts for resolution independence.

### Phase 6: Polish & Differentiators

**Rationale:** With core functionality solid, this phase adds the features that create "wow" moments: narrative annotations, carrier fingerprinting, data quality scorecards, and richer analysis dimensions (department breakdown, severity tiering, lost time).
**Delivers:** Narrative annotations on charts, carrier format fingerprinting, mapping template save/reuse (localStorage), data quality scorecard, department breakdown, severity tiering, lost time/restricted days analysis.
**Addresses:** P1 features (validation, annotations, client branding, department breakdown, severity tiering), P2 features (fingerprinting, template save).

### Phase Ordering Rationale

- **Phase 1 before anything:** The template-literal monolith cannot be safely extended. Module extraction requires solving global state and DOM coupling first. Every subsequent phase benefits from TypeScript, Vite HMR, and proper imports.
- **Phase 2 immediately after:** Data ingestion is the foundation. A chart registry built on broken parsing is still broken. The most urgent bugs (silent row dropping, date errors) live here.
- **Phase 3 before Phase 4:** The chart registry needs a Results Object to consume. Building charts that read from DOM would recreate the current anti-pattern.
- **Phase 4 before Phase 5:** Export needs chart images/data. The chart system must be stable before export can reference it.
- **Phase 5 before Phase 6:** Core export must work before adding polish features. Users need a working PPT before they need narrative annotations.
- **Brownfield guard:** Each phase produces a deployable state that is strictly better than the previous. No phase requires "go dark" periods where the tool regresses.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Data Ingestion):** Composite field detection patterns are domain-specific. Research real carrier file samples to build the `Key: Value` pattern library. SheetJS `cellDates` behavior with edge-case carrier exports needs hands-on testing.
- **Phase 4 (Visualization):** ECharts 6 tree-shaking configuration and Preact integration specifics. Chart-to-image export workflow for PPT embedding differs from Chart.js. Research ECharts `getDataURL()` vs canvas capture.
- **Phase 5 (Export):** PptxGenJS native `addChart()` API for vector charts vs. image embedding. Slide layout dimensions and positioning for professional output. Need to test with actual projectors/screens.

Phases with standard patterns (skip deep research):
- **Phase 1 (Foundation):** Vite + @cloudflare/vite-plugin + Preact is thoroughly documented. Follow the official Cloudflare Vite plugin getting-started guide.
- **Phase 3 (Calculation Engine):** Pure function extraction with typed interfaces. Standard refactoring pattern — no external dependencies to research.
- **Phase 6 (Polish):** Features here are incremental additions to established patterns from earlier phases.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs, version compatibility confirmed, Cloudflare Vite plugin is GA and actively maintained |
| Features | HIGH | Domain well-understood from PROJECT.md context, competitor analysis (Cognisure, Gradient AI), and OSHA/NCCI standards. Feature gaps identified from direct codebase audit |
| Architecture | HIGH | Patterns verified against current Cloudflare docs, codebase audited (3,348 lines), layered pipeline and chart registry are established patterns in data visualization tools |
| Pitfalls | HIGH | All critical pitfalls verified via direct codebase inspection + library documentation. Date parsing and currency bugs are confirmed present in production code |

**Overall confidence:** HIGH

### Gaps to Address

- **Real carrier file testing:** Research identifies composite field patterns theoretically, but the `Key: Value` detection needs validation against actual AMIC, Standard Loss Run, and DV/Sedgwick files. Plan hands-on testing in Phase 2.
- **ECharts bundle size in practice:** Tree-shaking claims need verification. Import only bar/line/pie and measure actual bundle — the 80-100KB estimate needs confirmation.
- **PptxGenJS native charts vs. images:** The recommendation to consider native charts for resolution independence needs prototyping. Native PPT charts are editable but may not match the visual styling achievable with rendered ECharts. Test both approaches in Phase 5 planning.
- **Vitest pool-workers compatibility window:** Pinned to ~3.2.0 due to pool package constraints. Monitor `@cloudflare/vitest-pool-workers` releases for Vitest 4.x support.
- **Preact + ECharts integration:** No established pattern for this pairing. May need a thin wrapper component. Prototype in Phase 4 planning.

## Sources

### Primary (HIGH confidence)
- [Cloudflare Vite Plugin Docs](https://developers.cloudflare.com/workers/vite-plugin/) — build tooling, SPA serving, dev workflow
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) — asset serving architecture
- [Cloudflare Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) — testing strategy, version constraints
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits) — bundle size, memory, CPU limits
- [SheetJS Docs](https://docs.sheetjs.com/docs) — installation, date handling, parse options
- [ECharts 6 Features](https://echarts.apache.org/handbook/en/basics/release-note/v6-feature) — v6 capabilities, tree shaking
- [PptxGenJS GitHub](https://github.com/gitbrent/PptxGenJS) — v4.0.1 TypeScript API, chart/image support
- [TanStack Table Docs](https://tanstack.com/table/latest/docs/introduction) — headless table API
- [Tailwind CSS v4 Vite Install](https://tailwindcss.com/docs/installation/using-vite) — zero-config setup
- [Preact Signals Docs](https://preactjs.com/guide/v10/signals/) — reactive state model
- Current codebase (`src/worker.js`, 3,348 lines) — all architecture patterns and pitfalls derived from direct code audit

### Secondary (MEDIUM confidence)
- [Cognisure Loss 360](https://cognisure.ai/products/loss-360) — competitor feature analysis, 40-point data model
- [Gradient AI Research](https://gradientai.com) — litigated claims cost data, industry benchmarks
- OSHA/NCCI — EMR methodology, TRIR/DART standards
- [Xceedance](https://xceedance.com) — loss run processing challenges, lack of standardization
- npm-compare: ECharts vs Chart.js, ExcelJS vs xlsx — bundle sizes, feature comparisons
- Stack Overflow — Chart.js export quality, JavaScript date parsing threads

### Tertiary (needs validation)
- ECharts tree-shaking actual bundle size (80-100KB estimate) — needs hands-on measurement
- PptxGenJS native chart styling parity with ECharts rendered output — needs prototyping
- Preact + ECharts integration patterns — no established community pattern found

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
