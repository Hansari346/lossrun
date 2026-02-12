/**
 * Pure calculation engine — accepts data and params, returns results.
 *
 * Extracted from monolith's calculateAndShowResults() (lines 1831–2044),
 * annualizeInjuries (lines 1804–1819), getFilteredData (lines 1728–1732),
 * and applyPreset (lines 3298–3330).
 *
 * ZERO DOM access. All inputs come as function parameters or store signals.
 */

import {
  canonicalData,
  adjustments,
  selectedSite,
  results,
  isCalculating,
} from "../state/store";
import type {
  CanonicalRecord,
  AdjustmentParams,
  CalculationResults,
  PaybackData,
  YearlyBreakdown,
  CategoryBreakdown,
  SiteBreakdown,
} from "../types";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Filter data by selected site.
 * Pure function — no side effects.
 */
export function getFilteredData(
  data: CanonicalRecord[],
  site: string,
): CanonicalRecord[] {
  if (!site || site === "all") return data;
  return data.filter((row) => row.site_name === site);
}

/**
 * Annualize partial-year injury counts.
 * Pure function — takes count and months of data, returns annualized count.
 */
export function annualizeInjuries(
  count: number,
  months: number,
  shouldAnnualize: boolean,
  rounding: "round" | "ceil" | "floor" = "round",
): { used: number; detail: string } {
  const safeCount = Math.max(0, count);
  if (!shouldAnnualize) {
    return { used: safeCount, detail: "Full-year value used (12 months)" };
  }

  const safeMonths = Math.min(12, Math.max(1, months));
  const factor = 12 / safeMonths;
  const raw = safeCount * factor;

  let used: number;
  if (rounding === "ceil") used = Math.ceil(raw);
  else if (rounding === "floor") used = Math.floor(raw);
  else used = Math.round(raw);

  return {
    used,
    detail: `YTD annualized: injuries × (12 ÷ ${safeMonths}) = ${raw.toFixed(2)} → ${used}`,
  };
}

/**
 * Calculate observation program cost decomposition.
 * Pure function.
 */
export function calculateObservationCost(
  totalAnnualObs: number,
  minManual: number,
  obsSpeedImprovement: number,
  rate: number,
  headcount: number,
  trainingHours: number,
): { currentCost: number; improvedCost: number; laborManual: number; reportingManual: number; laborImproved: number; reportingImproved: number; training: number } {
  const minutesToHours = (m: number) => m / 60;

  // Improved observation time — floor at 5 minutes
  const rawImprovedTime = minManual / obsSpeedImprovement;
  const minImproved = Math.max(5, rawImprovedTime);

  // Current / Manual state
  const obsTimeAnnualManual = totalAnnualObs * minutesToHours(minManual);
  const costObsLaborManual = obsTimeAnnualManual * rate;
  const reportingTimeAnnualManual = totalAnnualObs * minutesToHours(10); // 10 mins reporting
  const costObsReportingManual = reportingTimeAnnualManual * rate;

  // Improved / Voxel state
  const obsTimeAnnualImproved = totalAnnualObs * minutesToHours(minImproved);
  const costObsLaborImproved = obsTimeAnnualImproved * rate;
  const reportingTimeAnnualImproved = totalAnnualObs * minutesToHours(2); // 2 mins reporting
  const costObsReportingImproved = reportingTimeAnnualImproved * rate;

  // Training (constant for both scenarios)
  const costTraining = headcount * trainingHours * rate;

  const currentCost = costObsLaborManual + costObsReportingManual + costTraining;
  const improvedCost = costObsLaborImproved + costObsReportingImproved + costTraining;

  return {
    currentCost,
    improvedCost,
    laborManual: costObsLaborManual,
    reportingManual: costObsReportingManual,
    laborImproved: costObsLaborImproved,
    reportingImproved: costObsReportingImproved,
    training: costTraining,
  };
}

/**
 * Apply a preset to adjustment parameters.
 * Returns a partial AdjustmentParams object (does not mutate).
 *
 * Values sourced from monolith applyPreset() (lines 3307–3325).
 */
export function getPresetValues(
  preset: "conservative" | "balanced" | "aggressive",
): Partial<AdjustmentParams> {
  switch (preset) {
    case "conservative":
      return {
        wcReduction: 45,
        lostTimeReduction: 55,
        retentionImprovement: 10,
        miscCostReduction: 25,
        obsSpeedImprovement: 1.5,
      };
    case "balanced":
      return {
        wcReduction: 65,
        lostTimeReduction: 81,
        retentionImprovement: 18,
        miscCostReduction: 41,
        obsSpeedImprovement: 2.0,
      };
    case "aggressive":
      return {
        wcReduction: 80,
        lostTimeReduction: 90,
        retentionImprovement: 25,
        miscCostReduction: 50,
        obsSpeedImprovement: 2.5,
      };
  }
}

// ---------------------------------------------------------------------------
// Data aggregation helpers (used by computeResults)
// ---------------------------------------------------------------------------

function buildYearlyData(data: CanonicalRecord[]): YearlyBreakdown[] {
  const yearlyMap: Record<
    number,
    {
      claims: number;
      incurred: number;
      moClaims: number;
      indemnClaims: number;
      moIncurred: number;
      indemnIncurred: number;
    }
  > = {};

  for (const row of data) {
    if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) continue;
    const year = row.date_of_loss.getFullYear();
    if (!yearlyMap[year]) {
      yearlyMap[year] = {
        claims: 0,
        incurred: 0,
        moClaims: 0,
        indemnClaims: 0,
        moIncurred: 0,
        indemnIncurred: 0,
      };
    }
    const entry = yearlyMap[year];
    const incurred = row.total_incurred || 0;
    entry.claims += 1;
    entry.incurred += incurred;

    const cat = (row.claim_category || "").toLowerCase();
    if (cat.includes("mo") || cat.includes("medical")) {
      entry.moClaims += 1;
      entry.moIncurred += incurred;
    } else {
      entry.indemnClaims += 1;
      entry.indemnIncurred += incurred;
    }
  }

  return Object.entries(yearlyMap)
    .map(([year, d]) => ({ year: Number(year), ...d }))
    .sort((a, b) => a.year - b.year);
}

function buildCategoryBreakdown(
  data: CanonicalRecord[],
  field: "claim_category" | "body_part" | "cause_of_loss",
): CategoryBreakdown[] {
  const map: Record<string, { count: number; incurred: number }> = {};
  let total = 0;

  for (const row of data) {
    const value = (row[field] as string | undefined)?.trim();
    const key = value || "Unspecified";
    if (!map[key]) map[key] = { count: 0, incurred: 0 };
    const incurred = row.total_incurred || 0;
    map[key].count += 1;
    map[key].incurred += incurred;
    total += incurred;
  }

  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      count: d.count,
      incurred: d.incurred,
      percentage: total > 0 ? (d.incurred / total) * 100 : 0,
    }))
    .sort((a, b) => b.incurred - a.incurred);
}

function buildSiteComparison(data: CanonicalRecord[]): SiteBreakdown[] {
  const siteMap: Record<string, { claims: number; incurred: number }> = {};

  for (const row of data) {
    const site = row.site_name || "Unknown";
    if (!siteMap[site]) siteMap[site] = { claims: 0, incurred: 0 };
    siteMap[site].claims += 1;
    siteMap[site].incurred += row.total_incurred || 0;
  }

  return Object.entries(siteMap)
    .map(([site, d]) => ({
      site,
      claims: d.claims,
      incurred: d.incurred,
      avgCost: d.claims > 0 ? d.incurred / d.claims : 0,
    }))
    .sort((a, b) => b.incurred - a.incurred);
}

// ---------------------------------------------------------------------------
// Main calculation engine
// ---------------------------------------------------------------------------

/**
 * Main calculation engine. Pure function that takes data + params and returns
 * complete results. This is the refactored version of monolith's
 * calculateAndShowResults().
 *
 * CRITICAL: This function does NOT access the DOM. All inputs come as
 * parameters. All outputs are returned in the CalculationResults object.
 */
export function computeResults(
  data: CanonicalRecord[],
  params: AdjustmentParams,
): CalculationResults {
  const isCustomer = params.isExistingCustomer;

  // --- Financial inputs ---
  const avgCost = params.avgCost;
  const miscDirect = params.miscDirect;
  const miscIndirect = params.miscIndirect;

  // Improvement ratios (convert from 0–100 to 0–1)
  const wcReduction = Math.max(0, Math.min(100, params.wcReduction)) / 100;
  const miscCostReduction =
    Math.max(0, Math.min(100, params.miscCostReduction)) / 100;
  const lostTimeReduction =
    Math.max(0, Math.min(100, params.lostTimeReduction)) / 100;
  const retentionImprovement =
    Math.max(0, Math.min(100, params.retentionImprovement)) / 100;

  // Org inputs
  const headcount = params.headcount || 100;
  const rate = params.rate;
  const trainingHours = params.trainingHours;

  // Observation inputs
  const includeObs = params.includeObs;
  const minManual = Math.max(0, params.minObsManual);
  const obsSpeedImprovement = Math.max(1, params.obsSpeedImprovement);
  const totalAnnualObs = params.totalAnnualObs;

  // Annualize injuries
  const ann = annualizeInjuries(
    params.injuries,
    params.annualizeMonths,
    params.annualize,
    params.annualizeRounding,
  );
  const injuriesCurrent = ann.used;

  // --- 1. Injuries & TRIR ---
  let injuriesManual: number;
  let injuriesImproved: number;
  if (isCustomer) {
    injuriesImproved = injuriesCurrent; // Actual
    injuriesManual = Math.round(
      injuriesCurrent / Math.max(0.01, 1 - wcReduction),
    ); // Baseline
  } else {
    injuriesManual = injuriesCurrent; // Current
    injuriesImproved = Math.max(
      0,
      Math.round(injuriesManual * (1 - wcReduction)),
    ); // Projected
  }

  const trirManual = (injuriesManual * 200000) / (headcount * 2000);
  const trirImproved = (injuriesImproved * 200000) / (headcount * 2000);

  // --- 2. Direct & Indirect Costs ---
  const mult = Math.max(0, params.indirectMult);
  const indirectImprovementFactor =
    1 - (lostTimeReduction * 0.6 + retentionImprovement * 0.4);

  let directManual: number;
  let directImproved: number;
  let indirectManual: number;
  let indirectImproved: number;

  if (isCustomer) {
    directImproved = avgCost * injuriesImproved + miscDirect;
    const miscDirectHypothetical =
      miscDirect / Math.max(0.01, 1 - miscCostReduction);
    directManual = avgCost * injuriesManual + miscDirectHypothetical;

    indirectImproved =
      directImproved * mult * indirectImprovementFactor + miscIndirect;
    const miscIndirectHypothetical =
      miscIndirect / Math.max(0.01, 1 - miscCostReduction);
    indirectManual = directManual * mult + miscIndirectHypothetical;
  } else {
    directManual = avgCost * injuriesManual + miscDirect;
    directImproved =
      avgCost * injuriesImproved + miscDirect * (1 - miscCostReduction);

    indirectManual = directManual * mult + miscIndirect;
    indirectImproved =
      directImproved * mult * indirectImprovementFactor +
      miscIndirect * (1 - miscCostReduction);
  }

  // --- 3. Observation Cost Decomposition ---
  const obsCosts = calculateObservationCost(
    totalAnnualObs,
    minManual,
    obsSpeedImprovement,
    rate,
    headcount,
    trainingHours,
  );

  const costManual = obsCosts.currentCost;
  const costImproved = obsCosts.improvedCost;

  // --- 4. Totals ---
  const baseManual = directManual + indirectManual;
  const baseImproved = directImproved + indirectImproved;

  const totalManual = includeObs ? baseManual + costManual : baseManual;
  const totalImproved = includeObs
    ? baseImproved + costImproved
    : baseImproved;

  // --- 5. Savings & Payback (Sigmoid) ---
  const annualSavingsMax = totalManual - totalImproved;
  const monthlySavingsMax = annualSavingsMax / 12;

  const paybackData: PaybackData = {
    months: [],
    cumulativeSavings: [],
    cumulativeCost: [],
    netCashFlow: [],
    paybackMonth: -1,
  };

  let cumSavings = 0;
  const cumCost = 0;

  for (let m = 1; m <= 24; m++) {
    // Sigmoid ramp-up: S(t) = Max / (1 + e^-k(t-t0)), k=0.8, t0=3
    const rampFactor = 1 / (1 + Math.exp(-0.8 * (m - 3)));
    const monthlySavings = monthlySavingsMax * rampFactor;

    cumSavings += monthlySavings;
    const net = cumSavings - cumCost;

    paybackData.months.push(m);
    paybackData.cumulativeSavings.push(cumSavings);
    paybackData.cumulativeCost.push(cumCost);
    paybackData.netCashFlow.push(net);

    if (net >= 0 && paybackData.paybackMonth === -1) {
      paybackData.paybackMonth = m;
    }
  }

  // Year 1 realized savings (sum of first 12 months)
  const year1Savings = paybackData.cumulativeSavings[11] ?? 0;
  const totalImprovedYear1 = totalManual - year1Savings;

  // --- Voxel start date for charts ---
  const voxelStartDate = isCustomer
    ? new Date(params.voxelStartYear, params.voxelStartMonth, 1)
    : null;

  // --- Data aggregation for charts ---
  const yearlyData = buildYearlyData(data);
  const categoryBreakdown = buildCategoryBreakdown(data, "claim_category");
  const bodyPartBreakdown = buildCategoryBreakdown(data, "body_part");
  const causeBreakdown = buildCategoryBreakdown(data, "cause_of_loss");
  const siteComparison = buildSiteComparison(data);

  return {
    // KPI tile values
    directManual,
    directImproved,
    indirectManual,
    indirectImproved,
    obsManual: includeObs ? costManual : 0,
    obsImproved: includeObs ? costImproved : 0,
    totalManual,
    totalImproved,
    annualSavings: annualSavingsMax,

    // Injuries & TRIR
    injuriesManual,
    injuriesImproved,
    trirManual,
    trirImproved,

    // Observation cost decomposition
    costObsLaborManual: obsCosts.laborManual,
    costObsReportingManual: obsCosts.reportingManual,
    costObsLaborImproved: obsCosts.laborImproved,
    costObsReportingImproved: obsCosts.reportingImproved,
    costTraining: obsCosts.training,

    // Payback
    paybackData,
    totalImprovedYear1,

    // Annualization
    annualizeDetail: ann.detail,

    // Pass-through for charts/export
    isExistingCustomer: isCustomer,
    voxelStartDate,
    wcReduction,
    includeObs,

    // Data breakdowns
    yearlyData,
    categoryBreakdown,
    bodyPartBreakdown,
    causeBreakdown,
    siteComparison,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator — side-effecting wrapper
// ---------------------------------------------------------------------------

/**
 * Orchestrator: reads from store, computes, writes results to store.
 * This is the only function with side effects (signal writes).
 */
export function calculateResults(): void {
  isCalculating.value = true;
  try {
    const data = getFilteredData(
      canonicalData.value,
      selectedSite.value,
    );
    const params = adjustments.value;
    const result = computeResults(data, params);
    results.value = result;
  } finally {
    isCalculating.value = false;
  }
}
