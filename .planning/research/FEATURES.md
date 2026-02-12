# Feature Research

**Domain:** Insurance loss run analysis tool (safety technology ROI demonstration)
**Researched:** 2026-02-12
**Confidence:** HIGH — Domain is well-understood, sources include industry standards (OSHA, NCCI), competitor analysis (Cognisure, SortSpoke, Gradient AI), and established insurance analytics patterns. Voxel-specific context from PROJECT.md provides strong grounding.

---

## Feature Landscape

### Table Stakes

Features users expect. Missing any of these makes the tool feel incomplete or untrustworthy.

#### Data Ingestion

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-format Excel parsing** | Carriers deliver .xlsx, .xls, .csv; users won't convert formats | Low | SheetJS already handles this. Ensure .csv and .xls support is tested. |
| **Header row auto-detection** | Carrier files have metadata rows before actual headers (company name, report date, etc.) | Medium | Current implementation scans first 20 rows — adequate starting point. Needs to handle merged cells, blank rows, and multi-line headers. |
| **Fuzzy column name matching** | Column names vary wildly ("Total Incurred" vs "Incurred Amount" vs "total_incurred") | Medium | Current implementation exists but is inadequate. Must handle: snake_case, camelCase, abbreviations ("DOL" = Date of Loss), and common synonyms. |
| **Generic/composite field parsing** | Critical data buried in "Generic Field 1-8" as prefixed strings like `"Nature of Injury: Contusion"` | High | This is a real problem seen in 96-column carrier files. Must detect prefix patterns (`Key: Value`) and extract structured data from generic columns. |
| **Multi-sheet workbook handling** | Carrier files have 31+ sheets (AMIC example); data may be spread across sheets or sheets may represent different sites/years | Medium | Must detect which sheets contain claims data vs. summary/cover sheets. Let user confirm sheet selection. |
| **Required vs optional field distinction** | Users need to know what's minimally required vs. what enables richer analysis | Low | Required: Date of Loss, Total Incurred (or components). Everything else is optional and enables additional analysis dimensions. |
| **Manual column mapping override** | Fuzzy matching will be wrong sometimes; users must be able to correct | Low | Already exists. Keep it — dropdown per canonical field with "Unmapped" option. |
| **Data preview before proceeding** | Users need to verify the mapping looks right before running analysis | Low | Show first 5-10 rows of mapped data in a table. Current implementation lacks this. |
| **Basic validation with clear error messages** | Bad data (text in numeric fields, missing required columns) must surface clearly | Medium | Validate: dates parse correctly, incurred amounts are numeric, no negative costs, claim count is reasonable. Show per-row error counts, not just "invalid data." |

#### Analysis & Calculations

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Loss frequency analysis** | Claim count by period — the most basic loss run metric | Low | Count of claims per year/quarter. |
| **Loss severity analysis** | Average cost per claim and total incurred by period | Low | Total incurred / claim count. Distinguish medical-only from indemnity if data available. |
| **Trend over time** | Year-over-year or quarter-over-quarter loss trends | Low | Line chart with incurred amounts over time. The core story of any loss run analysis. |
| **Loss breakdown by category** | Split losses by cause of loss, nature of injury, body part | Medium | Pie/bar charts. Only render categories that exist in the data. |
| **Open vs. closed claim distinction** | Open claims have reserves that will develop; closed claims are final | Medium | Critical for accuracy — total incurred = paid + outstanding reserves. Open claims inflate projected costs. Must flag or separate them. |
| **Incurred = Paid + Reserves math** | Standard insurance accounting identity | Low | Validate this relationship holds. If file provides all three, cross-check. If only incurred, note reserves aren't separated. |
| **Current vs. improved comparison** | Before/after Voxel — the whole point of the tool | Low | Already exists. Two modes: Prospect (projected) and Customer (realized). |
| **Configurable improvement assumptions** | Different assumptions for different scenarios | Low | Already exists with Conservative / Balanced / Aggressive presets. |
| **Site/location filtering** | Multi-site employers need per-facility analysis | Low | Already exists. Keep it. |

#### Visualization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Loss trend line chart** | Most fundamental insurance visualization — incurred over time | Low | Already exists. |
| **Category breakdown bar/pie charts** | Cause, nature, body part distributions | Low | Already exists but static. Must become adaptive. |
| **Current vs. projected comparison charts** | Side-by-side or overlay showing Voxel's impact | Low | Already exists. |
| **Summary KPI cards** | Total incurred, claim count, average severity, projected savings — at a glance | Low | Already exists as "summary KPI tiles." |
| **Data table alongside every chart** | Users need to see exact numbers, not just shapes | Medium | **Currently missing — this is a key gap.** Every chart should have a toggleable or adjacent data table showing the underlying numbers. |
| **Responsive chart rendering** | Charts must look good on the screen, not just in export | Low | Chart.js handles this. Ensure proper aspect ratios and readable labels. |

#### Export

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **PowerPoint deck export** | Primary deliverable for sales meetings and CS reviews | High | Already exists but poorly formatted. Must be professionally branded with clean layouts. |
| **Branded output** | Voxel colors, logo, professional typography | Medium | Non-negotiable for a sales tool. Every exported artifact must look like it came from a polished product. |

#### UX / Workflow

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Wizard flow** | Step-by-step reduces cognitive load for non-technical users | Low | Already exists as 3-page wizard. Good pattern — keep it. |
| **Prospect vs. customer mode** | Fundamentally different calculations and narratives | Low | Already exists. |
| **Progress indication** | Users need to know where they are in the workflow | Low | Step indicator in wizard. |
| **Error recovery** | If mapping fails or data is bad, don't force restart | Medium | Let users go back a step, re-map columns, or fix data. |

---

### Differentiators

Features that set the tool apart. Not expected, but create "wow" moments and competitive advantage.

#### Smart Ingestion

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Carrier format fingerprinting** | Auto-detect carrier format from column signatures and suggest known mapping templates | High | Build a registry of carrier "fingerprints" (column name sets). When a file matches a known fingerprint, apply pre-built mapping. Saves minutes per analysis and eliminates mapping errors. |
| **Mapping template save/reuse** | Once a mapping is built for a carrier, save it for next time | Medium | If the same carrier format is seen again, auto-apply. Huge time-saver for repeat carriers. Persisted in-browser (localStorage) or exported as JSON. |
| **Confidence-scored column suggestions** | Show match confidence (95%, 72%, 41%) so users know which mappings to verify | Low | Already doing fuzzy matching — exposing the score is trivial but builds trust. |
| **Data quality scorecard** | After ingestion, show: "87% of rows have valid dates, 3 rows have negative incurred, 12 claims missing cause of loss" | Medium | Gives users immediate confidence in data quality. Flags issues before they corrupt analysis. |
| **Composite field auto-detection** | Automatically detect "Key: Value" patterns in generic fields and offer to extract them as separate dimensions | High | Handles the "Generic Field 1-8" problem seen in 96-column files. Scan column values for consistent prefix patterns and offer structured extraction. |

#### Rich Analysis Dimensions

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Department/location breakdown** | Show which departments or locations drive the most loss — targets Voxel deployment | Medium | Requires department data in the file. When available, this is extremely high-value for showing where to deploy cameras. |
| **Time-of-day analysis** | Show injury patterns by hour — identifies shift-related risks | Medium | Requires "Hour of Day" or time component in date of loss. Present as histogram or heatmap. Directly maps to Voxel's 24/7 monitoring value prop. |
| **Tenure analysis** | Injuries by months/years employed — new worker risk is a known pattern (40% of injuries in first year per OSHA data) | Medium | Requires hire date or "Months Employed." Strong Voxel story: "New workers are most at-risk, and Voxel catches unsafe behavior in real-time before injuries happen." |
| **Litigation analysis** | Show litigation rate and cost multiplier — litigated claims cost 3x more and last 2x longer | Medium | Requires litigation status field. Per Gradient AI research, claims with legal involvement cost $38K more. Powerful ROI argument: reduce injury frequency → reduce litigation exposure. |
| **Claim status segmentation** | Separate open/closed claims in analysis — open claims will develop and shouldn't be treated as final | Medium | Avoids undercounting open claim costs. Show development factor or flag open claims with reserves. |
| **Lost time & restricted days analysis** | Show total lost workdays and restricted days — translates injuries to operational impact | Medium | Requires lost_days/restricted_days fields (present in DV/Sedgwick format). Powerful: "Your workers missed X days last year. Voxel could have prevented Y of those." |
| **Severity tiering** | Automatically categorize claims into Medical-Only / Indemnity / Catastrophic based on cost thresholds | Low | Industry standard tiers: Medical-Only (<$2K-5K), Lost Time/Indemnity ($5K-$100K), Severe/Catastrophic (>$100K). Different intervention stories for each tier. |

#### Adaptive Visualization

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Dimension-aware chart registry** | Charts auto-appear based on what data dimensions are available — no empty/broken charts | High | **This is the single most impactful differentiator.** Currently 11 static charts, many meaningless without the right data. Should be: detect available dimensions → select applicable charts → render only what's meaningful. |
| **Interactive chart filtering** | Click a bar segment to drill into that category; filter charts by site/department/year | Medium | Turns static report into exploratory tool. Especially valuable in live meetings where stakeholders ask "what about Department X?" |
| **Chart + table toggle** | Every visualization can be viewed as chart or table, with the table showing exact values | Medium | Addresses the "I need the actual numbers" complaint. Table should be sortable and include totals/averages. |
| **Narrative annotations on charts** | Auto-generated callouts: "Largest category: Sprains & Strains (34%, $1.2M)" | Medium | Reduces cognitive load. Sales team doesn't have to interpret charts for prospects — the tool does it. |
| **Heatmap for time/day patterns** | Hour-of-day x day-of-week heatmap showing when injuries occur | Medium | Visually striking, immediately actionable. Shows shift patterns, weekend vs. weekday risk. |
| **Pareto analysis** | Show that 20% of causes drive 80% of costs — focuses the conversation | Low | Classic analytics pattern. Sort categories by cost, add cumulative % line. |

#### Professional Export

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Narrative-structured PPT** | Deck follows a story: Problem → Solution → Impact with section dividers, executive summary, and per-dimension deep dives | High | Current PPT is poorly formatted. New structure: (1) Title + client name, (2) Executive summary KPIs, (3) Loss trend story, (4) Category deep dives, (5) Voxel impact projection, (6) Appendix with data tables. |
| **Excel data export** | Export all underlying data tables as a formatted Excel workbook with multiple tabs | Medium | For users who want to do their own analysis or verify numbers. Tabs: Raw Data, Summary, Category Breakdown, Trend Data, etc. |
| **PDF export** | One-click PDF for email/print distribution | Low | Can be done via browser print-to-PDF with a print stylesheet, or via a PDF library. Lower priority than PPT. |
| **Per-chart export** | Right-click or button to export individual charts as PNG/SVG | Low | Chart.js supports `toBase64Image()`. Useful for embedding in emails or other decks. |
| **Customizable deck sections** | Let user choose which sections/charts to include in the PPT | Medium | Not everyone needs all 11+ charts. Checkbox list before export: "Include time-of-day analysis? Include department breakdown?" |

#### Advanced UX

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Client name / branding input** | Enter prospect/customer name → appears on title slides, chart headers, file names | Low | Small touch with big professional impact. "ACME Corp Loss Run Analysis — Prepared by Voxel" |
| **Analysis date range selector** | Choose which policy periods to include in analysis | Medium | Some files contain 5+ years of data. Let user select "2023-2025 only" or "Last 3 years." |
| **Assumption scenario comparison** | Side-by-side: "What if Conservative vs. Aggressive assumptions?" | Medium | Lets sales show range of outcomes. Builds credibility: "Even conservatively, you'd save $X." |
| **Shareable URL with encoded state** | Encode analysis parameters in URL for sharing (no data, just config) | Medium | Can't share data (privacy), but could share assumption settings via URL params. |

---

### Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **AI/LLM-powered column mapping** | Nondeterministic, hard to debug, overkill for structured data, adds latency and API dependency | Use deterministic fuzzy matching with a synonym dictionary + carrier fingerprints. Predictable, fast, no API key needed. PROJECT.md explicitly marks this out of scope. |
| **Server-side data processing** | Loss run data is sensitive (employee names, injury details, costs). Sending to a server creates privacy/compliance risk. | Keep everything client-side. Data never leaves the browser. This is a feature, not a limitation. |
| **Auto-generated written analysis** | AI-written paragraphs about the data feel generic and can be wrong. Sales team has their own narrative. | Provide data callouts and annotations, not paragraphs. Let the numbers speak. |
| **Actuarial projection models** | Development factors, IBNR estimation, credibility weighting — these are complex actuarial techniques that are easy to get wrong and hard to explain to non-actuaries. | Stick to simple before/after comparisons with configurable assumptions. If users need actuarial analysis, they have actuaries. |
| **Real-time carrier data integrations** | Connecting to carrier APIs is a massive undertaking with different APIs, credentials, and data formats per carrier. | Accept file uploads. It's what users already do and avoids integration maintenance. |
| **User accounts and saved sessions** | Adds infrastructure complexity, auth flows, and data storage responsibility. Out of scope per PROJECT.md. | Keep the tool stateless. Users re-upload files each time. Consider localStorage for mapping templates only. |
| **Mobile-optimized layout** | This is a desktop tool used in meetings with shared screens. Mobile optimization adds complexity for zero user value. | Desktop-first. Ensure it works on common laptop resolutions (1366x768 to 1920x1080). |
| **Overcomplicated chart interactions** | Tooltips-within-tooltips, animated transitions, 3D charts, draggable chart elements — these impress in demos but frustrate in daily use. | Simple, readable charts with clean hover tooltips. Click-to-filter is useful; drag-to-zoom is not. |
| **Benchmarking against industry averages** | Requires maintaining NCCI/state bureau data, varies by class code and state, and is misleading without proper credibility weighting. | Focus on client's own data trajectory and Voxel's impact. "You improved 30%" is more compelling than "You're 5% below industry average." |

---

## Feature Dependencies

```
Excel Upload
  └→ Header Row Detection
      └→ Column Mapping (fuzzy + manual override)
          ├→ Generic Field Parsing (extracts embedded dimensions)
          ├→ Data Validation & Quality Scorecard
          └→ Canonical Data Array
              ├→ Dimension Detection (what fields are available?)
              │   └→ Chart Registry Selection (adaptive charts)
              │       ├→ Chart Rendering (Chart.js)
              │       │   ├→ Data Tables (alongside charts)
              │       │   └→ Interactive Filtering (click-to-drill)
              │       └→ Narrative Annotations (auto callouts)
              ├→ Calculation Engine
              │   ├→ Frequency/Severity Metrics
              │   ├→ Trend Analysis
              │   ├→ Category Breakdowns
              │   ├→ Advanced Dimensions (dept, tenure, time, litigation)
              │   └→ ROI Projections (current vs. improved)
              └→ Export Pipeline
                  ├→ PowerPoint (narrative-structured, branded)
                  ├→ Excel (multi-tab data tables)
                  └→ Per-chart PNG export
```

**Key dependency insight:** The dimension detection layer is the critical gate. Everything downstream — which charts render, which tables appear, which PPT slides are included — depends on knowing what data is actually available. Build this layer robustly first.

---

## MVP Definition

The MVP must solve the three core pain points: (1) handle varied carrier formats reliably, (2) produce adaptive visualizations, and (3) generate professional export output.

### MVP Must-Have

1. **Improved column mapping** — fuzzy matching with synonym dictionary, manual override, data preview
2. **Generic field parsing** — detect and extract `Key: Value` patterns from composite columns
3. **Dimension detection** — scan mapped data to determine what analysis dimensions are available
4. **Adaptive chart rendering** — only show charts that have data to back them; minimum set: loss trend, category breakdown, severity distribution, current vs. projected
5. **Data table alongside each chart** — toggleable table showing underlying numbers
6. **Branded PowerPoint export** — clean layout with narrative structure: Title → Summary → Trend → Categories → Impact → Appendix
7. **Basic validation** — flag bad data before analysis, show quality summary
8. **Client name input** — appears on all outputs

### MVP Defer

- Carrier fingerprinting / template save (valuable but not blocking)
- Interactive chart filtering / drill-down (nice but not required for first version)
- Excel data export (PPT is the primary deliverable)
- PDF export (browser print-to-PDF works as stopgap)
- Time-of-day heatmap, tenure analysis, litigation analysis (enable when data is available, but don't build special visualizations yet — simple bar charts suffice)
- Assumption scenario comparison
- Shareable URLs

---

## Feature Prioritization Matrix

Scored on: **User Impact** (how much it solves the stated problems) x **Effort** (implementation complexity) x **Voxel Story** (how much it strengthens the ROI narrative).

| Priority | Feature | Impact | Effort | Story | Rationale |
|----------|---------|--------|--------|-------|-----------|
| **P0** | Dimension detection layer | Critical | High | Critical | Everything adaptive depends on this. Build first. |
| **P0** | Improved column mapping + synonyms | Critical | Medium | — | Current mapping fails on real carrier data. Blocking issue. |
| **P0** | Generic field parsing | Critical | High | — | 96-column file is unusable without this. Blocking issue. |
| **P0** | Adaptive chart registry | Critical | High | High | Eliminates empty/broken charts. Charts tell a story only when they have data. |
| **P0** | Data tables alongside charts | High | Medium | Medium | Most-requested missing feature. Users need exact numbers. |
| **P0** | Professional PPT export | Critical | High | Critical | PPT is the primary deliverable. Current quality is unacceptable for sales meetings. |
| **P1** | Data validation & quality scorecard | High | Medium | Low | Prevents garbage-in-garbage-out. Builds user trust in results. |
| **P1** | Narrative annotations on charts | Medium | Low | High | Auto-generated callouts strengthen the story without manual interpretation. |
| **P1** | Client name / branding on outputs | Medium | Low | Medium | Small effort, big professional impact. |
| **P1** | Department breakdown | High | Medium | High | "Where to deploy Voxel" — directly actionable for sales. |
| **P1** | Severity tiering | Medium | Low | High | Separates medical-only from catastrophic — different Voxel value prop for each. |
| **P1** | Lost time / restricted days analysis | Medium | Medium | High | Translates injuries to operational impact ("X workdays lost"). |
| **P2** | Carrier fingerprinting | Medium | High | — | Saves time on repeat carriers. Build after mapping is stable. |
| **P2** | Mapping template save/reuse | Medium | Medium | — | Depends on fingerprinting. localStorage persistence. |
| **P2** | Time-of-day heatmap | Medium | Medium | High | Visually striking, supports 24/7 monitoring pitch. |
| **P2** | Tenure analysis | Medium | Medium | High | "40% of injuries in first year" is a powerful stat. |
| **P2** | Litigation analysis | Medium | Medium | High | "Litigated claims cost 3x more" — prevention ROI amplifier. |
| **P2** | Interactive chart filtering | Medium | Medium | Medium | Valuable in live meetings but not required for static analysis. |
| **P2** | Excel data export | Medium | Medium | Low | Secondary deliverable after PPT. |
| **P2** | Customizable deck sections | Medium | Medium | Low | Power feature for experienced users. |
| **P2** | Analysis date range selector | Medium | Low | Low | Useful but users can filter data in Excel before upload. |
| **P3** | Pareto analysis chart | Low | Low | Medium | Nice analytical touch but not critical. |
| **P3** | Assumption scenario comparison | Low | Medium | Medium | Edge case — most users pick one assumption set. |
| **P3** | PDF export | Low | Low | Low | Browser print-to-PDF is adequate. |
| **P3** | Per-chart PNG export | Low | Low | Low | Nice to have. Chart.js makes it trivial. |
| **P3** | Shareable URL with config | Low | Medium | Low | Cool but niche utility. |
| **P3** | Confidence scores on mapping | Low | Low | — | Exposes existing data. Good UX polish. |

---

## Key Metrics (Derivable from Loss Run Data)

These are the metrics the tool should calculate and display when sufficient data is available:

| Metric | Formula | Required Fields | Display |
|--------|---------|-----------------|---------|
| **Total Incurred** | Sum of all incurred amounts | Total Incurred | KPI card |
| **Claim Count** | Count of unique claims | Claim Number or row count | KPI card |
| **Average Severity** | Total Incurred / Claim Count | Total Incurred | KPI card |
| **Loss Frequency** | Claims per period | Date of Loss | Trend chart |
| **Medical vs. Indemnity Split** | Paid Medical / Paid Indemnity | Paid Medical, Paid Indemnity | Pie chart |
| **Open/Closed Ratio** | Open claims / Total claims | Claim Status | KPI card + filter |
| **Lost Workdays** | Sum of lost_days + restricted_days | Lost Days, Restricted Days | KPI card |
| **Litigation Rate** | Litigated claims / Total claims | Litigation Status | KPI card |
| **Top Cause Categories** | Incurred grouped by cause | Cause of Loss | Bar chart |
| **Top Body Parts** | Incurred grouped by body part | Body Part / Part of Body | Bar chart |
| **Projected Savings** | Current costs x improvement assumption | Total Incurred + assumptions | KPI card + comparison chart |
| **ROI Multiple** | Projected savings / Voxel cost | Projected savings + program cost | KPI card |

---

## Visualization Recommendations

Based on insurance analytics best practices and the specific Voxel use case:

| Chart Type | When to Show | Data Required | Purpose |
|------------|-------------|---------------|---------|
| **Line chart** | Always (if multi-period data) | Date of Loss, Total Incurred | Loss trend over time — the foundation |
| **Stacked bar** | If cause/nature data exists | Cause of Loss or Nature of Injury + Incurred | Category breakdown with magnitude |
| **Horizontal bar** | If body part data exists | Body Part + Incurred | Ranked body part costs (easy to read labels) |
| **Grouped bar** | Always | Current vs. Projected totals | Before/after comparison — the ROI story |
| **Donut chart** | If category data exists | Any categorical dimension + Incurred | Part-of-whole distribution (max 6-8 segments) |
| **Heatmap** | If time-of-day data exists | Hour of Day + Day of Week | Injury timing patterns |
| **Histogram** | If tenure data exists | Months Employed | Injury distribution by tenure |
| **Waterfall** | For cost buildup | Multiple cost components | Shows how costs accumulate: Medical → Indemnity → Legal → Indirect |
| **KPI tiles** | Always | Calculated metrics | At-a-glance summary numbers |
| **Data table** | Always (alongside every chart) | Same as associated chart | Exact values for verification and export |

**Color strategy:** Use Voxel brand colors as primary palette. Use a single gradient for sequential data (light to dark). Reserve red/orange for "current/problem" and green/teal for "improved/projected." Keep it to 6-8 distinct colors max.

---

## PowerPoint Structure Recommendation

Based on best practices for data-heavy client decks:

| Slide | Content | Always/Conditional |
|-------|---------|-------------------|
| 1 | **Title** — "Loss Run Analysis: [Client Name]" + Voxel logo + date | Always |
| 2 | **Executive Summary** — 4-6 KPI tiles: Total Incurred, Claim Count, Avg Severity, Projected Savings, ROI Multiple | Always |
| 3 | **Loss Trend** — Line chart + data table showing incurred by period | Always (if multi-period) |
| 4 | **Category Breakdown** — Top causes of loss with costs | Conditional (if cause data) |
| 5 | **Body Part Analysis** — Injury distribution by body part | Conditional (if body part data) |
| 6 | **Department Analysis** — Losses by department/location | Conditional (if department data) |
| 7 | **Timing Analysis** — Time-of-day / tenure patterns | Conditional (if timing data) |
| 8 | **Severity Distribution** — Medical-only vs. indemnity vs. catastrophic | Conditional (if severity data) |
| 9 | **Voxel Impact** — Current vs. projected comparison chart + savings narrative | Always |
| 10 | **ROI Summary** — Investment vs. return, payback period | Always |
| 11+ | **Appendix** — Full data tables for each analysis | Always |

**Key principle:** Slides are conditionally included based on dimension detection. A file with only dates and incurred amounts produces a 5-slide deck. A file with all dimensions produces 11+. The deck is always complete and never has empty slides.

---

## Sources

- **Cognisure Loss 360** — Multi-format extraction, 40-point data model, 99% accuracy claims (cognisure.ai/products/loss-360)
- **Gradient AI Research** — Litigated claims cost 3x more, 15% reduction in legal involvement with AI (gradientai.com)
- **OSHA/NCCI** — EMR calculation methodology, TRIR/DART rate standards, experience rating framework
- **Xceedance** — Loss run processing challenges: lack of standardization, manual re-keying costs (xceedance.com)
- **Insurance Quantified** — Hidden costs of manual loss run processing, incomplete data review patterns (insurancequantified.com)
- **Washington State L&I / California DWC** — Workers comp claims breakdown by body part, cause, nature of injury
- **Flatfile** — AI-powered column mapping patterns, confidence scoring, field categorization (flatfile.com)
- **PptxGenJS docs** — Chart types, table formatting, branded template support (gitbrent.github.io/PptxGenJS)
- **Tableau/BoldBI** — Insurance dashboard patterns: KPIs, chart-table pairings, filtering patterns
- **Voxel** — 77% injury reduction, 100% lost-time reduction, computer vision safety technology (voxelai.com)
