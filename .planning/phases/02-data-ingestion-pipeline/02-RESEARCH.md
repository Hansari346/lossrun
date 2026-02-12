# Phase 2: Data Ingestion Pipeline - Research

**Researched:** 2026-02-12
**Domain:** Excel file parsing, column mapping, data validation, date/currency normalization
**Confidence:** HIGH

## Summary

This phase is about making the data ingestion pipeline robust enough to handle real-world carrier loss run formats — where column names vary wildly, dates come in every format imaginable, currency values use parenthetical negatives and European formatting, and multi-sheet workbooks bury claims data among summary and cover sheets.

The existing codebase already has a functional upload → header-detect → auto-map → parse pipeline using SheetJS (0.18.5 via CDN) with a hand-rolled fuzzy matching system. The current implementation has critical gaps: it uses `new Date(string)` for date parsing (unreliable), only strips `[$,]` from currency (misses parenthetical negatives), silently drops invalid rows (no validation feedback), always picks the first sheet (no smart sheet selection), and has no composite field detection. There is also a **type mismatch bug** where `Mappings` is defined as `Record<string, number>` in types but `parsing.ts` assigns header name strings to it.

The standard approach is: (1) use SheetJS with `cellDates: true` + `raw: true` to get native Date objects and raw values, (2) build robust `parseDate()` and `parseCurrency()` utility functions that handle all edge cases and report failures instead of silently dropping, (3) implement a two-pass column mapping (header names + sample value analysis), (4) rank sheets by claims-data likelihood heuristics, and (5) accumulate row-level validation errors into a structured summary.

**Primary recommendation:** Enhance the existing `lib/parsing.ts` and `lib/field-mapping.ts` modules with robust parsing functions, expanded synonym dictionary, sheet ranking, composite field detection, and structured validation — keeping the same module boundaries and signal store pattern from Phase 1.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SheetJS (xlsx) | 0.18.5 (CDN) | Excel file reading, sheet/cell access | Already in project; `cellDates`, `raw`, `decode_range` APIs cover all needs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none — hand-roll) | — | Fuzzy column matching | Existing `calculateMatchScore` + synonym dictionary is sufficient; Dice coefficient libraries add ~700B but the hint-based approach is already domain-tuned |
| (none — hand-roll) | — | Date parsing | SheetJS handles serial numbers; custom function handles string formats — no library matches our exact edge cases |
| (none — hand-roll) | — | Currency parsing | Simple regex pipeline handles all known formats; `parsecurrency` npm adds complexity for formats we'll never see in WC loss runs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled fuzzy matching | Fuse.js or string-similarity-js | Adds dependency for ~10 synonym lookups; our hint-based scoring is more precise for this domain since we match against known field names, not arbitrary search |
| Hand-rolled date parsing | date-fns/parse or dayjs | Adds npm dependency to a CDN-script project; our edge cases (SheetJS serial numbers, `MM/DD/YYYY` vs `DD/MM/YYYY` ambiguity) need custom logic regardless |
| Hand-rolled currency parsing | intl-number-parser or parsecurrency | Our WC loss run domain only sees USD formats + parenthetical negatives; a 15-line function covers all cases without a dependency |

**Installation:** No new dependencies needed. All enhancements use existing SheetJS APIs and custom TypeScript functions.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── parsing.ts           # File handling, sheet selection, data loading (ENHANCED)
│   ├── field-mapping.ts     # Column matching, synonym dictionary (ENHANCED)
│   ├── date-utils.ts        # NEW: parseDate() — all date format handling
│   ├── currency-utils.ts    # NEW: parseCurrency() — all currency format handling
│   ├── composite-fields.ts  # NEW: detect & extract Key:Value patterns
│   ├── validation.ts        # NEW: row-level validation, quality summary
│   ├── sheet-analysis.ts    # NEW: multi-sheet ranking, smart sheet selection
│   ├── formatting.ts        # (existing) display formatting
│   ├── calculations.ts      # (existing)
│   ├── charts.ts            # (existing)
│   └── export-ppt.ts        # (existing)
├── types/
│   └── index.ts             # Extended with ValidationResult, SheetScore, etc.
└── state/
    └── store.ts             # Extended with validation signals
```

### Pattern 1: Parse-or-Report (Never Silent Drop)
**What:** Every parsing function returns a result object with the parsed value AND any errors, rather than returning null/undefined on failure.
**When to use:** All date parsing, currency parsing, field extraction.
**Example:**
```typescript
interface ParseResult<T> {
  value: T | null;
  error: string | null;   // Human-readable error message
  raw: string;            // Original input for debugging
}

function parseDate(input: unknown): ParseResult<Date> {
  const raw = String(input ?? '').trim();
  if (!raw) return { value: null, error: 'Empty value', raw };

  // Try SheetJS serial number first
  if (typeof input === 'number' && input > 1 && input < 200000) {
    const d = excelSerialToDate(input);
    if (d) return { value: d, error: null, raw };
  }

  // Try known date patterns...
  // ...

  return { value: null, error: `Unparseable date: "${raw}"`, raw };
}
```

### Pattern 2: Two-Pass Column Mapping
**What:** First pass matches headers by name (synonym dictionary + fuzzy scoring). Second pass examines sample cell values in unmapped columns to detect composite "Key: Value" patterns and infer field types.
**When to use:** After header row detection, before data loading.
**Example:**
```typescript
// Pass 1: Header name matching (existing, enhanced with more synonyms)
const headerMatches = matchHeadersByName(headers, sampleData, allFields);

// Pass 2: Composite field detection on unmapped columns
const unmappedIndices = getUnmappedColumnIndices(headers, headerMatches);
const compositeFields = detectCompositeFields(unmappedIndices, sampleData);
// compositeFields: [{ columnIndex: 5, headerName: "Generic Field 1",
//                     extractedKeys: ["Nature of Injury", "Body Part"] }]
```

### Pattern 3: Sheet Scoring for Smart Selection
**What:** Score each sheet on claims-data likelihood using multiple heuristics, then auto-select the highest-scoring sheet.
**When to use:** On file load, before header detection.
**Example:**
```typescript
interface SheetScore {
  sheetName: string;
  score: number;
  reasons: string[];  // For transparency: "47 rows", "has date columns", etc.
}

function scoreSheet(ws: any, sheetName: string): SheetScore {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;

  let score = 0;
  const reasons: string[] = [];

  // Row count: claims sheets have many rows
  if (rowCount > 10) { score += 20; reasons.push(`${rowCount} rows`); }
  if (rowCount > 50) { score += 10; }

  // Column count: claims sheets have 5-30 columns
  if (colCount >= 5 && colCount <= 50) { score += 15; reasons.push(`${colCount} columns`); }

  // Sheet name heuristics
  const nameLower = sheetName.toLowerCase();
  const claimsKeywords = ['claim', 'loss', 'detail', 'data', 'run', 'listing'];
  const summaryKeywords = ['summary', 'cover', 'total', 'index', 'toc', 'instructions'];
  if (claimsKeywords.some(kw => nameLower.includes(kw))) { score += 25; }
  if (summaryKeywords.some(kw => nameLower.includes(kw))) { score -= 20; }

  // Header pattern matching: scan first rows for known claim field names
  // ...

  return { sheetName, score, reasons };
}
```

### Pattern 4: Validation Accumulator
**What:** During row parsing, accumulate errors into a structured ValidationResult instead of silently filtering.
**When to use:** In `applyMappingAndLoad` during row iteration.
**Example:**
```typescript
interface RowError {
  rowIndex: number;
  field: string;
  message: string;
  rawValue: string;
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  errors: RowError[];
  warnings: string[];
  // Aggregated counts for UI
  unparsableDates: number;
  invalidAmounts: number;
  missingRequired: number;
}
```

### Anti-Patterns to Avoid
- **Silent row dropping:** The current code returns early from `forEach` on invalid rows with no error tracking. Every dropped row must be accounted for in the validation summary.
- **`new Date(string)` for parsing:** JavaScript's Date constructor is implementation-dependent and interprets "01/02/2024" differently across browsers/locales. Always use explicit format detection.
- **Mutating signal state during iteration:** Build the complete result array and validation summary, then assign to signals in one batch.
- **Relying on `raw: false` for date values:** The current code uses `raw: false` which returns formatted strings. Use `cellDates: true` + `raw: true` (or access cell objects directly) to get native Date objects for date cells and raw numbers for numeric cells.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel serial → JS Date | Custom epoch math | SheetJS `cellDates: true` option | Handles 1900 vs 1904 date system, leap year bug, timezone alignment automatically |
| Sheet range dimensions | Manual cell iteration | `XLSX.utils.decode_range(ws['!ref'])` | Returns `{s:{c,r}, e:{c,r}}` with zero-indexed row/column counts |
| Date format detection | Custom number format parser | `XLSX.SSF.is_date(format)` | SheetJS SSF knows all Excel date format codes |
| Sheet type detection | Guessing from content | Check `ws['!type']` property | SheetJS marks chartsheets (`"chart"`), macrosheets (`"macro"`), dialogsheets (`"dialog"`) — skip these |

**Key insight:** SheetJS already solves the hardest problems (serial number conversion, date system detection, format identification). Our job is to use its APIs correctly (`cellDates: true`, `raw: true`, `decode_range`, `SSF.is_date`) and then handle the string-format edge cases that SheetJS hands us as already-formatted text.

## Common Pitfalls

### Pitfall 1: SheetJS `raw: false` Returns Strings, Not Values
**What goes wrong:** The current code uses `raw: false` in `sheet_to_json`, which means ALL values come back as formatted strings. A date cell that Excel stores as serial number 45000 comes back as `"3/15/2023"` (a string). A currency cell stored as -1500 might come back as `"($1,500.00)"`.
**Why it happens:** `raw: false` tells SheetJS to use the formatted text (`w` property) instead of the underlying value (`v` property).
**How to avoid:** Use `cellDates: true` when reading the workbook (`XLSX.read(data, { type: 'array', cellDates: true })`). Then in `sheet_to_json`, use `raw: true` to get native Date objects and numbers. String-formatted dates from CSV/text sources will still need our custom `parseDate()`.
**Warning signs:** Date values that look like strings (`typeof val === 'string'`) when they should be Date objects.

### Pitfall 2: MM/DD/YYYY vs DD/MM/YYYY Ambiguity
**What goes wrong:** `"01/02/2024"` is January 2 in US format but February 1 in European format. No algorithm can resolve this with certainty for a single value.
**Why it happens:** Different carriers export in different locale formats.
**How to avoid:** (1) Use heuristic analysis across the entire column — if any value has a first number > 12, the format is DD/MM. (2) Default to MM/DD/YYYY (US standard) since WC loss runs are US-centric. (3) Flag ambiguous dates in validation output.
**Warning signs:** All dates in a column falling in the first 12 days of each month.

### Pitfall 3: The Mappings Type Mismatch Bug
**What goes wrong:** `types/index.ts` defines `Mappings = Record<string, number>` (field → column index) but `parsing.ts` line 222 assigns header name strings (`newMappings[key] = headers[idx]`). This is a runtime type violation.
**Why it happens:** The type was defined to mean "column index" but the code evolved to store header names.
**How to avoid:** Fix in Phase 2: `Mappings` should be `Record<string, number>` (field key → column index) consistently. The `applyMappingAndLoad` function should work with indices, not header names, throughout.
**Warning signs:** TypeScript `any` escape via the `XLSX: any` global declaration masks this error.

### Pitfall 4: Silent Row Drops Destroy User Trust
**What goes wrong:** The current code `return;`s from the `forEach` when a row has invalid data (line 268). The user sees "Parsed 847 valid row(s)" but doesn't know that 153 rows were silently dropped, some of which had valid data with a date format the parser didn't understand.
**Why it happens:** Early returns are easier than accumulating errors.
**How to avoid:** Every parse attempt returns a `ParseResult<T>` with an error message. Rows with errors are included in a `skippedRows` array with reasons. The UI shows a validation summary.
**Warning signs:** Row count after parsing is significantly less than the sheet's total rows.

### Pitfall 5: Composite Field Detection False Positives
**What goes wrong:** Not every colon in a cell value indicates a "Key: Value" pattern. Timestamps (10:30), ratios (3:1), and natural language ("Note: patient was...") all contain colons.
**Why it happens:** Naive regex matching on `:`.
**How to avoid:** Require the pattern to be consistent across multiple sample rows. A valid composite field should show the SAME keys appearing in most rows (e.g., "Nature of Injury: Strain" and "Nature of Injury: Laceration" in different rows, both having "Nature of Injury" as the key). Require at least 3+ sample rows with matching key prefixes.
**Warning signs:** Extracted "keys" that are numbers, single characters, or appear only once across all sample values.

### Pitfall 6: SheetJS Version 0.18.5 vs Current 0.20.3
**What goes wrong:** The project uses SheetJS 0.18.5 via CDN. The current version is 0.20.3. Version 0.20.0 had a "major overhaul" of date/time handling. Some APIs or behaviors may differ.
**Why it happens:** CDN scripts pinned to an older version.
**How to avoid:** All date/currency code should be tested against the 0.18.5 API. The `cellDates` option exists in 0.18.5 and works. `XLSX.SSF.is_date` and `XLSX.utils.decode_range` are available. Do NOT rely on 0.20.x-specific features. If upgrading SheetJS is deferred to a later phase, document any workarounds needed.
**Warning signs:** Code examples from SheetJS docs that reference `dense: true` mode or `!data` property (added in 0.19.0) won't work with 0.18.5.

## Code Examples

### Robust Date Parsing Function
```typescript
// Source: Custom implementation based on SheetJS docs + domain knowledge

interface ParseResult<T> {
  value: T | null;
  error: string | null;
  raw: string;
}

/**
 * Parse any date format seen in WC loss runs.
 * Priority: JS Date object > SheetJS serial number > explicit format patterns > fallback.
 * NEVER uses `new Date(string)` for ambiguous formats.
 */
function parseDate(input: unknown): ParseResult<Date> {
  const raw = String(input ?? '').trim();
  if (!raw && !(input instanceof Date) && typeof input !== 'number') {
    return { value: null, error: 'Empty date value', raw: '' };
  }

  // 1. Already a Date object (from cellDates: true)
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      return { value: null, error: 'Invalid Date object', raw: raw };
    }
    return { value: input, error: null, raw: raw };
  }

  // 2. SheetJS serial number (numeric, range ~1 to ~200000 covers 1900-2450)
  if (typeof input === 'number' && input >= 1 && input < 200000) {
    return excelSerialToDate(input);
  }

  // 3. Try numeric string (could be a serial number passed as string)
  const numVal = Number(raw);
  if (!isNaN(numVal) && numVal >= 1 && numVal < 200000 && /^\d+\.?\d*$/.test(raw)) {
    return excelSerialToDate(numVal);
  }

  // 4. ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = new Date(+y, +m - 1, +d);
    if (!isNaN(date.getTime())) return { value: date, error: null, raw };
  }

  // 5. US format: MM/DD/YYYY or MM-DD-YYYY
  const usMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (usMatch) {
    let [, m, d, y] = usMatch;
    if (+y < 100) y = String(+y + 2000); // 2-digit year
    const date = new Date(+y, +m - 1, +d);
    if (!isNaN(date.getTime())) return { value: date, error: null, raw };
  }

  // 6. Text month: "Jan 15, 2024" or "15-Jan-2024"
  const monthNames = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;
  if (monthNames.test(raw)) {
    // Let Date constructor handle well-known text month formats
    const d = new Date(raw);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1990 && d.getFullYear() <= 2100) {
      return { value: d, error: null, raw };
    }
  }

  return { value: null, error: `Unparseable date: "${raw}"`, raw };
}

function excelSerialToDate(serial: number): ParseResult<Date> {
  // Excel 1900 date system: serial 1 = Jan 1, 1900
  // Lotus bug: serial 60 = Feb 29, 1900 (doesn't exist)
  const adjustedSerial = serial > 60 ? serial - 1 : serial;
  const utcDays = Math.floor(adjustedSerial - 1); // -1 because serial 1 = Jan 1
  const msPerDay = 86400000;
  const epoch = new Date(1900, 0, 1).getTime(); // Jan 1, 1900 in local time
  const date = new Date(epoch + utcDays * msPerDay);

  if (isNaN(date.getTime())) {
    return { value: null, error: `Invalid serial number: ${serial}`, raw: String(serial) };
  }
  return { value: date, error: null, raw: String(serial) };
}
```

### Robust Currency Parsing Function
```typescript
// Source: Custom implementation for WC loss run domain

/**
 * Parse currency values from carrier loss runs.
 * Handles: $1,234.56, ($1,234.56), -$1,234.56, $$1234, 1.234,56 (EU),
 *          plain numbers, empty/null.
 */
function parseCurrency(input: unknown): ParseResult<number> {
  // Already a number
  if (typeof input === 'number') {
    if (!isFinite(input)) {
      return { value: null, error: 'Non-finite number', raw: String(input) };
    }
    return { value: input, error: null, raw: String(input) };
  }

  const raw = String(input ?? '').trim();
  if (!raw || raw === '-' || raw === '$') {
    return { value: null, error: 'Empty or invalid currency value', raw };
  }

  let str = raw;

  // Detect parenthetical negatives: ($1,234.56) or (1234.56)
  let isNegative = false;
  if (/^\(.*\)$/.test(str)) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  }

  // Strip currency symbols ($, $$, USD, etc.)
  str = str.replace(/^[\$]{1,2}/, '').replace(/^USD\s*/i, '').trim();

  // Detect European format: "1.234,56" (dot as thousands, comma as decimal)
  // Heuristic: if last separator is comma and has exactly 2 digits after
  const euroMatch = str.match(/^[\d.]+,(\d{2})$/);
  if (euroMatch) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: strip commas as thousands separators
    str = str.replace(/,/g, '');
  }

  const num = parseFloat(str);
  if (isNaN(num) || !isFinite(num)) {
    return { value: null, error: `Unparseable amount: "${raw}"`, raw };
  }

  return { value: isNegative ? -num : num, error: null, raw };
}
```

### Composite Field Detection
```typescript
// Source: Custom implementation for "Generic Field 1-8" pattern

interface CompositeField {
  columnIndex: number;
  headerName: string;
  extractedKeys: string[];
  keyFrequency: Map<string, number>;
}

/**
 * Detect "Key: Value" patterns in sample data from unmapped columns.
 * A column is composite if the majority of non-empty values contain
 * the same key prefixes.
 */
function detectCompositeFields(
  columnIndices: number[],
  headers: string[],
  sampleData: any[][],
  minKeyFrequency: number = 3
): CompositeField[] {
  const results: CompositeField[] = [];

  for (const colIdx of columnIndices) {
    const samples = sampleData[colIdx] || [];
    const keyFrequency = new Map<string, number>();

    for (const val of samples) {
      const str = String(val ?? '').trim();
      if (!str) continue;

      // Match "Key: Value" pattern, excluding timestamps (HH:MM)
      const kvMatch = str.match(/^([A-Za-z][A-Za-z\s]{2,30}):\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        // Exclude timestamp-like keys (single digits, "AM", "PM")
        if (!/^\d+$/.test(key) && key.length > 2) {
          keyFrequency.set(key, (keyFrequency.get(key) || 0) + 1);
        }
      }
    }

    // A column is composite if at least one key appears in minKeyFrequency+ rows
    const significantKeys = [...keyFrequency.entries()]
      .filter(([, count]) => count >= minKeyFrequency)
      .map(([key]) => key);

    if (significantKeys.length > 0) {
      results.push({
        columnIndex: colIdx,
        headerName: headers[colIdx] || `Column ${colIdx}`,
        extractedKeys: significantKeys,
        keyFrequency,
      });
    }
  }

  return results;
}
```

### Smart Sheet Selection
```typescript
// Source: Custom implementation for AMIC multi-sheet workbook handling

function rankSheets(wb: any): SheetScore[] {
  const scores: SheetScore[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) {
      scores.push({ sheetName: name, score: -100, reasons: ['Empty sheet'] });
      continue;
    }

    // Skip non-worksheet types (chartsheets, macrosheets)
    if (ws['!type'] && ws['!type'] !== 'sheet') {
      scores.push({ sheetName: name, score: -100, reasons: [`Type: ${ws['!type']}`] });
      continue;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;

    let score = 0;
    const reasons: string[] = [];

    // Dimension scoring
    if (rowCount > 10) { score += 20; reasons.push(`${rowCount} rows`); }
    if (rowCount > 50) { score += 15; }
    if (rowCount > 500) { score += 10; }
    if (colCount >= 5 && colCount <= 50) { score += 15; reasons.push(`${colCount} cols`); }
    if (colCount < 3) { score -= 20; reasons.push('Too few columns'); }

    // Sheet name scoring
    const nameLower = name.toLowerCase();
    const claimsKW = ['claim', 'loss', 'detail', 'data', 'run', 'listing', 'report'];
    const summaryKW = ['summary', 'cover', 'total', 'index', 'toc', 'instruction',
                       'contents', 'pivot', 'chart', 'graph', 'about', 'notes'];
    if (claimsKW.some(kw => nameLower.includes(kw))) {
      score += 25;
      reasons.push('Claims keyword in name');
    }
    if (summaryKW.some(kw => nameLower.includes(kw))) {
      score -= 20;
      reasons.push('Summary keyword in name');
    }

    // Header pattern matching (scan first few rows for known field names)
    const firstRows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, raw: false });
    const scanRows = firstRows.slice(0, 5);
    const headerKeywords = ['claim', 'date', 'loss', 'incurred', 'paid', 'reserve',
                            'location', 'site', 'body part', 'injury'];
    let headerHits = 0;
    for (const row of scanRows) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const cellStr = String(cell ?? '').toLowerCase();
        if (headerKeywords.some(kw => cellStr.includes(kw))) headerHits++;
      }
    }
    if (headerHits >= 3) {
      score += 30;
      reasons.push(`${headerHits} header keyword matches`);
    }

    scores.push({ sheetName: name, score, reasons });
  }

  return scores.sort((a, b) => b.score - a.score);
}
```

### Enhanced Synonym Dictionary
```typescript
// Source: Compiled from WCIO standards, carrier format research, real-world loss runs

// Extended hints for the expanded synonym dictionary
const extendedHints: Record<string, string[]> = {
  site_name: [
    'site', 'location', 'facility', 'store', 'city', 'place', 'address',
    'branch', 'plant', 'warehouse', 'division', 'department', 'dept',
    'insured location', 'risk location', 'loc', 'work location',
    'reporting location', 'office', 'region', 'unit',
  ],
  date_of_loss: [
    'date of loss', 'loss date', 'date of injury', 'doi', 'date loss',
    'incident date', 'accident date', 'occurrence date', 'claim date',
    'injury date', 'date of accident', 'dol', 'date of occurrence',
    'event date', 'date of incident', 'occ date', 'accident dt',
    'loss dt', 'date occurred',
  ],
  total_incurred: [
    'total incurred', 'net incurred', 'all gross incurred', 'incurred',
    'total incur', 'incurred total', 'total loss', 'loss amount',
    'claim amount', 'total cost', 'total paid incurred', 'gross incurred',
    'incurred amount', 'total inc', 'ttl incurred', 'total claim',
    'cumulative incurred', 'inc total',
  ],
  claim_number: [
    'claim number', 'claim #', 'cnr', 'claim num', 'claim id',
    'claim no', 'claim#', 'case number', 'case #', 'file number',
    'clm number', 'clm #', 'clm no', 'reference number', 'ref #',
    'claim ref', 'claim reference', 'file #', 'file no',
  ],
  claim_category: [
    'claim type', 'derived claim type', 'coverage line', 'category',
    'classification', 'claim category', 'mo indemnity',
    'medical only', 'claim status type', 'loss type', 'coverage',
    'line of business', 'lob', 'claim class', 'mo vs indemnity',
    'med only', 'indemnity', 'type of claim',
  ],
  body_part: [
    'body part', 'part of body', 'bodypart', 'part body',
    'injury part', 'affected part', 'anatomy', 'part of body injured',
    'body part injured', 'body part code', 'injured body part',
    'injured part', 'body area',
  ],
  cause_of_loss: [
    'loss category', 'cause bucket', 'loss bucket', 'cause category',
    'loss type', 'accident category', 'incident category',
    'injury category', 'loss classification', 'cause classification',
    'loss code', 'cause code', 'cause of injury', 'cause of loss',
    'nature of injury', 'injury type', 'accident type',
    'injury cause', 'coi', 'noi', 'hazard',
  ],
  lost_days: [
    'lost days', 'days lost', 'disability days', 'lost time days',
    'lt days', 'days disability', 'work days lost', 'days off',
    'lost work', 'time loss days', 'ttd days', 'lost workdays',
    'temporary total disability days', 'days away',
  ],
  loss_description: [
    'description', 'loss description', 'accident description',
    'incident description', 'notes', 'comments', 'narrative',
    'details', 'injury description', 'cause description',
    'description of injury', 'how injury occurred', 'desc',
    'loss desc', 'accident desc', 'claim description',
  ],
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new Date(string)` | Explicit format detection + SheetJS `cellDates` | Always was better | Eliminates silent date misinterpretation across locales |
| `parseFloat(str.replace(/[$,]/g, ''))` | Pattern-aware currency parser | Best practice | Handles parenthetical negatives, European format, double `$$` |
| Silently skip invalid rows | Parse-or-Report pattern | Industry standard | Users see exactly what failed and can fix source data |
| SheetJS `raw: false` (formatted strings) | `cellDates: true` + `raw: true` (native types) | SheetJS best practice since 0.18 | Get Date objects for dates, numbers for numbers, instead of all strings |
| Pick first sheet | Score + rank all sheets | Needed for multi-sheet workbooks | AMIC's 31-sheet workbook auto-selects the right sheet |

**Deprecated/outdated:**
- SheetJS `dense: true` mode requires 0.19.0+; our 0.18.5 CDN version uses sparse mode only
- The `ws['!data']` property (dense mode) is NOT available in 0.18.5 — use `ws[cellRef]` for sparse mode

## Open Questions

1. **SheetJS version upgrade timing**
   - What we know: Project uses 0.18.5 via CDN; current is 0.20.3 with improved date handling. The decision was made to keep CDN scripts temporarily.
   - What's unclear: Whether to upgrade to 0.20.3 in this phase or defer to a later npm-install phase.
   - Recommendation: Keep 0.18.5 for now. All needed APIs (`cellDates`, `decode_range`, `SSF.is_date`) exist in 0.18.5. Write code that works with both versions. Defer upgrade to the phase that npm-installs SheetJS.

2. **DD/MM/YYYY detection strategy**
   - What we know: US-centric WC loss runs predominantly use MM/DD/YYYY. Some international carriers may use DD/MM/YYYY.
   - What's unclear: How prevalent DD/MM/YYYY is in the actual user base.
   - Recommendation: Default to MM/DD/YYYY. Add column-level heuristic (if any first-position value > 12, the column is DD/MM). Flag ambiguous dates in validation summary. Allow user to toggle date format per-column in a future enhancement.

3. **AMIC 31-sheet workbook structure**
   - What we know: AMIC format has 31 sheets with cause categories spread across sheets. The tool needs to auto-identify the claims data sheet.
   - What's unclear: Whether each of the 31 sheets is a separate cause category (one cause per sheet) or if there's one main data sheet + 30 category-specific summary sheets.
   - Recommendation: The sheet scoring algorithm handles both cases — it will rank sheets by row count, column count, and header patterns. If AMIC has one master claims sheet, it'll score highest. If data is spread across sheets, a future "merge sheets" feature can be added.

4. **Composite field extraction as mappable dimensions**
   - What we know: "Generic Field 1-8" columns contain "Key: Value" pairs like "Nature of Injury: Strain".
   - What's unclear: Whether extracted keys should become new columns in canonical data, new field definitions in the mapping table, or a separate metadata structure.
   - Recommendation: Extract as virtual columns. After composite detection, add each extracted key as a new "virtual header" in the column picker. When the user maps e.g. "Nature of Injury" (extracted from Generic Field 3), the parser splits the composite value to get just the value portion.

5. **`Mappings` type: index vs header name**
   - What we know: There's a type mismatch between the type definition (`Record<string, number>`) and actual usage (assigns strings in parsing.ts).
   - What's unclear: Whether other code depends on the string-based behavior.
   - Recommendation: Fix to consistently use column indices (`Record<string, number>`). This aligns with the type definition and with `findBestMatch` returning `{ index, score }`. Audit all Mappings consumers.

## Sources

### Primary (HIGH confidence)
- SheetJS official docs: https://docs.sheetjs.com/docs/csf/features/dates — Date handling, `cellDates`, serial numbers, 1900/1904 systems
- SheetJS official docs: https://docs.sheetjs.com/docs/api/parse-options — Parse options including `cellDates`, `raw`, `dateNF`, `UTC`
- SheetJS official docs: https://docs.sheetjs.com/docs/csf/sheet — Sheet objects, `!ref`, `!type`, `decode_range`
- SheetJS official docs: https://docs.sheetjs.com/docs/csf/cell/ — Cell types (`n`, `d`, `s`, `b`, `e`, `z`), `v` vs `w` properties
- SheetJS CDN: https://cdn.sheetjs.com/ — Current version confirmed as 0.20.3

### Secondary (MEDIUM confidence)
- WCIO cause codes: https://almonline.org/Assets/Files/MWCF/Workers%20Comp%20FROI%20Cause%20Codes%20Table.pdf — Standard cause of injury codes
- Loss run column research: Multiple sources confirm standard columns (claim number, date of loss, total incurred, body part, etc.)
- String-similarity-js: https://www.npmjs.com/package/string-similarity-js — Dice coefficient library, 700B, actively maintained (considered but not recommended)
- parsecurrency: https://www.npmjs.com/package/parsecurrency — Currency parsing library (considered but not recommended)
- intl-number-parser: https://www.npmjs.com/package/intl-number-parser — Locale-aware number parsing (considered but not recommended)

### Tertiary (LOW confidence)
- AMIC 31-sheet format details — No public documentation found; structure inferred from phase description
- Sedgwick/DV format details — No public documentation found; column names inferred from general WC loss run standards
- "Generic Field 1-8" pattern — Described in phase requirements; specific carrier format not publicly documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SheetJS APIs verified against official docs; no new dependencies needed
- Architecture: HIGH — Patterns derived from existing codebase structure + established validation patterns
- Pitfalls: HIGH — Based on code review of existing `parsing.ts` and `field-mapping.ts` showing real bugs/gaps
- Synonym dictionary: MEDIUM — Based on WCIO standards and general WC loss run research; real carrier column names may vary
- Composite field detection: MEDIUM — Algorithm is sound but hasn't been tested against real "Generic Field" data
- AMIC/Sedgwick specifics: LOW — No public documentation; relying on phase description and general WC knowledge

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days — SheetJS and WC data standards are stable)
