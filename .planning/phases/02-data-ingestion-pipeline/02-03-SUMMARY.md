---
phase: 02-data-ingestion-pipeline
plan: 03
subsystem: data-validation
tags: [validation, error-accumulation, signal-store, ValidationSummary]
dependency-graph:
  requires: [02-01]
  provides: [validateAndParseRow, accumulateErrors, validationSummary signal, sheetScores signal, compositeFields signal]
  affects: [02-04]
tech-stack:
  added: []
  patterns: [row-level error accumulation, column-index-based lookup, composite override injection]
key-files:
  created:
    - src/lib/validation.ts
  modified:
    - src/state/store.ts
decisions:
  - Column-index-based row lookup via row[headers[mappings[fieldKey]]] pattern
  - Composite overrides injected as Record<string,string> to keep validation decoupled from composite-fields
  - Optional field parse failures produce warnings but don't skip the row
  - accumulateErrors categorizes by field name substring matching (date/incurred/amount)
metrics:
  duration: ~2 minutes
  completed: 2026-02-12
---

# Phase 2 Plan 3: Validation Engine & Store Signals Summary

**One-liner:** Row-level validation engine with structured error accumulation and reactive store signals for validation summary, sheet scores, and composite fields

## What Was Done

### Task 1: Created validation engine (b31485a)
`src/lib/validation.ts` — 249 lines, three exports:
- **createEmptyValidationSummary()** — Factory returning zeroed ValidationSummary with all counts at 0 and empty arrays
- **validateAndParseRow(row, mappings, headers, rowIndex, compositeOverrides?)** — Parses a single row using column-index-based lookups. Required fields (site_name, date_of_loss, total_incurred) produce `record: null` on failure. Optional fields (claim_number, claim_category, body_part, cause_of_loss, loss_description, lost_days) produce warnings but still yield a record. Composite overrides fill empty optional fields from pre-extracted values.
- **accumulateErrors(summary, errors)** — Mutates a ValidationSummary to categorize errors: date-related → unparsableDates, incurred/amount → invalidAmounts, missing messages → missingRequired
- Imports only from `../types`, `./date-utils`, `./currency-utils` — NO composite-fields dependency (Wave 2 parallelism preserved)

### Task 2: Extended signal store (ad07ce2)
`src/state/store.ts` — 19 lines added:
- **validationSummary** signal (`ValidationSummary | null`, default `null`)
- **sheetScores** signal (`SheetScore[]`, default `[]`)
- **compositeFields** signal (`CompositeField[]`, default `[]`)
- **hasValidationErrors** computed (true when `skippedRows > 0`)
- **resetState()** updated to clear all three new signals
- Existing signals and behavior completely untouched (brownfield guard)

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Column-index lookup: `row[headers[mappings[fieldKey]]]` | SheetJS `sheet_to_json` uses header strings as keys; mappings store column indices, so we need the header array to bridge index → key |
| 2 | Composite overrides as `Record<string, string>` parameter | Keeps validation.ts decoupled from composite-fields.ts — caller extracts composites and passes results, preserving Wave 2 parallelism |
| 3 | Optional field failures don't skip rows | Missing claim_number or bad lost_days shouldn't discard an otherwise valid claim record |
| 4 | Error categorization by field name substring | Simple heuristic: "date" → unparsableDates, "incurred"/"amount" → invalidAmounts, "Missing" in message → missingRequired |

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| validation.ts imports parseDate from date-utils | PASS |
| validation.ts imports parseCurrency from currency-utils | PASS |
| validation.ts does NOT import from composite-fields | PASS — confirmed via grep |
| store.ts exports validationSummary | PASS — line 65 |
| store.ts exports sheetScores | PASS — line 68 |
| store.ts exports compositeFields | PASS — line 71 |
| store.ts exports hasValidationErrors | PASS — line 79 |
| resetState() clears new signals | PASS — lines 97-99 |
| `npx wrangler dev` starts | PASS — Ready on localhost |

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | b31485a | feat(02-03): create validation engine with row-level error accumulation |
| 2 | ad07ce2 | feat(02-03): extend signal store with validation, sheet, and composite signals |

## Next Phase Readiness

- **Blockers:** None
- **Ready for:** Plan 02-04 (integration) can import validateAndParseRow, createEmptyValidationSummary, accumulateErrors from validation.ts
- **Ready for:** Plan 02-04 can write to validationSummary, sheetScores, compositeFields signals from the parsing pipeline
- **Dependencies satisfied:** All validation infrastructure in place for the Wave 3 integration plan
