# Pitfalls Research

**Domain:** Insurance loss run analysis tool refactor
**Researched:** 2026-02-12
**Confidence:** HIGH (based on codebase inspection + verified library documentation + domain knowledge)

---

## Critical Pitfalls

These cause data corruption, silent failures, or complete feature breakage. Each one has been observed or is directly evidenced in the current codebase.

### Pitfall 1: JavaScript `new Date()` Parsing Is a Minefield

**What goes wrong:** The current code uses `new Date(rawDate)` to parse date strings (line 1618). This is the single most dangerous line in the codebase. JavaScript's Date constructor has format-dependent timezone behavior:
- `new Date('2024/05/28')` → parsed as **local time** (correct)
- `new Date('2024-05-28')` → parsed as **UTC** (shifts to previous day for US timezones)
- `new Date('05/28/2024')` → works in US browsers, fails or misinterprets in EU browsers
- `new Date('28/05/2024')` → `Invalid Date` in most engines (DD/MM/YYYY not supported)

**Why it matters here:** Loss run dates from different carriers arrive in wildly different formats. A carrier in the UK or a carrier system using ISO format will silently produce off-by-one-day errors. Since claims are grouped by year, a December 31 claim shifting to December 30 or January 1 of the next year corrupts year-over-year trend analysis.

**Current vulnerability:** The codebase uses `raw: false` in SheetJS (line 1605), which returns formatted strings instead of raw values. Dates come through as text like "01/15/2023" or "2023-01-15" depending on the Excel format. Then `new Date()` guesses — and guesses wrong.

**Prevention:**
- Use SheetJS with `cellDates: true` to get proper Date objects directly from the Excel serial numbers
- When dates arrive as strings, use explicit format detection (regex match first, then parse with known format)
- Never rely on `new Date(string)` for ambiguous formats
- Validate parsed dates against reasonable ranges (1990–current year + 1)

**Detection:** Unit test with dates like "01/02/2024" — if it parses to January 2 in US locale and February 1 elsewhere, the bug exists.

**Confidence:** HIGH — verified via MDN `Date.parse()` documentation, SheetJS date docs, and direct codebase inspection.

---

### Pitfall 2: Currency Parsing Silently Drops Rows

**What goes wrong:** The current code (line 1622-1625) parses financial values with:
```javascript
incurred.replace(/[$,]/g, '')
```
This only strips single `$` and commas. But real carrier data contains:
- `$$12,345.67` — double dollar signs (observed in real files per PROJECT.md)
- `($1,234.56)` — parentheses meaning negative (standard accounting format)
- `(1,234.56)` — parentheses without dollar sign
- `$-1,234.56` or `-$1,234.56` — mixed negative formats
- `1.234,56` — European decimal notation
- Empty strings, `N/A`, `--`, `$0`, whitespace

**Why it matters here:** Line 1627 silently drops any row where `incurredNum` is not finite or is ≤ 0. This means:
- Claims with `$$` prefix → `NaN` → **silently dropped** (data loss)
- Negative reserves (valid in insurance — means overpayment recovery) → **silently dropped** as ≤ 0
- Claims with parenthetical negatives → parsed as `NaN` → **silently dropped**

Users see "Parsed 847 valid row(s)" but the file had 1,200 rows. They have no way to know 353 rows were silently discarded or why.

**Prevention:**
- Build a robust `parseCurrency(value)` function that handles: `$$`, `$`, parentheses-as-negatives, mixed negative signs, whitespace, `N/A`
- Don't silently drop rows with `incurred ≤ 0` — zero-dollar claims and negative reserves are valid insurance data
- Show users exactly how many rows were skipped and why: "12 rows skipped: 8 missing date, 3 unparseable amounts, 1 missing site"
- Consider using `accounting.unformat()` (accounting.js library) for robust currency parsing

**Detection:** Upload a file with `$$` prefixed values and parenthetical negatives. If parsed row count < total row count with no explanation, the bug exists.

**Confidence:** HIGH — directly verified in current codebase (lines 1621-1628), confirmed with real data format description in PROJECT.md.

---

### Pitfall 3: SheetJS Date System Mismatch (1900 vs 1904)

**What goes wrong:** Excel stores dates as serial numbers (days since epoch). But there are two epoch systems:
- **1900 system** (Windows Excel default): Day 1 = January 1, 1900
- **1904 system** (legacy Mac Excel): Day 1 = January 2, 1904

Additionally, Excel has a **deliberate bug**: it incorrectly treats 1900 as a leap year (February 29, 1900 never existed). This causes an off-by-one error for dates before March 1, 1900 (unlikely in insurance data, but the system detection matters).

If SheetJS reads a 1904-system workbook but interprets dates as 1900-system, every date will be off by ~4 years and 1 day. The tool would show 2020 claims as 2024 claims.

**Why it matters here:** The current code doesn't explicitly handle this. SheetJS typically auto-detects the date system from the workbook metadata, but some corrupted or non-Excel-generated files (exported from carrier systems) may not include this metadata.

**Prevention:**
- Use `cellDates: true` in SheetJS options — let the library handle epoch conversion
- Validate parsed dates are within reasonable bounds (no dates in the 1890s or 2090s)
- If dates look systematically off by ~4 years, flag for user review

**Confidence:** MEDIUM — SheetJS handles this in most cases, but carrier-generated exports from legacy systems may hit edge cases.

---

### Pitfall 4: Composite Field Parsing ("Generic Field 1" Problem)

**What goes wrong:** Some carriers (notably the "Standard Loss Run format" with 96 columns) embed structured data in generic fields like:
```
Generic Field 1: "Nature of Injury: Contusion"
Generic Field 3: "Body Part: Lower Back"
Generic Field 5: "Cause: Slip/Trip/Fall"
```

The current column mapping uses fuzzy header matching against field names. It will never match "Generic Field 1" to "Nature of Injury" because the header says "Generic Field 1" — the semantic meaning is inside the cell values.

**Why it matters here:** This is explicitly called out in PROJECT.md as a known gap. But the pitfall is deeper than "we need to handle this." The pitfalls are:
1. **Detection ambiguity:** How do you detect that "Generic Field 1" contains injury nature vs. body part vs. something else? You have to sample cell values.
2. **Inconsistent embedding:** Some cells might be `"Nature of Injury: Contusion"` and others `"Contusion"` (no prefix). Mixed formats within the same column.
3. **Multiple data points in one field:** A single cell might contain `"Nature: Contusion | Body Part: Lower Back"` — pipe-delimited or semicolon-delimited within a single cell.
4. **False positives:** A "Description" column containing `"Employee slipped on wet floor, contusion to lower back"` is free text, not a structured composite field. Regex that finds "contusion" should not map this column as "Nature of Injury."

**Prevention:**
- Implement a two-pass mapping strategy: first map by headers, then for unmapped critical fields, sample cell values in remaining columns to detect composite patterns
- Use pattern detection: if >50% of non-empty values in a column match `"Label: Value"` format, it's likely a composite field
- Extract the label prefix from composite fields to determine semantic meaning
- Provide a "preview" UI showing sample values from each column so users can manually correct mapping

**Detection:** Upload the "Standard Loss Run format" file — if body part, nature of injury, and cause of loss all map to "unmapped," the composite detection is missing.

**Confidence:** HIGH — directly observed in PROJECT.md descriptions of real carrier formats.

---

### Pitfall 5: Chart.js Canvas-to-Image Export Produces Blurry PPT Charts

**What goes wrong:** The current PPT export (lines 3214-3233) captures charts by calling `canvas.toDataURL('image/png')`. Chart.js renders to a canvas at the browser's device pixel ratio (typically 1x on non-Retina, 2x on Retina). When this canvas is exported to a PNG and then embedded in a 10" × 5.63" (16:9) PowerPoint slide, the image is stretched to fit, producing blurry charts.

On a 1x DPI screen, a 900px wide canvas exported to fill a 10" slide at 96 DPI needs 960px — already slightly upscaled. At 150 DPI (common for projectors), you'd need 1500px. The math doesn't work.

**Why it matters here:** These PPTs are presented to executives. Blurry charts undermine credibility. The current code even adds a white background overlay (lines 3219-3225) to handle transparency, but doesn't address resolution.

**Prevention:**
- Set `devicePixelRatio: 3` or `4` on Chart.js charts before export (use `chart.resize()` after changing to force re-render)
- OR use PptxGenJS native `addChart()` instead of `addImage()` — native PPT charts are vector-based and resolution-independent
- If using image approach, render to an off-screen canvas at 2x–4x resolution, export that, then restore original
- Consider: native charts are editable in PowerPoint (executives may want to tweak), images are not

**Detection:** Export a PPT on a 1080p monitor and zoom to 200% — if charts are pixelated, the resolution is insufficient.

**Confidence:** HIGH — verified via Chart.js `devicePixelRatio` documentation and direct codebase inspection of the export function.

---

### Pitfall 6: Multi-Sheet Workbook — Wrong Sheet Auto-Selection

**What goes wrong:** The current code (line 1359) defaults to the first sheet: `currentSheetName = sheetNames[0]`. But in real loss run workbooks:
- Sheet 1 is often a "Cover Page" or "HIPAA Notice" with no tabular data
- Sheet 2 might be "Summary" (aggregated, not claim-level data)
- Sheet 15 might be the actual claims detail
- Some sheets are completely empty
- Some workbooks have 31 sheets (one per day or one per month)

If the user doesn't know which sheet has the data, they'll try the first one, see garbage mapping results, and assume the tool is broken.

**Why it matters here:** The user base is non-technical (sales and CS teams). They shouldn't need to know Excel sheet structure. The AMIC format has 31 sheets — expecting users to manually try each one is a UX failure.

**Prevention:**
- Auto-scan all sheets and score them: row count, column count, presence of header-like rows, presence of numeric data
- Present sheets ranked by "likelihood of being claims data" with a preview of row count and sample headers
- Pre-filter: skip sheets with < 5 rows, sheets with no numeric columns, sheets named "Cover", "Summary", "Instructions", "HIPAA"
- Show a sheet preview (first 5 rows) so users can visually confirm before mapping

**Detection:** Upload the AMIC 31-sheet workbook. If the user has to click through all 31 sheets to find the data, the UX failed.

**Confidence:** HIGH — directly observed in PROJECT.md carrier format descriptions.

---

### Pitfall 7: Header Row Detection Misfire on Metadata Rows

**What goes wrong:** The current `findHeaderRow()` (lines 1391-1450) scores rows based on: number of non-empty cells, ratio of text vs. numbers, and a penalty for >50 columns. This can misfire when:
- Row 1-3 contain HIPAA warnings or carrier disclaimers (lots of text → high score)
- A metadata row says `"Report Generated: 01/15/2024 | Carrier: AMIC | Policy: WC-12345"` — lots of text cells, looks like a header
- The actual header is on row 5 but has fewer columns filled (some optional column headers are blank)

**Why it matters here:** If header detection picks the wrong row, every column mapping will be wrong, and the entire analysis is garbage. The user sees wrong column names in the mapping dropdowns and has no idea why.

**Prevention:**
- Add negative signals: rows containing "HIPAA", "confidential", "generated", "report date", "page X of Y" are metadata, not headers
- Add positive signals: rows containing known insurance terms ("claim", "incurred", "date of loss", "site") are likely headers
- Score based on match to known field vocabulary, not just text-vs-number ratio
- Show the detected header row to the user with a "Wrong row? Click to select the correct header row" option

**Detection:** Upload a file with 3 rows of HIPAA disclaimers above the actual header. If the tool picks row 1 as the header, detection failed.

**Confidence:** HIGH — codebase inspection reveals the scoring algorithm has no domain-specific signals.

---

## Technical Debt Patterns

Patterns in the current codebase that will compound during refactoring if not addressed.

### TD-1: Global Mutable State Everywhere

The codebase uses 5 global variables (`workbook`, `currentSheetName`, `headerRow`, `mappings`, `canonicalData`, `chartInstances`) mutated from dozens of functions. During refactoring:
- **Trap:** Moving functions to separate modules but keeping globals → creates implicit coupling between modules that's harder to trace than a monolith
- **Fix:** Define a clear state container (even a simple object with getter/setter) before splitting files. Each module receives state, doesn't reach for globals.

### TD-2: Business Logic Reads Directly from DOM

The `calculateAndShowResults()` function reads adjustment values from DOM elements (`el('wcReduction').value`). The PPT export reads KPI values from DOM text content (`el('deltaBlock').textContent`).
- **Trap:** If you refactor calculations into a pure module, the PPT export still depends on DOM values being rendered first
- **Fix:** Calculations should produce a result object. DOM rendering reads from the result object. PPT export reads from the result object. DOM is never the source of truth.

### TD-3: Chart Code is 60% Copy-Paste

Each of the 11 charts has 50-80 lines of nearly identical Chart.js configuration. The patterns vary slightly (bar vs. line, horizontal vs. vertical, different tooltip formatters).
- **Trap:** Refactoring into a "chart factory" that tries to abstract all variations leads to an overly complex configuration DSL that's harder to maintain than the copy-paste
- **Fix:** Create 3-4 chart builder functions for actual pattern groups (comparison bar, trend line, breakdown pie, projection). Don't over-abstract — some charts are genuinely different.

### TD-4: No Error Boundaries

An exception in one chart's rendering crashes `calculateAndShowResults()`, which means no charts render, and the user sees a blank results page with no error message.
- **Trap:** During refactoring, partially working code is more common. A missing field or wrong data type in one chart kills the entire page.
- **Fix:** Wrap each chart render in try/catch. Show a per-chart error state ("This chart couldn't render — [reason]") rather than killing the whole page.

---

## Performance Traps

### PT-1: SheetJS Parses Entire Workbook Into Memory

`XLSX.read(data, { type: 'array' })` parses the entire workbook — all sheets, all cells — into memory. For a 31-sheet AMIC workbook with thousands of rows per sheet, this can consume 50-100+ MB of browser memory.

**Impact:** On lower-end machines (common for non-technical users), this can cause the browser tab to become unresponsive or crash. The 128 MB Worker memory limit is not relevant here (parsing is client-side), but mobile Safari and older Chrome have practical limits around 1-2 GB.

**Mitigation:**
- Use `sheetRows: N` option to limit row parsing during initial scan (parse first 25 rows of each sheet for header detection, then fully parse only the selected sheet)
- Consider using SheetJS streaming/chunked parsing for very large files
- Show a loading indicator with progress feedback during parsing

### PT-2: Recalculating Everything on Every Input Change

Every slider movement, toggle change, or dropdown selection triggers `calculateAndShowResults()`, which:
1. Filters all data
2. Recalculates all KPIs
3. Destroys and recreates all 11 Chart.js instances
4. Re-renders all DOM elements

With 1,000+ rows and 11 charts, this takes 200-500ms per input event. Dragging a slider fires dozens of events per second → janky UI.

**Mitigation:**
- Debounce input handlers (100-200ms)
- Separate "data changed" (needs full recalc) from "parameter changed" (only needs chart update)
- Reuse Chart.js instances: update `chart.data` and call `chart.update()` instead of destroying and recreating
- Use `requestAnimationFrame` to batch DOM updates

### PT-3: PPT Generation Blocks the UI Thread

`exportToPPT()` is async but runs on the main thread. For 10+ chart captures + image encoding + PPTX XML generation, this can block the UI for 3-10 seconds. The "Generating..." button state helps, but the page freezes.

**Mitigation:**
- Use Web Workers for PPT generation (pass chart images as transferable ArrayBuffers)
- At minimum, yield to the main thread between slides: `await new Promise(r => setTimeout(r, 0))` between each slide
- Show per-slide progress: "Generating slide 3 of 12..."

### PT-4: Cloudflare Worker Script Size

The current `worker.js` is 3,348 lines with all HTML/CSS/JS inlined as a template literal. After refactoring with a build step, the Worker script size limit is:
- Free plan: 3 MB
- Paid plan: 10 MB

SheetJS alone is ~1.2 MB minified, Chart.js is ~200 KB, PptxGenJS is ~300 KB. If all three are bundled into the Worker script, you're at ~1.7 MB before any application code.

**Mitigation:**
- Use Cloudflare Workers Static Assets to serve the HTML/CSS/JS separately — the Worker only handles routing
- Load libraries from CDN (current approach) or from static assets — not bundled into the Worker script
- The SPA routing config (`not_found_handling: "single-page-application"`) eliminates most Worker invocations for page loads

---

## UX Pitfalls

### UX-1: "No Valid Rows" Error With No Explanation

When parsing fails, the user sees: "No valid rows after parsing. Check that date and incurred values are valid." (line 1661-1662). This tells a non-technical user nothing actionable. They don't know:
- Which rows failed
- Whether it was a date problem, a money problem, or a mapping problem
- What "valid" means in this context
- What to do about it

**Fix:** Show a parse results summary: "1,200 rows found. 847 parsed successfully. 353 skipped: 180 rows had no date value, 120 rows had unparseable amounts ('$$', parenthetical negatives), 53 rows had no site name. [Show skipped rows]"

### UX-2: Column Mapping Dropdowns Are Overwhelming

With 96 columns, the mapping dropdown for each field has 96 options. Non-technical users can't scan 96 column names to find the right one, especially when names are like "Generic Field 1" through "Generic Field 8."

**Fix:**
- Show auto-mapped fields as pre-selected with confidence indicator (high/medium/low)
- For unmapped fields, show only the top 5 most likely matches (sorted by score) plus an "Other..." option that opens the full list
- Show sample values from each column next to the option so users can identify by data, not just column name
- Add a "Preview" showing 3-5 sample values from the selected column

### UX-3: Charts Render for Missing Data Dimensions

If "cause_of_loss" is not mapped, the "Indemnity Breakdown by Loss Category" chart renders with all data in a single "Uncategorized" bar. This isn't wrong — it's just useless and confusing. Users think the chart is broken.

Similarly, if "lost_days" is not mapped, the Lost Days Analysis section shows "No data available" — but the section header and card are still visible, making the page feel broken.

**Fix:**
- Hide chart sections entirely when their required data dimension is not mapped
- Show a dashboard summary: "Based on your data, we can show: [Cost Analysis ✓] [Trend Analysis ✓] [Category Breakdown ✗ — no cause of loss column mapped] [Lost Days Analysis ✗ — no lost days column mapped]"
- Explain what additional data would unlock: "Map a 'Cause of Loss' column to see breakdown by injury type"

### UX-4: No Undo / No Back Navigation Safety

If a user is on the Results page and clicks "Step 1" in the nav, all results are lost. If they re-upload a file, all adjustments are reset. There's no confirmation dialog, no way to go back.

**Fix:**
- Confirm before destructive navigation: "Going back to Step 1 will clear your current analysis. Continue?"
- Preserve adjustment values when re-uploading (they often apply to multiple files)
- Consider a "Reset" button instead of implicit reset-on-upload

### UX-5: Silent Failures in PPT Export

If a chart canvas doesn't exist (section was collapsed, chart failed to render, data wasn't available), `addChartSlide` silently does nothing (line 3216: `if (canvas) {`). The resulting PPT might have 5 slides instead of 12, and the user doesn't know slides are missing.

**Fix:**
- Track expected vs. actual slides
- Show a post-export summary: "PowerPoint generated with 8 of 12 possible slides. Missing: Site Comparison (single site), Lost Days (no data mapped)."
- Or show a pre-export checklist: "Your PPT will include: [✓ Executive Summary] [✓ Cost Comparison] [✗ Site Comparison — need multiple sites] [✗ Lost Days — not mapped]"

---

## "Looks Done But Isn't" Checklist

Things that appear to work in demos but fail with real carrier data.

| # | Looks Done | But Actually | How to Verify |
|---|-----------|--------------|---------------|
| 1 | Date parsing works | Only works for US MM/DD/YYYY format; fails on ISO dates, European formats, Excel serial numbers | Test with file using `2024-01-15` format dates |
| 2 | Currency parsing works | Fails on `$$`, parenthetical negatives, and European decimals | Test with file containing `$$1,234.56` and `($500.00)` |
| 3 | Column mapping auto-detects | Only works for carriers with descriptive column names; fails on "Generic Field" patterns | Test with "Standard Loss Run" format (96 columns) |
| 4 | All 11 charts render | Charts render with garbage data when wrong column is mapped; no validation | Map "Claim Number" to "Total Incurred" and see if charts catch it |
| 5 | PPT export works | Charts are blurry, missing slides are silent, no data tables included | Export on 1080p monitor, zoom to 200% in PowerPoint |
| 6 | Site filter works | Filter dropdown shows raw site names (inconsistent casing, trailing spaces, abbreviations) | Upload file with "New York", "NEW YORK", "New York " as different sites |
| 7 | Sheet selection works | Defaults to first sheet which is often cover page/HIPAA notice | Test with AMIC 31-sheet workbook |
| 8 | Header detection works | Misidentifies HIPAA disclaimer rows or metadata rows as headers | Test with file that has 3 rows of warnings before actual header |
| 9 | YTD annualization works | Only prompts user; doesn't auto-detect partial year data or validate | Upload a file with data only through June — does it warn? |
| 10 | Existing Customer mode works | Uses same charts as Prospect mode with different labels; no before/after temporal split | Toggle existing customer and verify Voxel start date actually splits the data |

---

## Pitfall-to-Phase Mapping

Recommendations for which refactoring phase should address each pitfall.

| Pitfall | Suggested Phase | Rationale |
|---------|----------------|-----------|
| P1: Date parsing | **Phase 1 (Data Ingestion)** | Foundation — every downstream calculation depends on correct dates |
| P2: Currency parsing | **Phase 1 (Data Ingestion)** | Foundation — incorrect amounts corrupt all analysis |
| P3: Date system mismatch | **Phase 1 (Data Ingestion)** | Use `cellDates: true` as part of SheetJS configuration overhaul |
| P4: Composite field parsing | **Phase 1 (Data Ingestion)** | Critical for carrier format coverage, but can be iterative |
| P5: Blurry PPT charts | **Phase 3 (PPT Export)** | Isolated to export; fix `devicePixelRatio` or switch to native charts |
| P6: Wrong sheet selection | **Phase 1 (Data Ingestion)** | Part of file upload UX overhaul |
| P7: Header row misfire | **Phase 1 (Data Ingestion)** | Part of parsing pipeline overhaul |
| TD-1: Global state | **Phase 0 (Architecture)** | Must be addressed before splitting into modules |
| TD-2: DOM-coupled logic | **Phase 0 (Architecture)** | Must be addressed before splitting into modules |
| TD-3: Chart copy-paste | **Phase 2 (Charts/Visualization)** | Refactor during chart system rebuild |
| TD-4: No error boundaries | **Phase 0 (Architecture)** | Critical for safe incremental refactoring |
| PT-1: Full workbook parse | **Phase 1 (Data Ingestion)** | Memory optimization during parsing overhaul |
| PT-2: Recalc on every input | **Phase 2 (Charts/Visualization)** | Debouncing + chart instance reuse |
| PT-3: PPT blocks UI | **Phase 3 (PPT Export)** | Web Worker or yield-based approach |
| PT-4: Worker script size | **Phase 0 (Architecture)** | Static assets setup as first infrastructure step |
| UX-1: Opaque errors | **Phase 1 (Data Ingestion)** | Part of parsing result reporting |
| UX-2: Dropdown overload | **Phase 1 (Data Ingestion)** | Part of mapping UI redesign |
| UX-3: Empty charts shown | **Phase 2 (Charts/Visualization)** | Adaptive chart visibility |
| UX-4: No undo safety | **Phase 0 (Architecture)** | Navigation guard as early UX win |
| UX-5: Silent PPT gaps | **Phase 3 (PPT Export)** | Export checklist/summary |

### Phase Ordering Rationale

1. **Phase 0 — Architecture:** Fix global state, DOM coupling, error boundaries, static assets. Without this, module extraction creates worse coupling than the monolith.
2. **Phase 1 — Data Ingestion:** Date parsing, currency parsing, composite fields, sheet selection, header detection. This is the highest-risk area and everything downstream depends on it.
3. **Phase 2 — Charts/Visualization:** Chart factory, adaptive display, debouncing, data tables. Depends on clean data from Phase 1.
4. **Phase 3 — PPT Export:** Resolution fix, native charts, export summary. Depends on chart system from Phase 2.

---

## Sources

| Source | Confidence | Used For |
|--------|------------|----------|
| Current codebase (`src/worker.js`) — direct inspection | HIGH | All code-specific pitfalls, TD patterns |
| `.planning/PROJECT.md` | HIGH | Domain context, carrier format descriptions |
| [SheetJS Dates Documentation](https://docs.sheetjs.com/docs/csf/features/dates) | HIGH | Date parsing, 1900/1904 systems, cellDates option |
| [SheetJS Parse Options](https://docs.sheetjs.com/docs/api/parse-options) | HIGH | cellDates, cellNF, raw options |
| [MDN Date.parse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse) | HIGH | JavaScript date parsing ambiguity |
| [Chart.js Device Pixel Ratio](https://chartjs.org/docs/latest/configuration/device-pixel-ratio.html) | HIGH | Export quality, devicePixelRatio |
| [Chart.js Responsive Charts](https://chartjs.org/docs/latest/configuration/responsive.html) | HIGH | Canvas sizing pitfalls |
| [PptxGenJS Charts API](https://gitbrent.github.io/PptxGenJS/docs/api-charts/) | HIGH | Native vs image charts |
| [PptxGenJS Images API](https://gitbrent.github.io/PptxGenJS/docs/api-images/) | HIGH | Image encoding, performance |
| [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits) | HIGH | Bundle size, memory, CPU limits |
| [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) | HIGH | SPA serving architecture |
| [SheetJS Issue #2942](https://git.sheetjs.com/sheetjs/sheetjs/issues/2942) — 1900 Leap Year Bug | HIGH | Excel date epoch off-by-one |
| [accounting.js](https://openexchangerates.github.io/accounting.js/) | MEDIUM | Currency parsing alternative |
| [ACORD Data Standards](https://acord.org/standards-architecture/acord-data-standards) | MEDIUM | Insurance industry data standardization landscape |
| [PptxGenJS Issue #655](https://github.com/gitbrent/PptxGenJS/issues/655) — Chart + Image conflict | MEDIUM | Known PPT generation bugs |
| Stack Overflow — Chart.js export quality threads | MEDIUM | Community solutions for blurry exports |
| WebSearch — JavaScript date parsing pitfalls | MEDIUM | Cross-browser date behavior |
