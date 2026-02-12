# Architecture: Loss Run Analyzer

## Overview

Single-page application served by a Cloudflare Worker. The entire application (HTML, CSS, JavaScript) is embedded as a template literal string inside one JavaScript file (`src/worker.js`, 3,348 lines). The Worker simply returns this HTML string on every request.

## Components

### 1. Cloudflare Worker (Server)
- **File:** `src/worker.js` (lines 3335-3347)
- **Role:** HTTP server only — returns the HTML page with `Content-Type: text/html`
- **Bindings:** None (no KV, R2, D1, or Durable Objects)
- **Route:** `lossrun.voxelplatform.com`
- **Logic:** Zero server-side business logic

### 2. Client-Side Application (Embedded HTML)
All processing happens in the browser. The app is a 3-page wizard:

#### Page 1: Data Ingestion
- Excel file upload and parsing via SheetJS
- Auto-detection of header rows (scans first 20 rows)
- Smart column mapping with fuzzy matching (scoring algorithm)
- Required fields: Site/Location, Date of Loss, Total Incurred
- Optional fields: Claim Number, Claim Category, Body Part, Lost Days, Cause of Loss, Loss Description
- Site filtering dropdown
- "Existing Customer" toggle (changes calculation mode)

#### Page 2: Adjustments
- Preset modes (Conservative / Balanced / Aggressive)
- Improvement assumption sliders (WC reduction, lost time reduction, retention, misc cost, observation speed)
- Auto-populated injury cost inputs from ingested data
- Observation program cost calculator
- YTD annualization with rounding options

#### Page 3: Results
- Summary KPI tiles (Direct/Indirect/Observation costs — Current vs Improved)
- 11 Chart.js visualizations (loss breakdown, trends, projections, comparisons)
- PowerPoint export via PptxGenJS
- Dual mode: Prospect vs Existing Customer calculations

## Data Flow

```
Excel File (.xlsx)
  → FileReader API → SheetJS parsing
  → Header row detection → Column mapping UI
  → Canonical data array (in-memory)
  → Site filtering
  → Adjustment parameters applied
  → Calculation engine → KPI values + Chart data
  → Chart.js rendering + PPT export
```

## Key Patterns

- **No persistence:** All data lives in memory; refresh loses everything
- **No API calls:** Purely client-side processing
- **Global state:** `workbook`, `canonicalData`, `mappings`, `chartInstances` as global variables
- **DOM manipulation:** Direct `getElementById` / `innerHTML` — no framework
- **Event-driven:** Input change listeners trigger recalculation when on results page

## Concerns

1. **Monolithic file:** 3,348 lines — HTML, CSS, and JS in one template literal
2. **No build pipeline:** Raw JS, no bundler, no TypeScript
3. **No tests**
4. **Repetitive chart code:** Each chart has ~50-80 lines of similar configuration
5. **Business logic coupled to DOM:** Calculation functions read directly from DOM elements
6. **No error boundaries:** Exceptions in chart rendering could break entire results page
7. **CDN dependencies:** SheetJS, Chart.js, PptxGenJS loaded from CDN with pinned versions
