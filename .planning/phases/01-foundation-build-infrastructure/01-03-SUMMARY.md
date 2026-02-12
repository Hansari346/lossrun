---
phase: 01-foundation-build-infrastructure
plan: 03
subsystem: calculations, charts, export
tags: [chart.js, pptxgenjs, preact-signals, pure-functions, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Vite build pipeline, TypeScript config, signal store, domain types"
provides:
  - "Pure calculation engine (computeResults) — data + params → CalculationResults"
  - "Chart.js rendering for all 11 chart types (drawCharts)"
  - "PowerPoint export from results + chart images (exportToPPT)"
  - "Expanded AdjustmentParams and CalculationResults interfaces"
affects: [03-calculation-engine, 04-adaptive-visualization, 05-powerpoint-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure function pattern: computeResults(data, params) → CalculationResults"
    - "Canvas-ref injection: charts receive HTMLCanvasElement refs, never query DOM"
    - "Image-URL injection: PPT export receives chart images as data URLs"

key-files:
  created:
    - src/lib/calculations.ts
    - src/lib/charts.ts
    - src/lib/export-ppt.ts
  modified:
    - src/types/index.ts
    - src/types/globals.d.ts
    - src/state/store.ts

key-decisions:
  - "AdjustmentParams expanded to include all financial, org, and observation inputs — no DOM reads needed"
  - "CalculationResults stores KPI tile values, obs decomposition, payback data, and pass-through flags"
  - "Preset values match monolith exactly (conservative/balanced/aggressive from applyPreset)"
  - "drawCharts receives filteredData + allData + params to avoid DOM reads in projection chart"

patterns-established:
  - "Pure computation: all calc functions take data as params, return results, zero side effects"
  - "Orchestrator pattern: calculateResults() is the only side-effecting wrapper (reads/writes signals)"
  - "Canvas injection: UI layer will pass canvas refs to drawCharts, not the other way around"

# Metrics
duration: 7min
completed: 2026-02-12
---

# Phase 1 Plan 3: Output Pipeline Summary

**Pure calculation engine, 11 Chart.js chart types, and PPT export — all as typed modules with zero DOM access**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-12T11:40:29Z
- **Completed:** 2026-02-12T11:47:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extracted the ~200-line `calculateAndShowResults()` into a pure `computeResults()` function that takes `CanonicalRecord[]` + `AdjustmentParams` and returns a complete `CalculationResults` object
- Extracted all 11 Chart.js chart configurations into `drawCharts()` that accepts canvas refs and results — no DOM queries
- Extracted PPT export into `exportToPPT()` that accepts results + chart image data URLs — no DOM queries
- Expanded `AdjustmentParams` from 10 fields to 24 fields to eliminate all DOM input reads
- Expanded `CalculationResults` to include full KPI tile values, observation cost decomposition, sigmoid payback data, and pass-through flags for charts/export

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract calculation engine** - `8409d77` (feat)
2. **Task 2: Extract charts + PPT export** - `7ad2f81` (feat)

## Files Created/Modified
- `src/lib/calculations.ts` — Pure calculation engine (497 lines): getFilteredData, annualizeInjuries, calculateObservationCost, getPresetValues, computeResults, calculateResults
- `src/lib/charts.ts` — Chart.js rendering for all 11 chart types (1157 lines): drawCharts, destroyCharts
- `src/lib/export-ppt.ts` — PowerPoint generation from results (349 lines): exportToPPT
- `src/types/index.ts` — Expanded AdjustmentParams (24 fields) and CalculationResults (full KPI + payback + breakdowns), added PaybackData interface
- `src/types/globals.d.ts` — Fixed PptxGenJS declaration to match monolith usage
- `src/state/store.ts` — Updated adjustments signal defaults to match expanded AdjustmentParams

## Decisions Made
- AdjustmentParams expanded to carry all financial, org, and observation inputs that the monolith previously read from DOM inputs — this makes `computeResults` fully pure
- CalculationResults includes pass-through fields (isExistingCustomer, voxelStartDate, wcReduction, includeObs) that charts and PPT export need for conditional rendering
- Preset values sourced from monolith's actual `applyPreset()` code (not the plan's initial estimates which differed)
- `drawCharts` receives both filteredData and allData to support site comparison without DOM queries
- Lost time reduction threaded as a parameter through the chart call chain rather than stored on CalculationResults

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated globals.d.ts PptxGenJS declaration**
- **Found during:** Task 2 (PPT export)
- **Issue:** globals.d.ts declared `pptxgen` but monolith uses `new PptxGenJS()` — typecheck would fail
- **Fix:** Changed declaration from `declare const pptxgen: any` to `declare const PptxGenJS: any`
- **Files modified:** src/types/globals.d.ts
- **Verification:** npm run typecheck passes
- **Committed in:** 7ad2f81 (Task 2 commit)

**2. [Rule 1 - Bug] Corrected preset values to match actual monolith code**
- **Found during:** Task 1 (calculation engine)
- **Issue:** Plan specified conservative=20/30/5/10/1.0, balanced=40/60/10/25/1.5, aggressive=80/90/25/50/2.5 — but monolith's applyPreset() uses conservative=45/55/10/25/1.5, balanced=65/81/18/41/2.0, aggressive=80/90/25/50/2.5
- **Fix:** Used actual monolith values from lines 3307-3325
- **Files modified:** src/lib/calculations.ts, src/state/store.ts
- **Verification:** Values match monolith source exactly
- **Committed in:** 8409d77 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All three output pipeline modules are ready for wiring in Plan 01-04
- Plan 01-04 will create the adjustments page, results page, and app shell that wire these modules to the UI
- The CalculationResults interface is the contract between calculations → charts → PPT export

---
*Phase: 01-foundation-build-infrastructure*
*Completed: 2026-02-12*
