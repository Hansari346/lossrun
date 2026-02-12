# Architecture Research

**Domain:** Insurance loss run analysis tool (Cloudflare Worker SPA refactor)
**Researched:** 2026-02-12
**Confidence:** HIGH (patterns verified against current Cloudflare docs, codebase audited)

## Standard Architecture

### System Overview

The system is a **client-side SPA served from a Cloudflare Worker**. The Worker's sole job is to return HTML+CSS+JS to the browser. All data processing (Excel parsing, column mapping, calculations, chart rendering, PPT generation) happens client-side. This is by design — loss run data never leaves the browser for privacy.

The refactored architecture follows a **layered pipeline** pattern:

```
Excel File → [Ingestion Layer] → [Column Mapping Engine] → Canonical Data
Canonical Data → [Calculation Engine] → Calculated Results
Calculated Results → [Chart Registry] → Rendered Charts + Data Tables
Calculated Results + Charts → [Export Layer] → PPT / Excel
```

Each layer is a pure-function module with no DOM dependencies (except the presentation layer). This enables testability and clean separation.

### Component Responsibilities

| Component | Responsibility | Dependencies |
|-----------|---------------|-------------|
| **Worker entry** (`worker.js`) | Serve the SPA HTML; potentially add headers, auth, or API routes later | None (serves static assets) |
| **Ingestion module** | Parse Excel via SheetJS, detect header rows, extract sample data, handle multi-sheet workbooks | SheetJS |
| **Column mapping engine** | Match source columns → canonical schema via scored matching, parse composite fields | Ingestion output |
| **Data store** | Hold canonical data in memory, expose filtered/grouped views, emit change events | Column mapping output |
| **Calculation engine** | Compute all business metrics (costs, TRIR, projections, ROI, annualization) from canonical data + user adjustments | Data store |
| **Chart registry** | Declare available chart types, detect which charts can render given available data dimensions, render charts | Calculation engine output, Chart.js |
| **Data table renderer** | Render tabular data alongside each chart, synchronized with chart data | Calculation engine output |
| **PPT export** | Build branded PowerPoint deck from calculated results + chart images | Calculation engine, Chart.js canvas captures, PptxGenJS |
| **Excel export** | Export all underlying data tables as formatted Excel workbook | Data store, SheetJS |
| **UI shell** | Wizard navigation, form inputs, DOM manipulation, event binding | All modules above |

## Recommended Project Structure

```
lossrun/
├── wrangler.jsonc                  # Cloudflare Worker config with assets
├── package.json                    # Dependencies + build scripts
├── build.js                        # esbuild script for client bundle
├── src/
│   ├── worker.js                   # CF Worker entry — serves index.html (thin)
│   └── client/                     # Client-side SPA code
│       ├── index.html              # Shell HTML (structure, no inline JS)
│       ├── styles/
│       │   └── main.css            # All styles extracted from current inline
│       ├── app.js                  # Client entry point — boots the app
│       ├── core/
│       │   ├── schema.js           # Canonical field definitions (requiredFields, optionalFields)
│       │   ├── store.js            # In-memory data store with event emitter
│       │   └── constants.js        # Colors, presets, branding config
│       ├── ingestion/
│       │   ├── parser.js           # Excel parsing, header detection, sample extraction
│       │   └── sheet-selector.js   # Multi-sheet workbook handling
│       ├── mapping/
│       │   ├── engine.js           # Column mapping scoring engine (pure functions)
│       │   ├── composite.js        # Composite field parser ("Nature of Injury: Contusion")
│       │   ├── normalizer.js       # String normalization, type detection
│       │   └── canonical.js        # Transform raw rows → canonical schema
│       ├── calculations/
│       │   ├── costs.js            # Direct/indirect cost calculations
│       │   ├── projections.js      # Multi-year projections, sigmoid curves
│       │   ├── trir.js             # TRIR/OSHA rate calculations
│       │   ├── annualization.js    # YTD annualization logic
│       │   └── index.js            # Orchestrator: runs all calculations, returns results object
│       ├── charts/
│       │   ├── registry.js         # Chart registry — declares all chart types + data requirements
│       │   ├── renderers/          # Individual chart renderer functions
│       │   │   ├── cost-comparison.js
│       │   │   ├── cause-breakdown.js
│       │   │   ├── loss-by-year.js
│       │   │   ├── site-comparison.js
│       │   │   ├── lost-days.js
│       │   │   ├── trir-impact.js
│       │   │   ├── payback.js
│       │   │   └── improvements.js
│       │   ├── theme.js            # Chart.js theme/color configuration
│       │   └── utils.js            # Shared chart helpers (formatters, tooltip callbacks)
│       ├── tables/
│       │   ├── renderer.js         # Generic data table renderer
│       │   └── definitions.js      # Table column definitions per chart type
│       ├── export/
│       │   ├── ppt.js              # PowerPoint generation
│       │   ├── ppt-slides/         # Individual slide builder functions
│       │   │   ├── title.js
│       │   │   ├── executive-summary.js
│       │   │   ├── chart-slide.js
│       │   │   └── insights.js
│       │   └── excel.js            # Excel workbook export
│       ├── ui/
│       │   ├── wizard.js           # Page navigation, wizard flow
│       │   ├── mapping-ui.js       # Column mapping table UI
│       │   ├── adjustments-ui.js   # Step 2 form controls
│       │   ├── results-ui.js       # Step 3 results page orchestration
│       │   ├── site-filter.js      # Site filter dropdown
│       │   └── presets.js          # Conservative/Balanced/Aggressive presets
│       └── utils/
│           ├── formatters.js       # fmtMoney, fmtInt, fmtNum
│           ├── dom.js              # DOM helpers (el(), toggleChart())
│           └── events.js           # Simple event bus for module communication
├── dist/                           # Build output (gitignored)
│   ├── index.html                  # Processed HTML with <script> tag
│   ├── app.bundle.js              # Bundled client JS
│   └── styles/
│       └── main.css                # Processed CSS
└── test/                           # Future: unit tests for pure-function modules
    ├── mapping/
    ├── calculations/
    └── charts/
```

### Why This Structure

**`src/client/` vs `src/worker.js`:** Clean separation between what runs on Cloudflare's edge (the Worker) and what runs in the browser (the client SPA). The Worker is intentionally thin.

**`core/` for shared definitions:** The canonical schema (`schema.js`) is the single source of truth for field definitions, hints, types. Both the mapping engine and calculation engine reference it. The store (`store.js`) is the central data holder — no module reads from the DOM to get data.

**`mapping/` as its own module:** The column mapping engine is the most complex domain logic. It deserves isolation. The `engine.js` handles scoring, `composite.js` handles parsing "Generic Field" values, `normalizer.js` handles string cleanup, and `canonical.js` transforms raw rows to the canonical schema.

**`charts/registry.js` as the orchestrator:** Instead of a giant `drawCharts()` function with 500+ lines of conditionals, each chart type is a self-contained renderer. The registry decides which charts to render based on available data.

**`export/ppt-slides/`:** PPT generation is broken into per-slide builders so each can be tested and modified independently.

## Architectural Patterns

### Pattern 1: Canonical Data Schema (Normalize Early, Use Everywhere)

**What:** Define a single canonical schema that all downstream consumers expect. Map carrier data into this schema as early as possible (right after ingestion). Every module downstream works with the same data shape.

**Why:** The current code has mapping logic leaking into calculations and chart rendering. By normalizing at the boundary, all downstream code is carrier-format-agnostic.

**Implementation:**

```javascript
// core/schema.js — Single source of truth
export const CANONICAL_FIELDS = {
  // Required
  site_name:      { label: 'Site / Location', required: true, type: 'text', hints: [...] },
  date_of_loss:   { label: 'Date of Loss',    required: true, type: 'date', hints: [...] },
  total_incurred: { label: 'Total Incurred',   required: true, type: 'number', hints: [...] },

  // Optional — presence drives which charts render
  claim_number:    { label: 'Claim Number',     required: false, type: 'text', hints: [...] },
  claim_category:  { label: 'Claim Category',   required: false, type: 'text', hints: [...] },
  cause_of_loss:   { label: 'Cause of Loss',    required: false, type: 'text', hints: [...] },
  body_part:       { label: 'Body Part',        required: false, type: 'text', hints: [...] },
  lost_days:       { label: 'Lost Days',        required: false, type: 'number', hints: [...] },
  restricted_days: { label: 'Restricted Days',  required: false, type: 'number', hints: [...] },
  department:      { label: 'Department',       required: false, type: 'text', hints: [...] },
  claim_status:    { label: 'Claim Status',     required: false, type: 'text', hints: [...] },
  // ... extensible for future fields
};
```

```javascript
// mapping/canonical.js — Transform once, use everywhere
export function toCanonical(rawRows, mappings, schema) {
  return rawRows
    .map(row => {
      const record = {};
      for (const [field, def] of Object.entries(schema)) {
        const sourceCol = mappings[field];
        if (!sourceCol) continue;
        record[field] = parseValue(row[sourceCol], def.type);
      }
      return record;
    })
    .filter(record => isValidRecord(record, schema));
}
```

### Pattern 2: Column Mapping Engine (Scored Multi-Signal Matching)

**What:** A pluggable scoring engine that evaluates each source column against each canonical field using multiple signals: header name matching, data type detection from sample values, and composite field content parsing.

**Why:** The current `findBestMatch` is a single function with header-name matching and basic type detection. It fails on "Generic Field 1" columns where the header says nothing useful. A multi-signal approach with composite field parsing addresses this.

**Implementation:**

```javascript
// mapping/engine.js
export function scoreAllMappings(headerRow, sampleData, schema) {
  const scores = {}; // { fieldKey: [{ column, score, signals }] }

  for (const [fieldKey, fieldDef] of Object.entries(schema)) {
    scores[fieldKey] = headerRow.map((header, colIdx) => {
      const signals = [];

      // Signal 1: Header name match (0-100)
      const nameScore = scoreHeaderMatch(header, fieldDef.hints);
      signals.push({ type: 'name', score: nameScore, weight: 0.5 });

      // Signal 2: Data type match from samples (0-100)
      const typeScore = scoreTypeMatch(sampleData[colIdx], fieldDef.type);
      signals.push({ type: 'type', score: typeScore, weight: 0.3 });

      // Signal 3: Composite field content match (0-100)
      const compositeScore = scoreCompositeContent(sampleData[colIdx], fieldKey);
      signals.push({ type: 'composite', score: compositeScore, weight: 0.2 });

      const totalScore = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
      return { column: header, colIdx, score: totalScore, signals };
    })
    .filter(m => m.score >= 40) // Minimum threshold
    .sort((a, b) => b.score - a.score);
  }

  return scores;
}
```

```javascript
// mapping/composite.js — Parse "Nature of Injury: Contusion" from Generic Fields
const COMPOSITE_PATTERNS = [
  { pattern: /^Nature of Injury:\s*(.+)$/i,    field: 'cause_of_loss' },
  { pattern: /^Body Part:\s*(.+)$/i,           field: 'body_part' },
  { pattern: /^Cause:\s*(.+)$/i,               field: 'cause_of_loss' },
  { pattern: /^Department:\s*(.+)$/i,           field: 'department' },
  { pattern: /^Location:\s*(.+)$/i,             field: 'site_name' },
];

export function parseCompositeColumn(values) {
  const fieldHits = {}; // { fieldKey: count }
  for (const val of values.slice(0, 20)) {
    if (!val) continue;
    for (const { pattern, field } of COMPOSITE_PATTERNS) {
      if (pattern.test(String(val))) {
        fieldHits[field] = (fieldHits[field] || 0) + 1;
      }
    }
  }
  // Return the dominant field this column contains, if consistent
  const entries = Object.entries(fieldHits).sort((a, b) => b[1] - a[1]);
  if (entries.length > 0 && entries[0][1] >= values.length * 0.3) {
    return { field: entries[0][0], extractPattern: COMPOSITE_PATTERNS.find(p => p.field === entries[0][0]).pattern };
  }
  return null;
}
```

### Pattern 3: Chart Registry (Data-Driven Conditional Rendering)

**What:** A registry of chart definitions that declares what data dimensions each chart requires. At render time, the registry inspects the available data dimensions and only renders charts whose requirements are met.

**Why:** The current `drawCharts()` function is 500+ lines of inline Chart.js configuration with manual `if (data.length > 0)` checks scattered throughout. This pattern makes the system automatically adaptive: map `cause_of_loss` and cause charts appear; map `lost_days` and lost-days charts appear. No hardcoded conditionals needed.

**Implementation:**

```javascript
// charts/registry.js
import { renderCauseBreakdown } from './renderers/cause-breakdown.js';
import { renderLossByYear } from './renderers/loss-by-year.js';
import { renderSiteComparison } from './renderers/site-comparison.js';
import { renderLostDays } from './renderers/lost-days.js';
// ... etc

const CHART_DEFINITIONS = [
  {
    id: 'causeOfLoss',
    title: 'Indemnity Breakdown by Loss Category',
    requires: ['cause_of_loss'],                // Optional fields that must be mapped
    alwaysAvailable: false,
    group: 'analysis',
    render: renderCauseBreakdown,
  },
  {
    id: 'lossByYear',
    title: 'Total Incurred by Year',
    requires: [],                                // Only needs required fields
    alwaysAvailable: true,
    group: 'trends',
    render: renderLossByYear,
  },
  {
    id: 'siteComparison',
    title: 'Site Comparison Analysis',
    requires: [],
    minCondition: (data) => new Set(data.map(r => r.site_name)).size > 1,
    group: 'analysis',
    render: renderSiteComparison,
  },
  {
    id: 'lostDaysAnalysis',
    title: 'Lost Work Days Analysis',
    requires: ['lost_days'],
    group: 'analysis',
    render: renderLostDays,
  },
  // ... more chart definitions
];

export function getAvailableCharts(canonicalData, mappings) {
  const mappedFields = new Set(Object.keys(mappings));

  return CHART_DEFINITIONS.filter(chart => {
    // Check required data dimensions are mapped
    const hasRequiredFields = chart.requires.every(f => mappedFields.has(f));
    if (!hasRequiredFields) return false;

    // Check custom conditions (e.g., multi-site)
    if (chart.minCondition && !chart.minCondition(canonicalData)) return false;

    return true;
  });
}

export function renderAllCharts(canonicalData, calculations, mappings, chartInstances) {
  // Destroy existing
  Object.values(chartInstances).forEach(c => c?.destroy());
  const newInstances = {};

  const available = getAvailableCharts(canonicalData, mappings);

  for (const chartDef of available) {
    const container = document.getElementById(`chart-${chartDef.id}`);
    if (!container) continue;
    container.closest('.chart-card').style.display = 'block';
    newInstances[chartDef.id] = chartDef.render(container, canonicalData, calculations);
  }

  // Hide unavailable chart cards
  for (const chartDef of CHART_DEFINITIONS) {
    if (!available.includes(chartDef)) {
      const container = document.getElementById(`chart-${chartDef.id}`);
      if (container) container.closest('.chart-card').style.display = 'none';
    }
  }

  return newInstances;
}
```

### Pattern 4: Calculation Results Object (Single Return, Multiple Consumers)

**What:** The calculation engine returns a single, comprehensive results object. This object is consumed by the chart renderers, data table renderers, KPI display, and export layers. No consumer reads values from the DOM.

**Why:** The current code reads calculated values *back from the DOM* (`el('directCostManual').textContent`) for PPT generation. This creates invisible coupling between display formatting and business logic.

**Implementation:**

```javascript
// calculations/index.js
export function calculateAll(canonicalData, adjustments) {
  const filtered = applyFilters(canonicalData, adjustments.siteFilter);
  const costs = calculateCosts(filtered, adjustments);
  const projections = calculateProjections(costs, adjustments);
  const trir = calculateTRIR(filtered, adjustments);
  const annualized = annualizeIfNeeded(filtered, adjustments);

  return {
    // Raw aggregations
    totalClaims: filtered.length,
    totalIncurred: filtered.reduce((s, r) => s + r.total_incurred, 0),
    yearRange: getYearRange(filtered),

    // Cost breakdown
    costs: {
      direct: { current: costs.directManual, improved: costs.directImproved },
      indirect: { current: costs.indirectManual, improved: costs.indirectImproved },
      observation: { current: costs.obsCurrent, improved: costs.obsImproved },
      total: { current: costs.totalManual, improved: costs.totalImproved },
      savings: costs.annualSavings,
    },

    // Projections
    projections: { ...projections },

    // TRIR
    trir: { current: trir.manual, improved: trir.improved },

    // Dimension-specific (only populated if data available)
    byCause: costs.byCause || null,
    byBodyPart: costs.byBodyPart || null,
    bySite: costs.bySite || null,
    byYear: costs.byYear || null,
    lostDays: costs.lostDays || null,

    // Metadata
    availableDimensions: detectDimensions(filtered),
    adjustments: { ...adjustments },
    isCustomer: adjustments.isCustomer,
  };
}
```

### Pattern 5: Event Bus for Loose Coupling

**What:** A lightweight publish/subscribe event bus that modules use to communicate state changes without direct imports.

**Why:** When the user changes a site filter or adjustment slider, multiple modules need to react (recalculate, re-render charts, update tables). Direct function calls create a tangle. An event bus keeps modules decoupled.

**Implementation:**

```javascript
// utils/events.js
class EventBus {
  constructor() { this.listeners = {}; }
  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }
}
export const bus = new EventBus();

// Events:
// 'data:loaded'       — canonical data ready after mapping
// 'data:filtered'     — site filter changed
// 'adjustments:changed' — user changed Step 2 inputs
// 'results:calculated'  — calculation engine produced new results
// 'charts:rendered'     — charts finished rendering (PPT export can now capture)
```

## Data Flow

### End-to-End Pipeline

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Excel File  │────▶│   Ingestion   │────▶│  Raw Rows +  │
│  (user drop) │     │   (parser.js) │     │  Header Info │
└──────────────┘     └───────────────┘     └──────┬───────┘
                                                   │
                     ┌───────────────┐             │
                     │ Column Mapping│◀────────────┘
                     │  (engine.js)  │
                     │               │──── User confirms/adjusts mappings
                     └───────┬───────┘
                             │
                     ┌───────▼───────┐     ┌──────────────┐
                     │  Canonical    │────▶│   Data Store  │
                     │  Transform   │     │  (store.js)  │
                     │ (canonical.js)│     │              │
                     └───────────────┘     └──────┬───────┘
                                                   │
                     ┌───────────────┐             │
                     │  Calculation  │◀────────────┘
                     │   Engine      │◀──── User adjustments (Step 2)
                     │ (index.js)    │
                     └───────┬───────┘
                             │
                   ┌─────────▼─────────┐
                   │  Results Object   │
                   │  (all metrics,    │
                   │   all dimensions) │
                   └────┬────┬────┬────┘
                        │    │    │
              ┌─────────┘    │    └──────────┐
              ▼              ▼               ▼
        ┌──────────┐  ┌──────────┐   ┌──────────┐
        │  Chart   │  │  Data    │   │  Export  │
        │ Registry │  │  Tables  │   │ (PPT +   │
        │ + Render │  │ Renderer │   │  Excel)  │
        └──────────┘  └──────────┘   └──────────┘
```

### Key Data Flow Rules

1. **Data flows down, events flow up.** Modules receive data as arguments. They emit events when they produce output.
2. **No DOM reading for data.** The calculation engine never reads `el('someInput').value`. Instead, the UI layer collects form values into an `adjustments` object and passes it.
3. **The Results Object is the API boundary.** Charts, tables, and exports all consume the same Results Object. If a chart needs data the Results Object doesn't have, the calculation engine is extended — the chart never reaches into raw data directly.
4. **Mappings determine available dimensions.** The `availableDimensions` set in the Results Object drives what charts, tables, and PPT slides are generated.

## Build Approach

### Option A: Cloudflare Workers Static Assets (Recommended)

Use the **Workers Static Assets** feature to serve the client SPA as static files, with the Worker handling only edge logic (headers, future API routes).

**wrangler.jsonc:**
```jsonc
{
  "name": "lossrun",
  "main": "src/worker.js",
  "compatibility_date": "2025-12-10",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  },
  // ... existing routes, observability
}
```

**Build pipeline:**
```jsonc
// package.json scripts
{
  "scripts": {
    "build:css": "cp src/client/styles/main.css dist/styles/main.css",
    "build:html": "cp src/client/index.html dist/index.html",
    "build:js": "node build.js",
    "build": "npm run build:js && npm run build:css && npm run build:html",
    "dev": "npm run build && wrangler dev",
    "deploy": "npm run build && wrangler deploy"
  }
}
```

```javascript
// build.js — esbuild script for client bundle
import { build } from 'esbuild';

await build({
  entryPoints: ['src/client/app.js'],
  bundle: true,
  outfile: 'dist/app.bundle.js',
  format: 'esm',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: true,
  // SheetJS, Chart.js, PptxGenJS loaded from CDN — mark as external
  external: [],
  // Or bundle them in (removes CDN dependency):
  // No externals, npm install them and import directly
});
```

**Worker becomes trivially thin:**
```javascript
// src/worker.js — with static assets, this only handles non-asset requests
export default {
  async fetch(request, env) {
    // Future: API routes, auth, etc.
    // Static assets served automatically by Workers runtime
  }
};
```

**Why this approach:**
- Cloudflare caches static assets at the edge automatically (ETag, tiered caching)
- Client JS is a proper bundled file, not a template literal
- Hot module replacement possible with Vite plugin (future DX improvement)
- Clean separation: Worker code vs client code
- `wrangler dev` watches the `dist/` directory and rebuilds

**Source:** [Cloudflare Workers Static Assets docs](https://developers.cloudflare.com/workers/static-assets/) (verified 2026-02-12). Confidence: HIGH.

### Option B: Custom Build + HTML Template Import (Simpler Migration)

If static assets feels like too big a jump, use Wrangler's custom build to bundle client JS, then import the HTML as a text module.

**wrangler.jsonc:**
```jsonc
{
  "name": "lossrun",
  "main": "src/worker.js",
  "build": {
    "command": "node build.js",
    "watch_dir": "src/client"
  }
}
```

```javascript
// src/worker.js
import html from '../dist/index.html';

export default {
  async fetch(request) {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
    });
  }
};
```

Wrangler natively imports `.html` files as strings — no special loader config needed. The custom build bundles client JS into a `<script>` tag referenced in the HTML.

**Source:** [Wrangler Bundling docs](https://developers.cloudflare.com/workers/wrangler/bundling/) (verified 2026-02-12). Confidence: HIGH.

### Recommendation

**Start with Option B** (custom build + HTML import) for the initial refactor. It's the smallest delta from the current architecture (Worker returns HTML string). Migrate to **Option A** (static assets) once the module structure is stable, to get edge caching and cleaner separation.

### CDN Libraries vs NPM Bundling

The current app loads SheetJS, Chart.js, and PptxGenJS from CDN `<script>` tags and accesses them as globals (`XLSX`, `Chart`, `pptxgen`).

**Keep CDN approach initially.** These are large libraries (SheetJS alone is ~500KB). Loading from CDN:
- Leverages browser caching across visits
- Avoids bloating the Worker bundle (important for Worker size limits)
- Simplifies the build — no need to configure tree-shaking for complex libraries

**Long-term:** Consider `npm install` + bundling once you move to static assets (Option A), where there's no Worker size limit concern for the client bundle. This gives you import-based access and better TypeScript support.

## Anti-Patterns

### Anti-Pattern 1: DOM as Data Store

**What:** Reading calculated values from DOM elements (`el('totalManual').textContent`) to pass to other consumers (PPT export, Excel export).

**Why bad:** Creates invisible coupling. If you change a DOM element's ID, format, or structure, exports silently break. Values lose precision through display formatting (e.g., `$1,234` → need to parse back to `1234`).

**Instead:** The calculation engine returns a Results Object. All consumers (UI, charts, PPT, Excel) read from this object. The DOM is write-only from the app's perspective.

### Anti-Pattern 2: God Function

**What:** A single `drawCharts()` function that contains all chart configurations inline (currently ~500 lines).

**Why bad:** Adding a chart means editing a massive function. Charts can't be tested independently. No way to conditionally skip a chart without `if` spaghetti.

**Instead:** Chart registry pattern. Each chart is a self-contained module that receives data and returns a Chart instance. The registry orchestrates which charts render.

### Anti-Pattern 3: Hardcoded Chart Visibility

**What:** HTML contains all chart containers statically. Charts with no data show "No data available" messages via manual checks.

**Why bad:** The HTML has containers for charts that might never render. Adding a new chart requires editing both HTML and JS. The visibility logic is scattered across `drawCharts()`.

**Instead:** Generate chart containers dynamically from the registry. Only create DOM elements for charts that will actually render. The HTML contains a single `<div id="charts-container">` that the registry populates.

### Anti-Pattern 4: Monolithic Template Literal

**What:** Entire HTML + CSS + JS in a single template literal string inside the Worker file.

**Why bad:** No syntax highlighting, no linting, no IDE support for the embedded HTML/CSS/JS. Escaping issues (`<\/script>`). Impossible to import modules. Can't use build tools.

**Instead:** Separate files for HTML, CSS, and JS modules. Build step combines them. Worker imports or serves the built output.

### Anti-Pattern 5: Duplicated Color/Style Constants

**What:** Chart colors defined as inline arrays in multiple places within `drawCharts()`.

**Why bad:** Brand color changes require finding and updating every occurrence. Easy to end up with inconsistent palettes.

**Instead:** Single `theme.js` that exports color palettes, font settings, and Chart.js defaults. All chart renderers import from theme.

## Integration Points

### SheetJS (Excel Parsing)

- **Used by:** `ingestion/parser.js`, `export/excel.js`
- **Interface:** Global `XLSX` object (CDN) or `import * as XLSX from 'xlsx'` (npm)
- **Key methods:** `XLSX.read()`, `XLSX.utils.sheet_to_json()`, `XLSX.utils.book_new()`, `XLSX.writeFile()`
- **Note:** Parser module wraps SheetJS calls so the rest of the app never touches SheetJS directly. This isolates the library dependency.

### Chart.js (Visualization)

- **Used by:** `charts/renderers/*.js`
- **Interface:** Global `Chart` object (CDN) or `import { Chart } from 'chart.js'` (npm)
- **Key concern:** Chart instances must be destroyed before re-creation (memory leaks). The registry manages instance lifecycle.
- **PPT integration:** Charts are captured as PNG via `canvas.toDataURL()` for embedding in slides.

### PptxGenJS (PowerPoint Export)

- **Used by:** `export/ppt.js`, `export/ppt-slides/*.js`
- **Interface:** Global `pptxgen` (CDN) or `import PptxGenJS from 'pptxgenjs'` (npm)
- **Key concern:** Needs access to both the Results Object (for data/text) and chart canvases (for images). The PPT module receives both as arguments — it never reaches into the DOM.

### Event Flow Between Modules

```
User drops file
  → ingestion/parser.js: parse Excel
  → bus.emit('file:parsed', { workbook, sheets })

User selects sheet
  → ingestion/sheet-selector.js: extract headers + samples
  → mapping/engine.js: auto-score mappings
  → bus.emit('mapping:suggested', { scores })

User confirms mappings
  → mapping/canonical.js: transform to canonical data
  → core/store.js: store canonical data
  → bus.emit('data:loaded', { canonicalData, mappings })

User changes adjustments (Step 2)
  → ui/adjustments-ui.js: collect form values
  → bus.emit('adjustments:changed', { adjustments })

Navigate to Step 3 (or adjustments change while on Step 3)
  → calculations/index.js: calculateAll(data, adjustments)
  → bus.emit('results:calculated', { results })

Results calculated
  → charts/registry.js: renderAllCharts(results)
  → tables/renderer.js: renderAllTables(results)
  → ui/results-ui.js: update KPI tiles
  → bus.emit('charts:rendered')

User clicks Export PPT
  → export/ppt.js: buildDeck(results, chartCanvases)
  → PptxGenJS writes file

User clicks Export Excel
  → export/excel.js: buildWorkbook(results, canonicalData)
  → SheetJS writes file
```

## Scalability Considerations

| Concern | Current (v1) | Future Consideration |
|---------|-------------|---------------------|
| Multiple file upload | Single file only | Store should support merging datasets from multiple files into one canonical dataset |
| File size | Client-side parsing handles up to ~10MB well | For very large files, consider Web Workers for parsing to avoid UI freeze |
| Chart count | ~11 chart types | Registry pattern supports unlimited chart types — just add renderers |
| Export size | Single PPT/Excel | Architect PPT slides as composable units for future template customization |
| Column mapping presets | None (auto-detect each time) | Store known carrier formats as mapping presets that bypass auto-detection |

## Sources

- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) — verified 2026-02-12, HIGH confidence
- [Cloudflare Wrangler Bundling](https://developers.cloudflare.com/workers/wrangler/bundling/) — verified 2026-02-12, HIGH confidence
- [Cloudflare Wrangler Custom Builds](https://developers.cloudflare.com/workers/wrangler/custom-builds/) — verified 2026-02-12, HIGH confidence
- [Azure Data Factory Column Patterns](https://learn.microsoft.com/en-us/azure/data-factory/concepts-data-flow-column-pattern) — pattern inspiration for schema-drift-tolerant mapping
- [dc.js Chart Registry Pattern](https://dc-js.github.io/dc.js/docs/html/core_chart-registry.js.html) — pattern inspiration for grouped chart management
- [Clean Architecture in Frontend (Feature-Sliced Design)](https://feature-sliced.design/blog/frontend-clean-architecture) — layered architecture principles
- Current codebase audit: `src/worker.js` (3,348 lines) — all patterns derived from actual code structure analysis
