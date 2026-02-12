# Loss Run Analyzer

## What This Is

A web-based tool that ingests insurance carrier loss run spreadsheets, intelligently maps their wildly varying column formats, and produces branded analytical outputs — charts, data tables, and PowerPoint decks — that tell a clear story about a company's safety losses and the projected ROI of Voxel's safety technology. Used by Voxel's sales team (for prospects) and customer success team (for existing customers).

## Core Value

Reliably ingest any carrier's loss run format and produce a compelling, data-rich analysis that shows the financial impact of workplace injuries and how Voxel reduces them.

## Requirements

### Validated

- ✓ Excel file upload and parsing via SheetJS — existing
- ✓ Column auto-mapping with fuzzy matching — existing (but inadequate)
- ✓ 3-page wizard flow (Ingestion → Adjustments → Results) — existing
- ✓ Dual mode: Prospect (projected savings) vs Existing Customer (realized savings) — existing
- ✓ Chart.js visualizations (11 chart types) — existing (but static and not adaptive)
- ✓ PowerPoint export via PptxGenJS — existing (but layout/content/quality are poor)
- ✓ Preset adjustment modes (Conservative / Balanced / Aggressive) — existing
- ✓ Site filtering — existing
- ✓ Observation program cost calculator — existing
- ✓ YTD annualization — existing
- ✓ Deployed as Cloudflare Worker to lossrun.voxelplatform.com — existing

### Active

- [ ] Robust column mapping that handles wildly different carrier formats (different column names, data embedded in "Generic Fields", metadata header rows, multi-sheet workbooks)
- [ ] Auto-detection of available data dimensions — charts and analysis adapt to what's actually in the data
- [ ] Data tables alongside every chart (visible in web app, included in PPT, exportable as Excel)
- [ ] Professional Voxel-branded PowerPoint output with clean layout, proper chart rendering, and narrative flow
- [ ] Richer analysis dimensions: cause buckets, body part, department, time of day, tenure, claim status (open/closed), litigation — when available
- [ ] Clear narrative structure in outputs: "here's your problem → here's what Voxel does → here's the impact"
- [ ] Excel data export of all underlying tables
- [ ] Codebase refactored from monolithic 3,348-line single file into maintainable structure

### Out of Scope

- Multiple file upload in a single session — plan for it architecturally, but not v1
- User accounts or saved sessions — tool is stateless, refresh loses data
- Server-side processing or database — keep it client-side
- Mobile-optimized layout — desktop-first tool used in meetings
- AI/LLM-powered column mapping — stick with deterministic matching for now

## Context

### The Problem

Voxel is a safety technology company. Their sales and CS teams analyze carrier loss run data to demonstrate ROI. Loss runs are standardized in *concept* (claims data with dates, costs, descriptions) but wildly different in *format* across carriers:

- **AMIC format**: 43 columns, 31 sheets, Cause Of Loss Category, granular paid/reserve splits
- **Standard Loss Run format**: 96 columns, critical data buried in "Generic Field 1-8" columns like `"Nature of Injury: Contusion"`
- **DV/Sedgwick format**: 48 columns, clean snake_case, cause_bucket groupings, lost_days/restricted_days

The current tool handles column variety poorly. Its fuzzy matching fails on formats it wasn't designed for, and it ignores most of the rich data these files contain.

### Current State

Single `src/worker.js` file (3,348 lines) containing all HTML, CSS, and JavaScript as a template literal. Cloudflare Worker serves this as a static HTML page. No build tools, no TypeScript, no framework, no tests. Client-side libraries loaded from CDN: SheetJS, Chart.js, PptxGenJS.

### Who Uses It

- **Sales team**: Upload a prospect's loss run, configure assumptions, generate a branded PPT deck showing projected savings
- **Customer success team**: Upload an existing customer's loss run, show before/after analysis demonstrating Voxel's impact

## Constraints

- **Platform**: Cloudflare Workers — keep deployment simple, open to evolving architecture but stay lightweight
- **Client-side processing**: No server-side data handling — loss run data stays in the browser
- **Single file upload**: v1 handles one file at a time (architecture should support multi-file later)
- **Branding**: Output must be Voxel-branded (colors, logo, professional look)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep as Cloudflare Worker | Simple deployment, no server-side data handling needed | — Pending |
| Client-side only processing | Privacy — loss run data never leaves the browser | — Pending |
| Refactor monolith into modules | Current 3,348-line single file is unmaintainable | — Pending |
| Auto-detect available data dimensions | Charts should adapt to what's in the data, not show empty/broken charts | — Pending |
| Voxel-branded output | Sales and CS need professional-looking decks | — Pending |

---
*Last updated: 2026-02-12 after initialization*
