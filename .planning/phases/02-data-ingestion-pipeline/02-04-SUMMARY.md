---
phase: 02-data-ingestion-pipeline
plan: 04
subsystem: integration
tags: [parsing-pipeline, upload-ui, validation-feedback, content-detection]
dependency-graph:
  requires: [02-01, 02-02, 02-03]
  provides: [integrated ingestion pipeline, validation UI, content-based fallback detection]
  affects: [Phase 3 — calculation engine consumes canonical data]
tech-stack:
  added: []
  patterns: [content-based column detection, composite field extraction, validation accumulation]
key-files:
  created:
    - src/lib/content-detection.ts
  modified:
    - src/lib/parsing.ts
    - src/components/upload-page.tsx
decisions:
  - Column-index lookup pattern: row[headers[mappings[fieldKey]]] bridges SheetJS header keys with index-based mappings
  - Composite overrides passed as Record<string,string> to keep validation decoupled from composite-fields
  - Content-based detection scores capped at 25-45 (below header threshold of 50) so header matches always win
  - Detection priority order prevents two fields claiming the same column
  - Domain keyword sets (body parts, causes, categories) are extensible Sets for future additions
metrics:
  duration: ~15 minutes
  completed: 2026-02-12
---

# Phase 2 Plan 4: Integration & Content Detection Summary

**One-liner:** Wired all Phase 2 utilities into the live parsing pipeline and upload UI, plus added content-based fallback column detection for all 9 fields when headers don't match.

## What Was Done

### Task 1: Rewrite parsing.ts to integrate all new utilities (e2af440)
Rewrote `src/lib/parsing.ts` internals while preserving function signatures:
- **handleFileSelect**: Uses `cellDates: true`, calls `rankSheets()` for smart sheet selection, auto-selects highest-scoring sheet
- **handleSheetSelect**: Uses `raw: true`, calls `detectCompositeFields()` on all columns, returns composite field data
- **applyMappingAndLoad**: Fixed Mappings type bug (stores index, not header string), builds composite field map matching extracted keys against optionalFields hints, calls `validateAndParseRow` for each row with `compositeOverrides`, accumulates errors with `accumulateErrors()`
- Brownfield guard: all function signatures unchanged, existing UI code works without changes

### Task 2: Enhance upload page UI (86896e8)
Updated `src/components/upload-page.tsx` with Phase 2 capabilities:
- Sheet selector shows scores next to sheet names
- Auto-selected best match indicator with score tooltip
- Composite field detection notice (blue banner with extracted keys)
- Validation summary panel with valid/skipped row counts and categorized error counts
- onSheetChange handler updated for new return type

### Task 3: Content-based fallback column detection (8330178)
Created `src/lib/content-detection.ts` — 380+ lines, standalone module:

| Field | Detection Strategy |
|---|---|
| date_of_loss | parseDate() success rate on samples; >50% = date column |
| total_incurred | parseCurrency() success + median > $100 + currency symbols |
| site_name | Moderate cardinality (5-50 distinct), short text, not numeric |
| claim_number | High cardinality (mostly unique), digits + consistent format |
| claim_category | Very low cardinality (2-10 values) + MO/Indemnity keywords |
| body_part | Domain vocabulary match (40+ body part keywords) |
| cause_of_loss | Domain vocabulary match (30+ injury cause keywords) |
| lost_days | Numeric with small integer range (0-365), no currency symbols |
| loss_description | High cardinality + long average string length (>30 chars) |

- Integrated into upload-page.tsx: amber-highlighted dropdowns with "detected by content" label
- `detectAllUnmappedFields()` processes fields in priority order and claims columns exclusively

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Fixed Mappings type bug (index not string) | `Mappings = Record<string, number>` — storing header string violated the type contract |
| 2 | Composite keys matched against optionalFields hints | Reuses existing synonym dictionary — no duplicate keyword management |
| 3 | Content detection scores 25-45 | Always below header-match threshold (50) so header matches take priority |
| 4 | Priority ordering in content detection | Required fields first, then by detection reliability — prevents column conflicts |
| 5 | Domain keyword Sets for body parts/causes/categories | Extensible, O(1) lookup, easy to add carrier-specific terms |

## Deviations from Plan

| # | Deviation | Reason |
|---|-----------|--------|
| 1 | Added content-based fallback detection (not in original plan) | User requested: "Adjust data ingestion so it works even if column headers are incorrect" |

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| parsing.ts uses cellDates: true | PASS |
| parsing.ts calls rankSheets | PASS |
| parsing.ts calls detectCompositeFields | PASS |
| parsing.ts calls validateAndParseRow | PASS |
| upload-page.tsx shows sheet scores | PASS |
| upload-page.tsx shows composite field notice | PASS |
| upload-page.tsx shows validation summary | PASS |
| upload-page.tsx uses content detection fallback | PASS |
| `npx wrangler deploy` succeeds | PASS — deployed to lossrun.voxelplatform.com |

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | e2af440 | feat(02-04): rewrite parsing.ts to integrate all Phase 2 utilities |
| 2 | 86896e8 | feat(02-04): enhance upload page with sheet scores, composite fields, validation summary |
| 3 | 8330178 | feat(02-04): add content-based fallback column detection |

## Next Phase Readiness

- **Blockers:** None
- **Ready for:** Phase 3 — canonical data with parsed dates, validated amounts, and dimension fields is now available via `canonicalData.value`
- **Phase 2 deliverables complete:** Smart sheet selection, robust parsing, composite field extraction, expanded synonyms, validation feedback, content-based fallback detection
