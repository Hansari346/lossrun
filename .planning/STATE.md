# Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-12)
**Core value:** Reliably ingest any carrier's loss run format and produce compelling analysis
**Current focus:** Phase 1 complete — ready for Phase 2

## Phase Status

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1 — Foundation & Build Infrastructure | Complete | 2026-02-12 | 2026-02-12 |
| 2 — Data Ingestion Pipeline | Complete | 2026-02-12 | 2026-02-12 |
| 3 — Calculation Engine & Dimension Detection | Not Started | — | — |
| 4 — Adaptive Visualization & Data Tables | Not Started | — | — |
| 5 — PowerPoint Export | Not Started | — | — |
| 6 — Excel Export | Not Started | — | — |

## Current Position

Phase: 2 of 6 (Data Ingestion Pipeline) — COMPLETE, ready for Phase 3
Plan: 4 of 4 in phase 2 (all complete)
Status: Phase 2 complete, pending verification
Last activity: 2026-02-12 - Completed 02-04-PLAN.md (integration + content-based fallback detection)

Progress: ████████████░░ 12/14 plans (~86% through Phase 2 of 6 total)

## Accumulated Context

### Key Decisions
- 2026-02-12: 6-phase roadmap derived from 28 requirements following the dependency chain: Foundation → Data → Calculations → Visualization → Export
- 2026-02-12: INFRA-04/05 grouped with DIM-01/02/03 in Phase 3 (calculation engine produces the Results Object, dimension detection determines what's in it)
- 2026-02-12: Phase 5 (PPT) and Phase 6 (Excel) can run in parallel — both depend on Phase 4, not on each other
- 2026-02-12: Plugin order preact() → tailwindcss() → cloudflare() — framework plugins before platform plugin
- 2026-02-12: CDN scripts kept temporarily — will npm-install in later phases
- 2026-02-12: Signal store pattern: one signal per state slice, computed for derived state
- 2026-02-12: findBestMatch returns { index, score } for index-based UI mapping
- 2026-02-12: Lib modules are pure functions + signal store imports, zero DOM access
- 2026-02-12: AdjustmentParams expanded to 24 fields; CalculationResults carries full KPI + payback + breakdowns
- 2026-02-12: Preset values match monolith's actual applyPreset() (conservative=45/55, balanced=65/81, aggressive=80/90)
- 2026-02-12: drawCharts receives filteredData + allData + canvas refs + params — fully DOM-free
- 2026-02-12: indirectMult default=1.3, headcount default=150 (matching monolith)
- 2026-02-12: populateAdjustmentsFromData sets avgCost and injuries from 2-3 year average of ingested data
- 2026-02-12: ParseResult<T> as universal return type for all parsing functions (value+error+raw, never silent null)
- 2026-02-12: Never use new Date(string) for numeric date formats — regex extraction is deterministic
- 2026-02-12: European currency format detected by comma-before-2-digits heuristic
- 2026-02-12: Lotus 1-2-3 bug correction in Excel serial → Date conversion
- 2026-02-12: Sheet scoring uses additive points — transparent reasons array for debugging
- 2026-02-12: Composite field minKeyFrequency=3 to avoid false positives from one-off Key:Value patterns
- 2026-02-12: Removed bare "type" from claim_category hints — too generic, false-matches "Type" columns
- 2026-02-12: Column-index lookup pattern: row[headers[mappings[fieldKey]]] bridges SheetJS header keys with index-based mappings
- 2026-02-12: Composite overrides passed as Record<string,string> to keep validation decoupled from composite-fields
- 2026-02-12: Optional field parse failures produce warnings but don't skip rows
- 2026-02-12: Error categorization by field name substring matching (date/incurred/amount)
- 2026-02-12: Content-based detection scores capped at 25-45 (below header threshold of 50) so header matches always win
- 2026-02-12: Detection priority order prevents two fields claiming the same column
- 2026-02-12: Domain keyword Sets (body parts, causes, categories) for content-based field detection — extensible for new carriers

### Blockers
None

### TODOs
None

## Session Continuity

Last session: 2026-02-12
Stopped at: Phase 2 complete, ready for verification then Phase 3
Resume file: None

## Session Log
- 2026-02-12: Project initialized, requirements defined (28 v1), research completed, roadmap created (6 phases)
- 2026-02-12: Executed 01-01 — Vite build pipeline, TypeScript config, signal store, domain types, CSS extraction
- 2026-02-12: Executed 01-02 — Formatting, field-mapping, parsing libs + nav & upload page components
- 2026-02-12: Executed 01-03 — Calculation engine, 11 Chart.js charts, PPT export — all as pure typed modules
- 2026-02-12: Executed 01-04 — Adjustments page, results page, app wiring, deploy, human verification
- 2026-02-12: Phase 1 verified — 14/14 must-haves passed, INFRA-01/02/03 marked complete
- 2026-02-12: Executed 02-01 — ParseResult<T> types, date-utils (6 format parsers + Excel serial), currency-utils (parens/European/$$)
- 2026-02-12: Executed 02-02 — Sheet analysis (rankSheets scoring), composite field detection (Key:Value parsing), expanded synonym dictionary (159 hints across 9 fields)
- 2026-02-12: Executed 02-03 — Validation engine (validateAndParseRow, accumulateErrors) + store signals (validationSummary, sheetScores, compositeFields, hasValidationErrors)
- 2026-02-12: Executed 02-04 — Integration: parsing pipeline rewrite + upload UI with validation feedback + content-based fallback column detection for all 9 fields
- 2026-02-12: Phase 2 deployed to lossrun.voxelplatform.com — all 4 plans complete

---
*Last updated: 2026-02-12*
