# Roadmap: Loss Run Analyzer

**Created:** 2026-02-12
**Phases:** 6
**Requirements:** 28 v1
**Depth:** Standard

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation & Build Infrastructure | Decompose the monolith into modular TypeScript with proper build tooling while preserving all existing functionality | INFRA-01, INFRA-02, INFRA-03 | 4 criteria |
| 2 | Data Ingestion Pipeline | Reliably ingest any carrier's loss run format with transparent validation feedback | INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06 | 5 criteria | 4 plans in 3 waves |
| 3 | Calculation Engine & Dimension Detection | Decouple calculations from the UI and detect which analysis dimensions are available in the data | INFRA-04, INFRA-05, DIM-01, DIM-02, DIM-03 | 4 criteria |
| 4 | Adaptive Visualization & Data Tables | Charts and tables render adaptively based on available data — no empty charts, data tables alongside every chart | VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06 | 5 criteria |
| 5 | PowerPoint Export | Professional Voxel-branded deck with narrative structure that adapts to available data | PPT-01, PPT-02, PPT-03, PPT-04, PPT-05 | 5 criteria |
| 6 | Excel Export | Formatted multi-tab Excel workbook containing all underlying analysis data | XLS-01, XLS-02, XLS-03 | 3 criteria |

## Phase Details

### Phase 1: Foundation & Build Infrastructure

**Goal:** Decompose the monolithic 3,348-line single file into a modular TypeScript codebase with Vite build tooling and centralized state management, while preserving all existing functionality so the tool never goes dark.

**Requirements:** INFRA-01, INFRA-02, INFRA-03

**Depends on:** None — this is the foundation that unblocks everything.

**Success Criteria:**
1. User uploads a file and completes the full wizard flow (Ingestion → Adjustments → Results) with identical behavior to the current production tool
2. Application deploys to Cloudflare Workers and serves correctly at the production URL
3. Source code lives in separate TypeScript files organized by responsibility (parsing, calculations, UI, exports)
4. Application state is managed through a centralized store — business logic does not read from or write to DOM elements

**Plans:** 4 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Build Toolchain & Foundation (config, types, store, CSS extraction)
- [x] 01-02-PLAN.md — Input Pipeline: formatting, field-mapping, parsing libs + nav & upload page
- [x] 01-03-PLAN.md — Output Pipeline: calculations, charts, PPT export libs (parallel with 01-02)
- [x] 01-04-PLAN.md — Adjustments page, results page, app wiring, deploy & verify

**Implementation Notes:**
- Keep `src/worker.js` as a fallback reference until the new code path is fully validated
- Vite + `@cloudflare/vite-plugin` provides HMR, TypeScript, and prod-parity via `workerd`
- Preact + Signals for the UI shell and reactive state
- Tailwind CSS v4 for styling (zero-config Vite plugin)
- Extract HTML/CSS/JS from the template literal into proper source files first, then introduce TypeScript incrementally
- Brownfield guard: deploy and verify the tool works identically before moving to Phase 2

---

### Phase 2: Data Ingestion Pipeline

**Goal:** Reliably ingest any carrier's loss run format — handling variant column names, composite fields, multi-sheet workbooks, and messy data — with transparent validation feedback so users trust the results.

**Requirements:** INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06

**Depends on:** Phase 1 (module structure, TypeScript, state management)

**Success Criteria:**
1. User uploads an AMIC-format file (31 sheets, cause categories) and the tool auto-selects the correct claims sheet and maps columns correctly
2. User uploads a Standard Loss Run file with "Generic Field 1-8" columns and sees extracted dimensions (e.g., "Nature of Injury") available for mapping
3. User sees a validation summary after mapping showing row counts, parse errors, and data quality (e.g., "3 dates unparseable, 2 amounts invalid")
4. Dates and currency amounts parse correctly regardless of format (MM/DD/YYYY, YYYY-MM-DD, SheetJS serial numbers, parenthetical negatives, $$ prefixes) — no silent row drops
5. User can manually override any auto-mapped column assignment

**Plans:** 4 plans in 3 waves

Plans:
- [x] 02-01-PLAN.md — Types, robust date parsing, robust currency parsing (Wave 1)
- [x] 02-02-PLAN.md — Smart sheet analysis, composite field detection, expanded synonym dictionary (Wave 2)
- [x] 02-03-PLAN.md — Validation engine with row-level error accumulation, store signals (Wave 2)
- [x] 02-04-PLAN.md — Integration: parsing pipeline rewrite + upload UI with validation feedback + content-based fallback detection (Wave 3)

**Implementation Notes:**
- This is the highest-risk, highest-value phase — everything downstream depends on correct data
- Use SheetJS `cellDates: true` and explicit format detection — never rely on `new Date(string)`
- Two-pass column mapping: first by header names (fuzzy match with synonym dictionary), then sample cell values in unmapped columns to detect `Key: Value` composite patterns
- Smart sheet selection: scan all sheets, rank by claims-data likelihood (row count, column count, numeric content, header patterns)
- Build robust `parseDate()` and `parseCurrency()` functions that report failures instead of silently dropping
- Test against real AMIC, Standard Loss Run, and DV/Sedgwick format files
- Brownfield guard: existing upload and basic mapping still works; new capabilities are additive

---

### Phase 3: Calculation Engine & Dimension Detection

**Goal:** Calculations run as pure logic detached from the UI, producing a shared Results Object. The system auto-detects which analysis dimensions (cause, body part, department, etc.) are available in the uploaded data, enabling all downstream features to adapt.

**Requirements:** INFRA-04, INFRA-05, DIM-01, DIM-02, DIM-03

**Depends on:** Phase 2 (canonical data schema with parsed/validated data)

**Success Criteria:**
1. Changing an adjustment slider or filter recalculates results instantly without page flicker or full re-render
2. User sees a "Detected Dimensions" panel showing which analyses are available (e.g., "Cause of Loss: ✓, Department: ✓, Body Part: ✗, Lost Time: ✗")
3. User can confirm or override detected dimensions before proceeding to results
4. All charts, tables, and exports consume the same Results Object — no inconsistencies between what's shown on screen and what's exported

**Implementation Notes:**
- The calculation engine must be pure functions: accept canonical data + adjustments → return Results Object
- Results Object contains all computed metrics, breakdowns, trend data, and projections
- Dimension detection runs after column mapping: inspect which canonical fields have data, flag them as available
- DIM-02 (dimension availability drives downstream) is the architectural keystone — this is what makes visualization and export adaptive
- Preact Signals for reactive recalculation when inputs change
- Brownfield guard: existing calculations (TRIR, payback, projections) preserved; dimension detection is additive

---

### Phase 4: Adaptive Visualization & Data Tables

**Goal:** Charts and data tables render adaptively based on what data is actually available — no empty charts, no broken visualizations, a data table alongside every chart, and new analysis dimensions (department, lost time) when the data supports them.

**Requirements:** VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06

**Depends on:** Phase 3 (Results Object, dimension detection)

**Success Criteria:**
1. Results page shows only charts that have data to support them — no empty or placeholder chart sections appear
2. Every chart has a data table below it showing the exact underlying values
3. When department or location data is available, a department/location breakdown chart appears automatically
4. When lost time or restricted days data is available, a lost time analysis chart appears automatically
5. All existing chart types (loss trend, category breakdown, cost comparison, projections, TRIR, payback, site comparison, observation cost) still render when their data is present

**Implementation Notes:**
- Chart registry pattern: each chart type declares its data requirements; registry conditionally renders only charts whose requirements are met by the Results Object
- ECharts replaces Chart.js — tree-shakable, built-in data zoom, native `getDataURL()` for PPT export
- TanStack Table (headless) for data tables — same column definitions drive UI display and export
- Build one chart end-to-end first (loss trend line) to validate the ECharts + Preact integration, then apply the pattern
- Voxel brand colors and professional styling applied via shared theme config
- Brownfield guard: all 8 existing chart types must render correctly; new charts (department, lost time) are additive

---

### Phase 5: PowerPoint Export

**Goal:** The exported PowerPoint deck is a professional, Voxel-branded deliverable with a narrative arc that adapts to the available data — slides only appear when backed by data, charts are crisp, and the deck tells a story.

**Requirements:** PPT-01, PPT-02, PPT-03, PPT-04, PPT-05

**Depends on:** Phase 4 (chart rendering for export, data tables)

**Success Criteria:**
1. Exported deck follows the narrative arc: Title → Executive Summary → Loss Trend → Category Deep Dives → Voxel Impact → ROI Summary
2. Slides only appear when backed by data — no blank slides or slides with missing charts
3. Charts in the deck are crisp at presentation resolution (no blurry or pixelated images)
4. Data tables appear in the deck (appendix or alongside charts) with readable formatting
5. Deck uses Voxel branding (colors, logo, typography) consistently across all slides

**Implementation Notes:**
- PptxGenJS v4 (TypeScript-first) for deck generation
- Per-slide builder pattern: each slide type is a function that receives the Results Object slice and returns slide content
- Conditional slide inclusion driven by DIM-02 (dimension availability) — same logic that drives chart visibility
- High-resolution chart export: set `devicePixelRatio: 3-4` before ECharts `getDataURL()`, or evaluate PptxGenJS native `addChart()` for vector-based rendering
- Narrative structure codified as an ordered slide manifest with conditional gates
- Brownfield guard: existing PPT export still works; new export is a complete replacement (not incremental patches to old code)
- This is fiddly work — budget time for layout polish and testing with actual projectors

---

### Phase 6: Excel Export

**Goal:** Users can export all underlying analysis data as a formatted, multi-tab Excel workbook for further analysis, record-keeping, or sharing with stakeholders who want the numbers behind the deck.

**Requirements:** XLS-01, XLS-02, XLS-03

**Depends on:** Phase 4 (data tables define the export content), Phase 3 (Results Object provides the data)

**Note:** Phase 6 has no dependency on Phase 5. With parallelization enabled, Phase 6 can begin as soon as Phase 4 completes, running concurrently with Phase 5.

**Success Criteria:**
1. User clicks "Export to Excel" and receives a `.xlsx` file with multiple named tabs
2. Workbook includes a Summary tab, individual tabs for each chart's underlying data, and a tab with the full raw mapped data
3. Tabs have formatted headers, appropriate column widths, and proper number/currency formatting

**Implementation Notes:**
- ExcelJS for write-side (SheetJS is read-side) — ExcelJS provides richer formatting control for output
- Tab structure mirrors the chart registry: one tab per active chart's data table, plus Summary and Raw Data
- Column definitions shared with TanStack Table from Phase 4 — same data, different renderer
- Number formatting should match the web app display (currency symbols, decimal places, percentages)
- Brownfield guard: this is a net-new feature (no existing Excel export to break)

---

## Dependency Graph

```
Phase 1: Foundation
    ↓
Phase 2: Data Ingestion
    ↓
Phase 3: Calculation Engine & Dimensions
    ↓
Phase 4: Adaptive Visualization
   ↓ ↘
Phase 5: PPT Export   Phase 6: Excel Export
(can run in parallel)
```

## Coverage

| Requirement | Phase |
|-------------|-------|
| INFRA-01 | Phase 1 |
| INFRA-02 | Phase 1 |
| INFRA-03 | Phase 1 |
| INGEST-01 | Phase 2 |
| INGEST-02 | Phase 2 |
| INGEST-03 | Phase 2 |
| INGEST-04 | Phase 2 |
| INGEST-05 | Phase 2 |
| INGEST-06 | Phase 2 |
| INFRA-04 | Phase 3 |
| INFRA-05 | Phase 3 |
| DIM-01 | Phase 3 |
| DIM-02 | Phase 3 |
| DIM-03 | Phase 3 |
| VIS-01 | Phase 4 |
| VIS-02 | Phase 4 |
| VIS-03 | Phase 4 |
| VIS-04 | Phase 4 |
| VIS-05 | Phase 4 |
| VIS-06 | Phase 4 |
| PPT-01 | Phase 5 |
| PPT-02 | Phase 5 |
| PPT-03 | Phase 5 |
| PPT-04 | Phase 5 |
| PPT-05 | Phase 5 |
| XLS-01 | Phase 6 |
| XLS-02 | Phase 6 |
| XLS-03 | Phase 6 |

**Mapped:** 28/28 ✓
**Orphaned:** 0

---
*Roadmap created: 2026-02-12*
