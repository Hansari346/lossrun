# Phase 3: Calculation Engine & Dimension Detection - Research

**Researched:** 2026-02-12
**Domain:** Reactive pure-function calculation engine, data-driven dimension detection, Preact Signals reactivity
**Confidence:** HIGH

## Summary

Phase 3 refines an already-solid calculation engine and adds a dimension detection layer that inspects canonical data to determine which analysis dimensions (cause of loss, body part, lost days, claim category, site comparison) are actually available. This dimension availability then drives all downstream behavior — charts render only when backed by data, PPT slides adapt, Excel tabs adjust.

The existing codebase is in excellent shape for this phase. `computeResults()` in `calculations.ts` is already a pure function taking `(CanonicalRecord[], AdjustmentParams) → CalculationResults` with zero DOM access. The `CalculationResults` type already carries breakdowns for cause, body part, category, yearly data, and site comparison. The signal store already has `adjustments`, `canonicalData`, `selectedSite`, and `results` signals. The main gaps are: (1) no dimension detection — breakdowns are always computed regardless of data availability, (2) recalculation is imperative (`calculateResults()` called manually) rather than reactive, (3) no mechanism for downstream consumers to query "is dimension X available?", and (4) no UI for users to see/confirm/override detected dimensions.

The standard approach is: (1) define a `DimensionKey` union type and `DimensionAvailability` record, (2) build a pure `detectDimensions()` function that inspects canonical data for each optional field's actual population rate, (3) store detected dimensions and user overrides as signals with a `computed` `activeDimensions` that merges them, (4) make `computeResults` dimension-aware by conditionally skipping breakdowns for unavailable dimensions, (5) replace the imperative `calculateResults()` with a `computed` signal or `effect` that auto-triggers on input changes, and (6) build a simple "Detected Dimensions" confirmation UI panel.

**Primary recommendation:** Add a `DimensionAvailability` type and `detectDimensions()` pure function to a new `src/lib/dimensions.ts` module. Extend the store with dimension signals. Make calculation reactive via `computed()`. No new npm dependencies needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @preact/signals | 2.7.1 | Reactive state, computed signals, batch updates | Already installed; `computed()` gives instant recalculation; `batch()` prevents intermediate renders during preset changes |
| Preact | 10.28.3 | Component rendering | Already installed; signal integration is first-class |
| TypeScript | 5.9.3 | Type safety for dimension types, results objects | Already installed; discriminated unions for dimension keys |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none — hand-roll) | — | Dimension detection | Simple data inspection — count non-null values per optional field; no library solves this domain-specific problem |
| (none — hand-roll) | — | Results Object extension | Adding dimension metadata to existing `CalculationResults` type |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `computed()` for reactive calc | `effect()` with write-back | `computed()` is cleaner — directly produces the value; `effect()` is for side-effects. Use `computed()` for the results derivation. |
| Simple boolean dimension map | Richer dimension metadata (count, coverage %) | Boolean is sufficient for DIM-02 gating; coverage % is a nice-to-have for the UI panel but can be added in the same structure |
| Imperative `calculateResults()` | Fully reactive computed chain | Reactive is better — eliminates forgotten recalculation bugs; but keep the imperative orchestrator as a fallback/compatibility shim |

**Installation:** No new dependencies needed. All functionality uses existing Preact Signals + TypeScript.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── dimensions.ts        # NEW: detectDimensions(), DimensionKey, DimensionAvailability
│   ├── calculations.ts      # ENHANCED: dimension-aware computeResults(), reactive orchestration
│   ├── charts.ts            # UNCHANGED (consumers adapt in Phase 4)
│   ├── export-ppt.ts        # UNCHANGED (consumers adapt in Phase 5)
│   ├── field-mapping.ts     # UNCHANGED
│   ├── content-detection.ts # UNCHANGED
│   ├── parsing.ts           # UNCHANGED
│   ├── formatting.ts        # UNCHANGED
│   └── ...
├── types/
│   └── index.ts             # ENHANCED: DimensionKey, DimensionAvailability, extended CalculationResults
└── state/
    └── store.ts             # ENHANCED: dimension signals, reactive results computed
```

### Pattern 1: Dimension Availability Map
**What:** A typed record mapping each analysis dimension to a boolean (available/not) plus optional metadata like population count and coverage percentage.
**When to use:** After canonical data is loaded and column mapping is complete.
**Example:**
```typescript
// Source: Domain-specific design for loss run analysis

/** All possible analysis dimensions beyond the 3 required fields */
export type DimensionKey =
  | "cause_of_loss"
  | "body_part"
  | "claim_category"
  | "lost_days"
  | "site_comparison"   // true when >1 distinct site exists
  | "loss_description";

export interface DimensionInfo {
  available: boolean;       // has meaningful data
  recordCount: number;      // how many records have this field populated
  totalRecords: number;     // total records in dataset
  coverage: number;         // recordCount / totalRecords (0-1)
  distinctValues: number;   // cardinality of the field's values
}

export type DimensionAvailability = Record<DimensionKey, DimensionInfo>;
```

### Pattern 2: Pure Dimension Detection Function
**What:** A pure function that inspects `CanonicalRecord[]` and returns dimension availability. No signal access, no side effects.
**When to use:** Called once after data ingestion, and again if data changes.
**Example:**
```typescript
// Source: Domain-specific — inspects optional fields on CanonicalRecord

const DIMENSION_FIELDS: Record<DimensionKey, (row: CanonicalRecord) => boolean> = {
  cause_of_loss: (row) => !!row.cause_of_loss?.trim(),
  body_part: (row) => !!row.body_part?.trim(),
  claim_category: (row) => !!row.claim_category?.trim(),
  lost_days: (row) => row.lost_days !== undefined && row.lost_days > 0,
  site_comparison: () => true, // handled separately (need >1 distinct site)
  loss_description: (row) => !!row.loss_description?.trim(),
};

export function detectDimensions(data: CanonicalRecord[]): DimensionAvailability {
  const total = data.length;
  if (total === 0) {
    // Return all unavailable
    return Object.fromEntries(
      DIMENSION_KEYS.map(k => [k, { available: false, recordCount: 0, totalRecords: 0, coverage: 0, distinctValues: 0 }])
    ) as DimensionAvailability;
  }

  const result = {} as DimensionAvailability;

  for (const key of DIMENSION_KEYS) {
    if (key === "site_comparison") {
      const sites = new Set(data.map(r => r.site_name).filter(Boolean));
      result[key] = {
        available: sites.size > 1,
        recordCount: data.filter(r => !!r.site_name).length,
        totalRecords: total,
        coverage: data.filter(r => !!r.site_name).length / total,
        distinctValues: sites.size,
      };
      continue;
    }

    const checker = DIMENSION_FIELDS[key];
    const populated = data.filter(checker);
    const distinctValues = new Set(
      populated.map(r => String((r as any)[key] ?? "").toLowerCase().trim())
    ).size;

    result[key] = {
      available: populated.length >= Math.max(1, total * 0.05), // at least 5% populated
      recordCount: populated.length,
      totalRecords: total,
      coverage: populated.length / total,
      distinctValues,
    };
  }

  return result;
}
```

### Pattern 3: Signal-Based Reactive Calculation Chain
**What:** Replace the imperative `calculateResults()` function with a `computed` signal that automatically re-derives when inputs change. The pure `computeResults()` function stays unchanged — the reactivity wrapper calls it.
**When to use:** In `store.ts` to make results automatically update when `adjustments`, `canonicalData`, `selectedSite`, or `activeDimensions` change.
**Example:**
```typescript
// Source: Preact Signals docs — computed() for derived state
import { signal, computed, batch } from "@preact/signals";

// === Dimension signals ===
export const detectedDimensions = signal<DimensionAvailability | null>(null);
export const dimensionOverrides = signal<Partial<Record<DimensionKey, boolean>>>({});

/** Merge detected + overrides → final active dimensions */
export const activeDimensions = computed<Record<DimensionKey, boolean>>(() => {
  const detected = detectedDimensions.value;
  if (!detected) return {} as Record<DimensionKey, boolean>;

  const overrides = dimensionOverrides.value;
  const active = {} as Record<DimensionKey, boolean>;

  for (const key of DIMENSION_KEYS) {
    active[key] = overrides[key] !== undefined
      ? overrides[key]!
      : detected[key].available;
  }
  return active;
});

/** Reactive results — auto-recomputes when any input signal changes */
export const reactiveResults = computed<CalculationResults | null>(() => {
  const data = canonicalData.value;
  if (data.length === 0) return null;

  const filtered = getFilteredData(data, selectedSite.value);
  const params = adjustments.value;
  const dims = activeDimensions.value;

  return computeResults(filtered, params, dims);
});
```

### Pattern 4: Batch Updates for Preset Application
**What:** Use `batch()` when applying presets that update multiple adjustment fields at once, preventing intermediate recalculations.
**When to use:** When user clicks "Conservative", "Balanced", or "Aggressive" preset buttons.
**Example:**
```typescript
// Source: Preact Signals docs — batch() for combining updates
import { batch } from "@preact/signals";

export function applyPreset(preset: "conservative" | "balanced" | "aggressive"): void {
  const values = getPresetValues(preset);
  batch(() => {
    adjustments.value = { ...adjustments.value, ...values };
  });
  // The computed `reactiveResults` will recalculate once, not per-field
}
```

### Pattern 5: Dimension-Gated Results Object
**What:** The `CalculationResults` type includes dimension availability metadata alongside the breakdown data. Downstream consumers check `results.dimensions.cause_of_loss` before rendering the cause-of-loss chart.
**When to use:** In charts, PPT export, Excel export — anywhere that conditionally renders based on data.
**Example:**
```typescript
// Extended CalculationResults type
export interface CalculationResults {
  // ... existing KPI, payback, cost fields ...

  // Dimension-gated breakdowns (only populated when dimension is active)
  yearlyData: YearlyBreakdown[];
  categoryBreakdown: CategoryBreakdown[];  // only when claim_category active
  bodyPartBreakdown: CategoryBreakdown[];  // only when body_part active
  causeBreakdown: CategoryBreakdown[];     // only when cause_of_loss active
  siteComparison: SiteBreakdown[];         // only when site_comparison active

  // Dimension metadata — consumers check this before rendering
  dimensions: Record<DimensionKey, boolean>;
}

// Consumer usage (Phase 4+):
function shouldRenderChart(chartId: string, results: CalculationResults): boolean {
  const requirements: Record<string, DimensionKey[]> = {
    causeOfLoss: ["cause_of_loss"],
    lossByType: ["claim_category"],
    bodyPart: ["body_part"],
    siteComparison: ["site_comparison"],
    lostDays: ["lost_days"],
  };
  const reqs = requirements[chartId];
  if (!reqs) return true; // charts with no dimension requirements always render
  return reqs.every(dim => results.dimensions[dim]);
}
```

### Anti-Patterns to Avoid
- **Imperative recalculation without reactivity:** The current `calculateResults()` is called manually after UI events. This is fragile — miss one call site and results go stale. Use `computed()` to make it automatic.
- **Mutating the results signal inside computeResults:** The pure function must return a new object, never write to signals. The signal write happens in exactly one place (the computed or the orchestrator).
- **Dimension detection on every recalculation:** Dimensions only change when the *data* changes, not when adjustment sliders move. Detect dimensions once after data load, store in a separate signal. The calculation `computed` reads it but doesn't recompute it.
- **Empty breakdowns confusing consumers:** When a dimension is unavailable, return an empty array `[]` for that breakdown. Don't return `null` or `undefined` — it forces consumers to null-check. Empty arrays are safe to `.map()` and `.length` check.
- **Coupling dimension detection to column mapping:** Detection should inspect actual data values, not just whether a column was mapped. A column might be mapped but contain 100% "N/A" or blank values. Check the parsed `CanonicalRecord[]` field population.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive recalculation | Manual call sites after every UI event | Preact Signals `computed()` | Automatic dependency tracking eliminates forgotten recalc bugs |
| Batched multi-field updates | Sequential signal writes | Preact Signals `batch()` | Prevents N intermediate recalculations when applying presets (5 fields change → 1 recompute) |
| Signal-based global state | Custom pub/sub or event emitter | Preact Signals `signal()` + `computed()` | Already the project's state pattern; built-in TypeScript types; first-class Preact integration |

**Key insight:** The heavy lifting for this phase is *architectural* (types, signal wiring, dimension detection logic) not *library* work. The existing calculation engine is already pure and well-tested from Phase 1. No new npm dependencies are needed — all the tools are already installed.

## Common Pitfalls

### Pitfall 1: Recalculation Triggered by Dimension Detection Itself
**What goes wrong:** If `detectDimensions` writes to a signal inside the same reactive chain that `computeResults` reads, you can create a cycle: data changes → detect dimensions → dimensions change → recalculate → (if recalculate reads data) → loop.
**Why it happens:** Accidentally putting dimension detection inside the computation `computed()`.
**How to avoid:** Dimension detection should be a *separate* signal computed from `canonicalData` only. The calculation `computed()` then reads the dimension signal as a dependency — no cycle because dimension detection doesn't depend on calculation results.
**Warning signs:** Console logs showing the same computed re-evaluating multiple times per data change.

### Pitfall 2: Slider Adjustments Causing Full Data Re-scan
**What goes wrong:** If dimension detection runs inside the same `computed()` as the calculation engine, moving an adjustment slider (which doesn't change data) would re-run dimension detection for no reason.
**Why it happens:** Conflating "data shape analysis" with "calculation".
**How to avoid:** Two separate computed signals: (1) `detectedDimensions = computed(() => detectDimensions(canonicalData.value))` — only re-runs when data changes. (2) `reactiveResults = computed(() => computeResults(filteredData, params, activeDimensions.value))` — re-runs when adjustments, filters, or active dimensions change.
**Warning signs:** Profiling shows dimension detection running on every slider drag.

### Pitfall 3: Coverage Threshold Too Aggressive or Too Lenient
**What goes wrong:** Setting dimension availability threshold at 50% means a dataset with 45% cause-of-loss populated shows "Cause of Loss: ✗" even though there's useful data. Setting it at 1% means a dataset with 2 out of 500 records having `body_part` shows "Body Part: ✓" but the chart looks empty.
**Why it happens:** No single threshold works for all datasets.
**How to avoid:** Use a low threshold (5% or absolute minimum of 3 records) for auto-detection, but surface coverage percentage in the UI so the user can override. The confirmation panel (DIM-03) is the safety valve — show "Body Part: ✓ (12% populated)" and let the user decide.
**Warning signs:** Users toggling dimensions on/off frequently after auto-detection.

### Pitfall 4: Stale Results After Site Filter Change
**What goes wrong:** User changes site filter but results don't update because `calculateResults()` wasn't called.
**Why it happens:** Imperative recalculation with missing call sites.
**How to avoid:** Make results a `computed()` signal that reads `selectedSite.value`. Any site change automatically invalidates and recomputes.
**Warning signs:** Changing site dropdown shows same numbers as before until user clicks "Recalculate" or changes another input.

### Pitfall 5: Breaking Existing `calculateResults()` Consumers
**What goes wrong:** Switching from imperative `calculateResults()` to reactive `computed` breaks any code that calls `calculateResults()` directly.
**Why it happens:** Multiple call sites in UI code.
**How to avoid:** Keep the imperative `calculateResults()` as a thin wrapper that just triggers the reactive chain (e.g., by touching a dependency signal). Or keep it entirely — as long as it writes to the same `results` signal, consumers don't care how it was triggered. Phase 3 can add the reactive path alongside the imperative one, then Phase 4 can migrate consumers.
**Warning signs:** Results page showing `null` after data load because nobody triggered the first calculation.

### Pitfall 6: Preact Signals `computed()` Throwing Errors
**What goes wrong:** If `computeResults()` throws an error (e.g., division by zero with bad params), the `computed()` signal will throw on access, potentially crashing the component tree.
**Why it happens:** No error boundary around the computed evaluation.
**How to avoid:** Wrap `computeResults()` in a try-catch inside the `computed()` callback. Return `null` on error and log the issue. The UI can check `reactiveResults.value === null` and show an error state. Alternatively, validate inputs before computing.
**Warning signs:** Blank results page with console errors after changing adjustment params to extreme values.

## Code Examples

### Dimension Detection Module (dimensions.ts)
```typescript
// Source: Domain-specific design for this project

import type { CanonicalRecord } from "../types";

export const DIMENSION_KEYS = [
  "cause_of_loss",
  "body_part",
  "claim_category",
  "lost_days",
  "site_comparison",
  "loss_description",
] as const;

export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export interface DimensionInfo {
  available: boolean;
  recordCount: number;
  totalRecords: number;
  coverage: number;
  distinctValues: number;
}

export type DimensionAvailability = Record<DimensionKey, DimensionInfo>;

/** Minimum records or 5% of total — whichever is larger */
const MIN_RECORDS = 3;
const MIN_COVERAGE = 0.05;

function isPopulated(key: DimensionKey, row: CanonicalRecord): boolean {
  switch (key) {
    case "cause_of_loss":
      return !!row.cause_of_loss?.trim();
    case "body_part":
      return !!row.body_part?.trim();
    case "claim_category":
      return !!row.claim_category?.trim();
    case "lost_days":
      return row.lost_days !== undefined && row.lost_days > 0;
    case "loss_description":
      return !!row.loss_description?.trim();
    case "site_comparison":
      return !!row.site_name?.trim();
  }
}

export function detectDimensions(data: CanonicalRecord[]): DimensionAvailability {
  const total = data.length;
  const result = {} as DimensionAvailability;

  for (const key of DIMENSION_KEYS) {
    const populated = data.filter((row) => isPopulated(key, row));
    const values = new Set(
      populated.map((r) => {
        if (key === "lost_days") return String(r.lost_days);
        return String((r as Record<string, unknown>)[key] ?? "").toLowerCase().trim();
      })
    );

    const threshold = Math.max(MIN_RECORDS, Math.ceil(total * MIN_COVERAGE));

    // site_comparison requires >1 distinct site
    const available = key === "site_comparison"
      ? values.size > 1
      : populated.length >= threshold;

    result[key] = {
      available,
      recordCount: populated.length,
      totalRecords: total,
      coverage: total > 0 ? populated.length / total : 0,
      distinctValues: values.size,
    };
  }

  return result;
}
```

### Reactive Store Extension (store.ts additions)
```typescript
// Source: Preact Signals docs (computed, batch)

import { signal, computed, batch } from "@preact/signals";
import type { DimensionKey, DimensionAvailability } from "../lib/dimensions";
import { detectDimensions, DIMENSION_KEYS } from "../lib/dimensions";
import { computeResults, getFilteredData } from "../lib/calculations";

// Dimension signals
export const detectedDimensions = computed<DimensionAvailability | null>(() => {
  const data = canonicalData.value;
  if (data.length === 0) return null;
  return detectDimensions(data);
});

export const dimensionOverrides = signal<Partial<Record<DimensionKey, boolean>>>({});

export const activeDimensions = computed<Record<DimensionKey, boolean>>(() => {
  const detected = detectedDimensions.value;
  if (!detected) {
    return Object.fromEntries(DIMENSION_KEYS.map((k) => [k, false])) as Record<DimensionKey, boolean>;
  }
  const overrides = dimensionOverrides.value;
  return Object.fromEntries(
    DIMENSION_KEYS.map((k) => [k, overrides[k] ?? detected[k].available])
  ) as Record<DimensionKey, boolean>;
});

// Reactive results — replaces imperative calculateResults()
export const reactiveResults = computed<CalculationResults | null>(() => {
  const data = canonicalData.value;
  if (data.length === 0) return null;

  const filtered = getFilteredData(data, selectedSite.value);
  const params = adjustments.value;
  const dims = activeDimensions.value;

  try {
    return computeResults(filtered, params, dims);
  } catch (e) {
    console.error("Calculation error:", e);
    return null;
  }
});
```

### Dimension-Aware computeResults Enhancement
```typescript
// Source: Extension of existing computeResults() in calculations.ts

export function computeResults(
  data: CanonicalRecord[],
  params: AdjustmentParams,
  dimensions?: Record<DimensionKey, boolean>, // NEW optional param
): CalculationResults {
  // ... existing KPI, TRIR, cost, payback calculations (unchanged) ...

  // --- Data aggregation — dimension-gated ---
  const yearlyData = buildYearlyData(data); // always computed (core)

  const dims = dimensions ?? {
    cause_of_loss: true, body_part: true, claim_category: true,
    lost_days: true, site_comparison: true, loss_description: true,
  };

  const categoryBreakdown = dims.claim_category
    ? buildCategoryBreakdown(data, "claim_category") : [];
  const bodyPartBreakdown = dims.body_part
    ? buildCategoryBreakdown(data, "body_part") : [];
  const causeBreakdown = dims.cause_of_loss
    ? buildCategoryBreakdown(data, "cause_of_loss") : [];
  const siteComparison = dims.site_comparison
    ? buildSiteComparison(data) : [];

  return {
    // ... existing fields ...
    yearlyData,
    categoryBreakdown,
    bodyPartBreakdown,
    causeBreakdown,
    siteComparison,
    dimensions: dims, // NEW: pass through for downstream consumers
  };
}
```

### Preset Application with batch()
```typescript
// Source: Preact Signals docs — batch()

export function applyPreset(preset: "conservative" | "balanced" | "aggressive"): void {
  const values = getPresetValues(preset);
  batch(() => {
    adjustments.value = { ...adjustments.value, ...values };
  });
  // reactiveResults computed will fire once with all new values
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Imperative `calculateResults()` calls at each UI event | Reactive `computed()` signal that auto-recomputes | Preact Signals pattern (project uses since Phase 1) | Eliminates stale-results bugs, no forgotten call sites |
| Always compute all breakdowns | Dimension-gated computation | This phase introduces it | Skip unnecessary work; empty breakdowns are `[]` not error-prone `null` |
| Charts unconditionally render | Charts check `results.dimensions[key]` before rendering | DIM-02 (Phase 3 defines, Phase 4 implements rendering) | No empty charts, no broken visualizations |
| Monolith's `calculateAndShowResults()` mixed calc + DOM | Pure `computeResults()` function + reactive signal wrapper | Phase 1 extracted it, Phase 3 perfects it | Testable, composable, framework-agnostic |

**Deprecated/outdated:**
- The imperative `calculateResults()` orchestrator remains for backward compatibility but the reactive `computed` path is preferred
- Direct `results.value = computeResults(...)` manual writes should be phased out in favor of the reactive chain

## Open Questions

1. **Should `department` be a separate dimension from `site_name`?**
   - What we know: Currently `department` and `dept` are hints for the `site_name` field in field-mapping.ts. Some datasets use "department" as a location proxy, others have separate department and site columns.
   - What's unclear: Whether the project should support `department` as a distinct canonical field beyond `site_name`.
   - Recommendation: Keep `department` mapped to `site_name` for Phase 3 (brownfield guard). If real user data shows need for separate department analysis, add `department` as a new optional field in a future phase. The dimension detection system is extensible — adding a new `DimensionKey` is one line.

2. **Should dimension detection re-run on filtered data or full data?**
   - What we know: Filtering by site reduces the dataset. A dimension might be populated in site A's data but not site B's.
   - What's unclear: Whether users expect dimension availability to change when they filter by site.
   - Recommendation: Run detection on the **full** unfiltered canonical data. Dimensions describe "what's in the dataset", not "what's visible right now". If a dimension disappears after filtering, it's confusing. The chart can show empty state for the filtered subset, but the dimension should remain available. This is simpler and less surprising.

3. **`loss_description` dimension — useful for Phase 3?**
   - What we know: `loss_description` is a narrative text field. It doesn't drive any current chart or breakdown.
   - What's unclear: Whether to include it in dimension detection now or defer.
   - Recommendation: Include it in the detection system (it's one extra line) but mark it as informational — no current consumer uses it for breakdowns. It's useful for the DIM-03 UI panel ("we detected loss descriptions in your data") and could enable future AI categorization (v2 ADV feature).

4. **Backward compatibility: keep `results` signal or replace with `reactiveResults`?**
   - What we know: The current store exports `results` as a writable `signal<CalculationResults | null>(null)`. UI code reads `results.value`.
   - What's unclear: Whether to replace `results` with the `computed` `reactiveResults` or keep both.
   - Recommendation: Replace `results` with the `computed` (rename the computed to `results`). Computed signals are read-only, which is *better* — no accidental writes from UI code. The imperative `calculateResults()` function can be kept as a shim that touches a dependency to trigger recomputation, or removed entirely if no UI code calls it directly. Test that existing UI reads still work (they will — `.value` access is the same for signals and computed signals).

## Sources

### Primary (HIGH confidence)
- Preact Signals official docs: https://preactjs.com/guide/v10/signals — `signal()`, `computed()`, `batch()`, `effect()`, `.peek()`, `untracked()` APIs
- Preact Signals npm: @preact/signals v2.7.1 — installed in project, TypeScript types included
- Existing codebase: `src/lib/calculations.ts` — pure `computeResults()` function, `getFilteredData()`, preset values
- Existing codebase: `src/types/index.ts` — `CanonicalRecord`, `AdjustmentParams`, `CalculationResults`, `CategoryBreakdown`, `SiteBreakdown`
- Existing codebase: `src/state/store.ts` — signal store pattern, existing signals
- Existing codebase: `src/lib/charts.ts` — downstream consumer pattern, chart functions
- Existing codebase: `src/lib/export-ppt.ts` — downstream consumer pattern, PPT export

### Secondary (MEDIUM confidence)
- Preact Signals blog: https://preactjs.com/blog/signal-boosting — performance characteristics, lazy evaluation, dependency tracking
- Preact Signals GitHub discussions: https://github.com/preactjs/signals/discussions/501 — batch() vs React batching, deterministic updates

### Tertiary (LOW confidence)
- None — all findings verified against official docs or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; Preact Signals is already installed and well-documented
- Architecture: HIGH — patterns derived from existing codebase structure + official Preact Signals patterns; dimension detection is straightforward data inspection
- Pitfalls: HIGH — derived from code review of existing `calculations.ts`, `store.ts`, and `charts.ts`; reactive pitfalls from Preact Signals docs
- Dimension detection: HIGH — simple field population checking against known `CanonicalRecord` optional fields; domain logic is specific to this project
- Code examples: HIGH — all examples use existing project types and patterns

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days — Preact Signals is stable, no breaking changes expected)
