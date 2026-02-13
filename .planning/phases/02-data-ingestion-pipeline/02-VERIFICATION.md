---
phase: 02-data-ingestion-pipeline
verified: 2026-02-12T22:30:00Z
status: passed
score: 5/5 must-haves verified
must_haves:
  truths:
    - "User uploads an AMIC-format file (31 sheets) and the tool auto-selects the correct claims sheet and maps columns correctly"
    - "User uploads a Standard Loss Run file with Generic Field 1-8 columns and sees extracted dimensions available for mapping"
    - "User sees a validation summary after mapping showing row counts, parse errors, and data quality"
    - "Dates and currency amounts parse correctly regardless of format — no silent row drops"
    - "User can manually override any auto-mapped column assignment"
  artifacts:
    - path: "src/lib/date-utils.ts"
      provides: "Robust date parsing (7 formats, Excel serials, Lotus bug correction)"
    - path: "src/lib/currency-utils.ts"
      provides: "Robust currency parsing (parenthetical negatives, European format, $$ prefix)"
    - path: "src/lib/sheet-analysis.ts"
      provides: "Smart multi-sheet ranking by claims-data likelihood"
    - path: "src/lib/composite-fields.ts"
      provides: "Key:Value composite field detection and extraction"
    - path: "src/lib/field-mapping.ts"
      provides: "Fuzzy header matching with 161 synonym hints across 9 fields"
    - path: "src/lib/validation.ts"
      provides: "Row-level validation engine with error accumulation"
    - path: "src/lib/content-detection.ts"
      provides: "Content-based fallback column detection for all 9 fields"
    - path: "src/lib/parsing.ts"
      provides: "Integration pipeline wiring all utilities together"
    - path: "src/components/upload-page.tsx"
      provides: "Upload UI with sheet scores, composite notices, validation summary, manual overrides"
    - path: "src/state/store.ts"
      provides: "Signal store with validationSummary, sheetScores, compositeFields signals"
    - path: "src/types/index.ts"
      provides: "ParseResult<T>, RowError, ValidationSummary, SheetScore, CompositeField types"
  key_links:
    - from: "parsing.ts"
      to: "sheet-analysis.ts"
      via: "rankSheets(wb) called in handleFileSelect"
    - from: "parsing.ts"
      to: "composite-fields.ts"
      via: "detectCompositeFields() in handleSheetSelect, extractCompositeValue() in applyMappingAndLoad"
    - from: "parsing.ts"
      to: "validation.ts"
      via: "validateAndParseRow() + accumulateErrors() in applyMappingAndLoad"
    - from: "parsing.ts"
      to: "field-mapping.ts"
      via: "requiredFields, optionalFields, findBestMatch imported and used"
    - from: "parsing.ts"
      to: "store.ts"
      via: "Writes to validationSummary, sheetScores, compositeFields signals"
    - from: "upload-page.tsx"
      to: "parsing.ts"
      via: "handleFileSelect, handleSheetSelect, applyMappingAndLoad called"
    - from: "upload-page.tsx"
      to: "content-detection.ts"
      via: "detectAllUnmappedFields() for fallback column matching"
    - from: "upload-page.tsx"
      to: "store.ts"
      via: "Reads validationSummary, sheetScores, compositeFields for display"
    - from: "validation.ts"
      to: "date-utils.ts"
      via: "parseDate() called for date_of_loss parsing"
    - from: "validation.ts"
      to: "currency-utils.ts"
      via: "parseCurrency() called for total_incurred and lost_days parsing"
    - from: "content-detection.ts"
      to: "date-utils.ts"
      via: "parseDate() used to score date columns by content"
    - from: "content-detection.ts"
      to: "currency-utils.ts"
      via: "parseCurrency() used to score currency columns by content"
---

# Phase 2: Data Ingestion Pipeline Verification Report

**Phase Goal:** Reliably ingest any carrier's loss run format — handling variant column names, composite fields, multi-sheet workbooks, and messy data — with transparent validation feedback so users trust the results.

**Verified:** 2026-02-12T22:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User uploads an AMIC-format file (31 sheets) and tool auto-selects correct claims sheet and maps columns | ✓ VERIFIED | `rankSheets()` in sheet-analysis.ts (158 lines) scores sheets using row/column dimensions, name keywords (CLAIMS_KEYWORDS), and header pattern matching (HEADER_KEYWORDS). parsing.ts calls `rankSheets(wb)` at line 70, writes to `sheetScores` signal, auto-selects highest-scoring sheet. Upload page displays scores next to sheet names (lines 199-228). |
| 2 | User uploads Standard Loss Run with "Generic Field 1-8" and sees extracted dimensions | ✓ VERIFIED | `detectCompositeFields()` in composite-fields.ts (107 lines) identifies Key:Value patterns with frequency filtering (minKeyFrequency=3). parsing.ts calls it at line 215 in `handleSheetSelect()`, writes to `compositeFieldsSignal`. Upload page shows composite field notice (blue banner, lines 259-276). In `applyMappingAndLoad()`, composite keys are matched against `optionalFields` hints (lines 282-311) and injected as overrides per row (lines 319-331). |
| 3 | User sees validation summary showing row counts, parse errors, and data quality | ✓ VERIFIED | `validateAndParseRow()` in validation.ts (249 lines) produces per-row errors. `accumulateErrors()` categorizes by type. parsing.ts creates summary, counts valid/skipped rows, writes to `validationSummary` signal (line 353). Upload page renders: valid rows, total rows, skipped count, unparsable dates count, invalid amounts count, missing required count (lines 387-435). |
| 4 | Dates and currency amounts parse correctly regardless of format — no silent row drops | ✓ VERIFIED | **date-utils.ts** (209 lines): Handles Date objects, Excel serial numbers (with Lotus 1-2-3 bug correction), serial strings, ISO 8601, US MM/DD/YYYY with 2-digit year, and two text-month variants. Never uses `new Date(string)` for numeric formats. Returns `ParseResult<Date>` with error+raw on failure. **currency-utils.ts** (94 lines): Handles raw numbers, $/$$ prefixes, parenthetical negatives, leading minus, European comma-decimal format, US comma-thousand format. Returns `ParseResult<number>` with error+raw. **No silent drops**: validation.ts returns `{ record: null, errors: [...] }` on required-field failure; every failure is tracked in ValidationSummary. |
| 5 | User can manually override any auto-mapped column assignment | ✓ VERIFIED | Upload page uses `overrides` signal (line 38) for per-field column overrides. Each field row renders a `<select>` dropdown (line 313) listing all headers. `setOverride()` (line 133-134) updates the local overrides. `onApply()` (lines 103-131) checks manual overrides first (`overrides.value[key]`) before falling back to header-based auto-detection, then content-based detection. Manual overrides have highest priority. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Lines | Status | Details |
|----------|-------|--------|---------|
| `src/types/index.ts` | 193 | ✓ VERIFIED | ParseResult\<T\> (line 154), RowError (161), ValidationSummary (169), SheetScore (181), CompositeField (188) — all with proper typing |
| `src/lib/date-utils.ts` | 209 | ✓ VERIFIED | 2 exports: `excelSerialToDate()`, `parseDate()`. Handles 7 format priorities. Pure function, imports only from `../types`. |
| `src/lib/currency-utils.ts` | 94 | ✓ VERIFIED | 1 export: `parseCurrency()`. Handles parens, $$, European format. Pure function, imports only from `../types`. |
| `src/lib/sheet-analysis.ts` | 158 | ✓ VERIFIED | 1 export: `rankSheets()`. Additive scoring (rows, columns, name keywords, header patterns). Pure function. |
| `src/lib/composite-fields.ts` | 107 | ✓ VERIFIED | 2 exports: `detectCompositeFields()`, `extractCompositeValue()`. Frequency-based Key:Value detection. Pure function. |
| `src/lib/field-mapping.ts` | 441 | ✓ VERIFIED | 6 exports including `requiredFields` (3 fields), `optionalFields` (6 fields), `findBestMatch()`, `calculateMatchScore()`. 161 synonym hints total. |
| `src/lib/validation.ts` | 249 | ✓ VERIFIED | 3 exports: `createEmptyValidationSummary()`, `validateAndParseRow()`, `accumulateErrors()`. Uses `parseDate` and `parseCurrency`. Decoupled from composite-fields via parameter injection. |
| `src/lib/content-detection.ts` | 585 | ✓ VERIFIED | 3 exports: `ContentMatch` type, `detectFieldByContent()`, `detectAllUnmappedFields()`. 9 per-field detectors. Scores capped at 25-45 (below header threshold 50). Bonus module not in original plan. |
| `src/lib/parsing.ts` | 483 | ✓ VERIFIED | Integration orchestrator. Uses `cellDates: true`, calls `rankSheets()`, `detectCompositeFields()`, `extractCompositeValue()`, `validateAndParseRow()`, `accumulateErrors()`. Writes to all 3 new store signals. |
| `src/components/upload-page.tsx` | 451 | ✓ VERIFIED | Full UI: file upload, sheet selector with scores, composite field banner, mapping table with dropdowns, content-based detection labels, validation summary panel, manual override support. |
| `src/state/store.ts` | 100 | ✓ VERIFIED | 3 new signals: `validationSummary`, `sheetScores`, `compositeFields`. 1 new computed: `hasValidationErrors`. `resetState()` clears all. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `parsing.ts` | `sheet-analysis.ts` | `rankSheets(wb)` | ✓ WIRED | Called at line 70, result written to `sheetScores.value` at line 71 |
| `parsing.ts` | `composite-fields.ts` | `detectCompositeFields()` + `extractCompositeValue()` | ✓ WIRED | Detection at line 215, extraction at line 326, results used in validation loop |
| `parsing.ts` | `validation.ts` | `validateAndParseRow()` + `accumulateErrors()` | ✓ WIRED | Per-row validation at line 333, error accumulation at line 349, summary written to store at line 353 |
| `parsing.ts` | `field-mapping.ts` | `requiredFields`, `optionalFields`, `findBestMatch` | ✓ WIRED | Used for required-field validation and composite key matching |
| `parsing.ts` | `store.ts` | Signal writes | ✓ WIRED | Writes `sheetScores` (71), `compositeFieldsSignal` (220), `validationSummary` (353) |
| `upload-page.tsx` | `parsing.ts` | Function calls | ✓ WIRED | `handleFileSelect` (53), `handleSheetSelect` (61), `applyMappingAndLoad` (127) |
| `upload-page.tsx` | `content-detection.ts` | `detectAllUnmappedFields()` | ✓ WIRED | Called at line 100, results stored in `contentMatches` signal, displayed in UI |
| `upload-page.tsx` | `store.ts` | Signal reads | ✓ WIRED | Reads `validationSummary` (387), `sheetScores` (199), `compositeFields` (259), `hasValidationErrors` (13) |
| `validation.ts` | `date-utils.ts` | `parseDate()` | ✓ WIRED | Called at line 109 for date_of_loss validation |
| `validation.ts` | `currency-utils.ts` | `parseCurrency()` | ✓ WIRED | Called at line 135 for total_incurred, line 178 for lost_days |
| `content-detection.ts` | `date-utils.ts` | `parseDate()` | ✓ WIRED | Used in `countDates()` helper (line 53) for content-based date column detection |
| `content-detection.ts` | `currency-utils.ts` | `parseCurrency()` | ✓ WIRED | Used in `countCurrency()` helper (line 69) for content-based currency column detection |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| INGEST-01 | Fuzzy column mapping with expanded synonym dictionary | ✓ SATISFIED | `field-mapping.ts` has 161 hint strings across 9 fields covering AMIC, Standard Loss Run, Sedgwick formats. `calculateMatchScore()` does exact, starts-with, ends-with, whole-word, contains, and fuzzy (all-words-present) matching with field-type bonuses. Threshold at 50. |
| INGEST-02 | Generic/composite field parsing — Key:Value extraction | ✓ SATISFIED | `composite-fields.ts` detects Key:Value patterns with frequency filtering (minKeyFrequency=3). `parsing.ts` matches extracted keys against `optionalFields` hints and injects overrides per row. UI shows composite field banner. |
| INGEST-03 | Smart multi-sheet detection — auto-identify claims sheets | ✓ SATISFIED | `sheet-analysis.ts` scores sheets using row/column dimensions, name keywords (7 claims + 11 summary keywords), and header pattern matching (12 keywords across first 5 rows). Scores displayed in sheet selector dropdown. |
| INGEST-04 | Data validation with quality summary | ✓ SATISFIED | `validation.ts` validates every row: required fields (site_name, date_of_loss, total_incurred) produce `record: null` on failure; optional fields produce warnings. `accumulateErrors()` categorizes by field type. UI shows valid/total/skipped counts with unparsable dates, invalid amounts, missing required breakdowns. |
| INGEST-05 | Robust date parsing — all formats, no silent drops | ✓ SATISFIED | `date-utils.ts` handles: Date objects, Excel serials (with Lotus bug), serial strings, ISO 8601, US MM/DD/YYYY (2-digit year), text-month-first, day-month-year. Never uses `new Date(string)`. Returns `ParseResult<Date>` with error reporting. |
| INGEST-06 | Robust currency parsing — $, $$, parens, European | ✓ SATISFIED | `currency-utils.ts` handles: raw numbers, parenthetical negatives, leading minus, $/$$ prefix, European comma-decimal, US comma-thousand. Returns `ParseResult<number>` with error reporting. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/date-utils.ts` | 131 | Word "placeholder" in error string `"Non-date placeholder: ..."` | ℹ️ Info | Not a code stub — this is a legitimate error message for handling input values like "-" or "N/A" |
| `src/lib/currency-utils.ts` | 33, 48, 54 | Word "placeholder" in comments and error strings | ℹ️ Info | Not code stubs — legitimate error handling for inputs like "$" or "$$" with no value |

**No blocker or warning anti-patterns found.** All "placeholder" matches are in error messages, not in code comments indicating incomplete implementation. Zero TODO/FIXME/XXX/HACK markers. Zero `console.log`-only implementations. All `return null` usages are legitimate "no match found" patterns in detection functions.

### TypeScript Compilation

`npx tsc --noEmit` — **PASS** (zero errors)

### Code Quality Notes

- All library modules are pure functions with no side effects (no store access, no DOM manipulation)
- Clean separation: parsing utilities → validation engine → integration pipeline → UI
- Wave 2 parallelism preserved: `validation.ts` does NOT import from `composite-fields.ts` — composite overrides are injected as parameters
- `ParseResult<T>` pattern used consistently across all parsing functions — eliminates silent null/undefined data loss
- Column-index-based lookup (`row[headers[mappings[fieldKey]]]`) correctly bridges SheetJS header keys with index-based mappings
- Content-based detection scores (25-45) are correctly capped below header-match threshold (50) ensuring header matches always take priority

### Human Verification Required

### 1. AMIC Multi-Sheet Auto-Selection
**Test:** Upload a real AMIC-format file with 31 sheets (cause categories) and verify the tool auto-selects the correct claims detail sheet
**Expected:** The sheet with claims-level data ranks highest; sheet selector shows it pre-selected with a reasonable score
**Why human:** Need real AMIC file to verify scoring against actual sheet structures

### 2. Standard Loss Run Composite Field Extraction
**Test:** Upload a Standard Loss Run file with "Generic Field 1-8" columns containing Key:Value patterns (e.g., "Nature of Injury: Strain")
**Expected:** Blue composite field banner appears showing detected keys; extracted dimensions auto-fill in the mapping table
**Why human:** Need real file with composite patterns to verify end-to-end extraction

### 3. Validation Summary Visual Feedback
**Test:** Upload a file with known bad data (missing dates, invalid currency, etc.) and check the validation summary panel
**Expected:** Summary shows correct counts (e.g., "3 dates unparseable, 2 amounts invalid") with amber styling when skipped rows > 0
**Why human:** Visual styling and message clarity require human judgment

### 4. Manual Override Flow
**Test:** After auto-mapping, change a field's column assignment via the dropdown, then click "Apply mapping & load data"
**Expected:** Override is respected — the manually selected column is used instead of the auto-detected one
**Why human:** UI interaction flow can't be verified programmatically

### 5. Content-Based Fallback Display
**Test:** Upload a file with non-standard column headers (e.g., "Col A", "Col B") and verify content-based detection kicks in
**Expected:** Amber-highlighted dropdowns appear with "detected by content" labels and explanatory tooltips
**Why human:** Need a file with deliberately bad headers to test fallback behavior

### Gaps Summary

No gaps found. All 5 success criteria are structurally verified. All 6 requirements (INGEST-01 through INGEST-06) are satisfied. All 11 artifacts exist, are substantive (no stubs), and are properly wired together. TypeScript compiles cleanly. No anti-patterns detected.

The 5 human verification items above are standard UI/UX checks that require real file interaction — they do not indicate missing functionality.

---

_Verified: 2026-02-12T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
