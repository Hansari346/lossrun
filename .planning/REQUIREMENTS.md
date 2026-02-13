# Requirements: Loss Run Analyzer

**Defined:** 2026-02-12
**Core Value:** Reliably ingest any carrier's loss run format and produce a compelling, data-rich analysis showing the financial impact of workplace injuries and how Voxel reduces them.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure & Refactoring

- [x] **INFRA-01**: Codebase refactored from monolithic single file into modular TypeScript with build tooling (Vite)
- [x] **INFRA-02**: HTML, CSS, and JavaScript extracted from template literal into proper source files
- [x] **INFRA-03**: State management decoupled from DOM — global state object instead of reading from DOM elements
- [x] **INFRA-04**: Calculation engine is pure functions that accept inputs and return a results object (no DOM access)
- [x] **INFRA-05**: All downstream consumers (charts, tables, PPT, Excel) read from the shared results object

### Data Ingestion

- [x] **INGEST-01**: Improved fuzzy column mapping with expanded synonym dictionary covering real carrier naming conventions
- [x] **INGEST-02**: Generic/composite field parsing — detect "Key: Value" patterns in columns like "Generic Field 1" and extract them as separate mappable dimensions
- [x] **INGEST-03**: Smart multi-sheet detection — auto-identify which sheets contain claims-level data vs. summary/cover sheets
- [x] **INGEST-04**: Data validation with quality summary — flag invalid dates, unparseable amounts, missing required fields, with per-row error counts
- [x] **INGEST-05**: Robust date parsing — handle MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, SheetJS serial numbers, and various date formats seen in carrier files
- [x] **INGEST-06**: Robust currency parsing — handle $, $$, parenthetical negatives, European formatting, and comma separators

### Dimension Detection

- [x] **DIM-01**: After column mapping, auto-detect which analysis dimensions are available in the data (cause of loss, body part, department, lost days, etc.)
- [x] **DIM-02**: Dimension availability drives downstream behavior — charts, tables, PPT slides, and exports adapt to what's available
- [x] **DIM-03**: User can see which dimensions were detected and confirm/override

### Visualization

- [ ] **VIS-01**: Adaptive chart rendering — only show charts that have data to support them; no empty or broken charts
- [ ] **VIS-02**: Data table alongside every chart showing exact underlying values (visible in the web app)
- [ ] **VIS-03**: Department/location breakdown chart — when department or multi-location data is available
- [ ] **VIS-04**: Lost time & restricted days analysis — when lost_days or restricted_days fields are mapped
- [ ] **VIS-05**: All existing chart types preserved (loss trend, category breakdown, cost comparison, projections, TRIR, payback, site comparison, observation cost decomposition)
- [ ] **VIS-06**: Charts use Voxel brand colors and professional styling

### Export — PowerPoint

- [ ] **PPT-01**: Professional Voxel-branded deck with clean layout, proper typography, and logo
- [ ] **PPT-02**: Narrative structure — Title → Executive Summary → Loss Trend → Category Deep Dives → Voxel Impact → ROI Summary → Appendix
- [ ] **PPT-03**: Conditional slides — only include sections that have data backing them
- [ ] **PPT-04**: High-quality chart rendering in slides (not blurry rasterized screenshots)
- [ ] **PPT-05**: Data tables included in PPT (appendix or alongside charts)

### Export — Excel

- [ ] **XLS-01**: Excel export with multi-tab workbook containing all underlying data tables
- [ ] **XLS-02**: Tabs include: Summary metrics, per-chart data tables, raw mapped data
- [ ] **XLS-03**: Formatted with headers, column widths, number formatting

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Smart Ingestion

- **SMART-01**: Carrier format fingerprinting — auto-detect carrier from column signatures
- **SMART-02**: Mapping template save/reuse — persist mappings for repeat carrier formats
- **SMART-03**: Confidence-scored column suggestions — show match confidence percentages
- **SMART-04**: Data quality scorecard — detailed per-field quality metrics

### Advanced Analysis

- **ADV-01**: Time-of-day heatmap — injury timing patterns by hour and day of week
- **ADV-02**: Tenure analysis — injuries by months/years employed
- **ADV-03**: Litigation analysis — litigation rate and cost multiplier
- **ADV-04**: Severity tiering — auto-categorize claims into MO / Indemnity / Catastrophic
- **ADV-05**: Narrative annotations on charts — auto-generated callouts
- **ADV-06**: Interactive chart filtering — click to drill into categories
- **ADV-07**: Pareto analysis — 80/20 cost concentration

### Advanced Export

- **EXP-01**: PDF export with print-optimized layout
- **EXP-02**: Customizable deck sections — choose which slides to include
- **EXP-03**: Per-chart PNG/SVG export

### UX Enhancements

- **UX-01**: Data preview table before proceeding (first 5-10 mapped rows)
- **UX-02**: Client name input appearing on all outputs
- **UX-03**: Analysis date range selector
- **UX-04**: Assumption scenario comparison (side-by-side Conservative vs Aggressive)

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI/LLM-powered column mapping | Nondeterministic, adds API dependency, overkill for structured data |
| Server-side data processing | Privacy — loss run data must stay in browser |
| User accounts or saved sessions | Adds infrastructure complexity for no user value |
| Mobile-optimized layout | Desktop tool used in meetings |
| Multiple file upload per session | Architecture should support it, but v1 handles one file |
| Carrier API integrations | Massive undertaking per carrier; file upload is sufficient |
| Actuarial projection models | Complex, easy to get wrong, users have actuaries for that |
| Benchmarking against industry averages | Requires maintaining NCCI data, misleading without credibility weighting |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 — Foundation & Build Infrastructure | Complete |
| INFRA-02 | Phase 1 — Foundation & Build Infrastructure | Complete |
| INFRA-03 | Phase 1 — Foundation & Build Infrastructure | Complete |
| INFRA-04 | Phase 3 — Calculation Engine & Dimension Detection | Complete |
| INFRA-05 | Phase 3 — Calculation Engine & Dimension Detection | Complete |
| INGEST-01 | Phase 2 — Data Ingestion Pipeline | Complete |
| INGEST-02 | Phase 2 — Data Ingestion Pipeline | Complete |
| INGEST-03 | Phase 2 — Data Ingestion Pipeline | Complete |
| INGEST-04 | Phase 2 — Data Ingestion Pipeline | Complete |
| INGEST-05 | Phase 2 — Data Ingestion Pipeline | Complete |
| INGEST-06 | Phase 2 — Data Ingestion Pipeline | Complete |
| DIM-01 | Phase 3 — Calculation Engine & Dimension Detection | Complete |
| DIM-02 | Phase 3 — Calculation Engine & Dimension Detection | Complete |
| DIM-03 | Phase 3 — Calculation Engine & Dimension Detection | Complete |
| VIS-01 | Phase 4 — Adaptive Visualization & Data Tables | Pending |
| VIS-02 | Phase 4 — Adaptive Visualization & Data Tables | Pending |
| VIS-03 | Phase 4 — Adaptive Visualization & Data Tables | Pending |
| VIS-04 | Phase 4 — Adaptive Visualization & Data Tables | Pending |
| VIS-05 | Phase 4 — Adaptive Visualization & Data Tables | Pending |
| VIS-06 | Phase 4 — Adaptive Visualization & Data Tables | Pending |
| PPT-01 | Phase 5 — PowerPoint Export | Pending |
| PPT-02 | Phase 5 — PowerPoint Export | Pending |
| PPT-03 | Phase 5 — PowerPoint Export | Pending |
| PPT-04 | Phase 5 — PowerPoint Export | Pending |
| PPT-05 | Phase 5 — PowerPoint Export | Pending |
| XLS-01 | Phase 6 — Excel Export | Pending |
| XLS-02 | Phase 6 — Excel Export | Pending |
| XLS-03 | Phase 6 — Excel Export | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-13 after Phase 3 completion*
