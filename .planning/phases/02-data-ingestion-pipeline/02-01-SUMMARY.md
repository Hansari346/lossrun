---
phase: 02-data-ingestion-pipeline
plan: 01
subsystem: data-parsing
tags: [types, date-parsing, currency-parsing, ParseResult]
dependency-graph:
  requires: [01-01, 01-02]
  provides: [ParseResult pattern, date-utils, currency-utils]
  affects: [02-02, 02-03, 02-04]
tech-stack:
  added: []
  patterns: [ParseResult<T> parse-or-report, pure-function modules]
key-files:
  created:
    - src/lib/date-utils.ts
    - src/lib/currency-utils.ts
  modified:
    - src/types/index.ts
decisions:
  - ParseResult<T> as universal return type for all parsing functions
  - Never use new Date(string) for numeric date formats
  - Lotus 1-2-3 bug correction in Excel serial conversion
  - European format detection via comma-before-2-digits heuristic
metrics:
  duration: ~2.5 minutes
  completed: 2026-02-12
---

# Phase 2 Plan 1: Types & Parsing Utilities Summary

**One-liner:** ParseResult<T> pattern + robust date/currency parsers handling Excel serials, US/ISO/text-month dates, parenthetical negatives, and European comma-decimal format

## What Was Done

### Task 1: Extended type definitions (8473334)
Added 5 ingestion pipeline interfaces to `src/types/index.ts`:
- **ParseResult\<T\>** — Generic parse-or-report result with `value`, `error`, and `raw` fields
- **RowError** — Per-row validation error with row index, field, message, raw value
- **ValidationSummary** — Aggregated validation output (totals, errors, warnings, counts)
- **SheetScore** — Multi-sheet workbook ranking with score and reasons
- **CompositeField** — Key:Value column detection with frequency map

### Task 2: Created date parsing utility (5a08412)
`src/lib/date-utils.ts` — 209 lines, two exports:
- **parseDate(input: unknown)** — Handles 7 format priorities: Date objects, Excel serials, numeric serial strings, ISO 8601, US MM/DD/YYYY with 2-digit year support, text-month formats (both "Jan 15, 2024" and "15-Jan-2024")
- **excelSerialToDate(serial: number)** — Excel 1900 date system with Lotus 1-2-3 leap-year bug correction
- CRITICAL: Never uses `new Date(string)` for numeric formats — all parsing done via regex + explicit `new Date(y, m-1, d)` construction

### Task 3: Created currency parsing utility (12a11ee)
`src/lib/currency-utils.ts` — 94 lines, one export:
- **parseCurrency(input: unknown)** — Pipeline: detect type → strip parens/minus → strip currency symbols → detect European vs US format → parseFloat → apply sign
- Edge cases: `($1,234.56)` → -1234.56, `$$1234` → 1234, `1.234,56` → 1234.56, `0` → 0

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | ParseResult\<T\> as universal return type | Every parsing function returns value+error+raw — eliminates silent null/undefined data loss |
| 2 | Never `new Date(string)` for numeric formats | Locale-dependent behavior causes MM/DD vs DD/MM confusion — regex extraction is deterministic |
| 3 | Lotus 1-2-3 bug correction in serial conversion | Excel inherits fake Feb 29, 1900 — serials > 60 must subtract 1 for correct dates |
| 4 | European format detected by `/^[\d.]+,(\d{2})$/` | Distinguishes "1.234,56" (European) from "1,234.56" (US) by comma-before-2-digits pattern |
| 5 | 2-digit year: 00–49 → 2000s, 50–99 → 1900s | Standard windowing for loss run data where dates range ~1990–2050 |

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| ParseResult interface exists | PASS — line 154 of types/index.ts |
| ValidationSummary interface exists | PASS — line 169 of types/index.ts |
| date-utils exports parseDate | PASS — line 103 |
| date-utils exports excelSerialToDate | PASS — line 69 |
| currency-utils exports parseCurrency | PASS — line 37 |
| Both libs import only from ../types | PASS — no signal store, no DOM |
| `npx wrangler dev` starts | PASS — Ready on localhost:8787 |

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 8473334 | feat(02-01): extend type definitions with ingestion pipeline interfaces |
| 2 | 5a08412 | feat(02-01): create robust date parsing utility |
| 3 | 12a11ee | feat(02-01): create robust currency parsing utility |

## Next Phase Readiness

- **Blockers:** None
- **Ready for:** Plan 02-02 (sheet detection, header scanning) can import ParseResult from types
- **Ready for:** Plan 02-03 (validation pipeline) can consume parseDate and parseCurrency
- **Dependencies satisfied:** ParseResult\<T\> pattern established for all downstream parsing modules
