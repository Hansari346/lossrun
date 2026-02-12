/**
 * Chart.js rendering for all 11 chart types.
 *
 * Extracted from monolith's drawCharts() (lines 2045–3058).
 * ZERO DOM access — all canvas refs and data arrive as parameters.
 *
 * Chart is a CDN global (declared in src/types/globals.d.ts).
 */

import type {
  CalculationResults,
  CanonicalRecord,
  AdjustmentParams,
} from "../types";
import { fmtMoney, fmtInt, fmtNum } from "./formatting";

// ---------------------------------------------------------------------------
// Shared color palettes (exact values from monolith)
// ---------------------------------------------------------------------------

const CATEGORY_COLORS = [
  "rgba(56, 189, 248, 0.8)",
  "rgba(34, 197, 94, 0.8)",
  "rgba(251, 146, 60, 0.8)",
  "rgba(168, 85, 247, 0.8)",
  "rgba(236, 72, 153, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(245, 158, 11, 0.8)",
  "rgba(14, 165, 233, 0.8)",
  "rgba(20, 184, 166, 0.8)",
  "rgba(139, 92, 246, 0.8)",
  "rgba(217, 70, 239, 0.8)",
  "rgba(249, 115, 22, 0.8)",
  "rgba(59, 130, 246, 0.8)",
  "rgba(16, 185, 129, 0.8)",
  "rgba(147, 51, 234, 0.8)",
  "rgba(148, 163, 184, 0.8)",
];

const TYPE_COLORS = [
  "rgba(56, 189, 248, 0.8)",
  "rgba(34, 197, 94, 0.8)",
  "rgba(251, 146, 60, 0.8)",
  "rgba(168, 85, 247, 0.8)",
  "rgba(236, 72, 153, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(245, 158, 11, 0.8)",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Destroy all existing chart instances.
 */
export function destroyCharts(instances: Record<string, any>): void {
  Object.values(instances).forEach((chart) => {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  });
}

/**
 * Draw all applicable charts.
 *
 * @param results - Complete calculation results
 * @param filteredData - The filtered CanonicalRecord[] (same data computeResults used)
 * @param allData - Full unfiltered canonical data (for site comparison)
 * @param canvasRefs - Map of chart ID → HTMLCanvasElement
 * @param existingInstances - Previous chart instances to destroy
 * @param params - Adjustment parameters (for projection chart DOM-free recalc)
 * @returns Map of chart ID → new Chart instance
 */
export function drawCharts(
  results: CalculationResults,
  filteredData: CanonicalRecord[],
  allData: CanonicalRecord[],
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  existingInstances: Record<string, any>,
  params: AdjustmentParams,
): Record<string, any> {
  // Destroy previous instances
  destroyCharts(existingInstances);

  const instances: Record<string, any> = {};
  const isCustomer = results.isExistingCustomer;

  // -------------------------------------------------------------------
  // 1. Cause of Loss / Loss Category (horizontal bar)
  // -------------------------------------------------------------------
  drawCauseOfLoss(filteredData, canvasRefs, instances);

  // -------------------------------------------------------------------
  // 2. Loss by Type YoY (stacked bar)
  // -------------------------------------------------------------------
  drawLossByType(filteredData, canvasRefs, instances);

  // -------------------------------------------------------------------
  // 3. Loss by Year trend (line)
  // -------------------------------------------------------------------
  drawLossByYear(filteredData, results, canvasRefs, instances);

  // -------------------------------------------------------------------
  // 4. Cost Comparison (stacked bar)
  // -------------------------------------------------------------------
  drawCostComparison(results, canvasRefs, instances);

  // -------------------------------------------------------------------
  // 5. Projected Improvements (multi-year line)
  // -------------------------------------------------------------------
  drawImprovements(filteredData, results, params, canvasRefs, instances);

  // -------------------------------------------------------------------
  // 6. Cost Breakdown by category (grouped bar)
  // -------------------------------------------------------------------
  drawBreakdown(results, canvasRefs, instances);

  // -------------------------------------------------------------------
  // 7 & 8. Site Comparison (bar) + Site Claims (bar)
  // -------------------------------------------------------------------
  drawSiteComparison(allData, canvasRefs, instances);

  // -------------------------------------------------------------------
  // 9, 10, 11. Lost Days Analysis
  // -------------------------------------------------------------------
  const lostTimeReductionRatio =
    Math.max(0, Math.min(100, params.lostTimeReduction)) / 100;
  drawLostDays(filteredData, lostTimeReductionRatio, canvasRefs, instances);

  return instances;
}

// ---------------------------------------------------------------------------
// Individual chart builders (private)
// ---------------------------------------------------------------------------

function drawCauseOfLoss(
  data: CanonicalRecord[],
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const canvas = canvasRefs["causeOfLossChart"];
  if (!canvas) return;

  const causeOfLossMap: Record<string, number> = {};
  let totalWithCause = 0;
  let totalWithoutCause = 0;

  data.forEach((row) => {
    const incurred = row.total_incurred || 0;
    if (row.cause_of_loss && row.cause_of_loss.trim()) {
      const cause = row.cause_of_loss.trim();
      if (!causeOfLossMap[cause]) causeOfLossMap[cause] = 0;
      causeOfLossMap[cause] += incurred;
      totalWithCause += incurred;
    } else {
      totalWithoutCause += incurred;
    }
  });

  const sortedCauses = Object.entries(causeOfLossMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (sortedCauses.length === 0 && totalWithoutCause === 0) return;

  const labels = sortedCauses.map(([cause]) => cause);
  const values = sortedCauses.map(([, value]) => value);

  if (totalWithoutCause > 0) {
    labels.push("Unspecified");
    values.push(totalWithoutCause);
  }

  const totalAll = totalWithCause + totalWithoutCause;

  instances.causeOfLoss = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Incurred",
          data: values,
          backgroundColor: labels.map(
            (_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
          ),
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const value = fmtMoney(ctx.parsed.x);
              const percentage = ((ctx.parsed.x / totalAll) * 100).toFixed(1);
              return `${value} (${percentage}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) => "$" + value.toLocaleString(),
          },
          title: { display: true, text: "Total Incurred ($)" },
        },
        y: {
          title: { display: true, text: "Loss Category" },
        },
      },
    },
  });
}

function drawLossByType(
  data: CanonicalRecord[],
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const canvas = canvasRefs["lossByTypeChart"];
  if (!canvas) return;

  const typeYearMap: Record<string, Record<number, number>> = {};
  const bodyPartYearMap: Record<string, Record<number, number>> = {};
  const causeYearMap: Record<string, Record<number, number>> = {};

  data.forEach((row) => {
    if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
    const year = row.date_of_loss.getFullYear();
    const incurred = row.total_incurred || 0;

    const category = row.claim_category || "Uncategorized";
    if (!typeYearMap[category]) typeYearMap[category] = {};
    if (!typeYearMap[category][year]) typeYearMap[category][year] = 0;
    typeYearMap[category][year] += incurred;

    if (row.body_part) {
      const bodyPart = row.body_part;
      if (!bodyPartYearMap[bodyPart]) bodyPartYearMap[bodyPart] = {};
      if (!bodyPartYearMap[bodyPart][year])
        bodyPartYearMap[bodyPart][year] = 0;
      bodyPartYearMap[bodyPart][year] += incurred;
    }

    if (row.cause_of_loss) {
      const cause = row.cause_of_loss;
      if (!causeYearMap[cause]) causeYearMap[cause] = {};
      if (!causeYearMap[cause][year]) causeYearMap[cause][year] = 0;
      causeYearMap[cause][year] += incurred;
    }
  });

  const allYearsSet = new Set<number>();
  Object.values(typeYearMap).forEach((typeData) => {
    Object.keys(typeData).forEach((y) => allYearsSet.add(parseInt(y)));
  });
  const sortedYears = Array.from(allYearsSet).sort((a, b) => a - b);
  const types = Object.keys(typeYearMap).sort();

  const primaryMap =
    types.length > 1
      ? typeYearMap
      : Object.keys(bodyPartYearMap).length > 0
        ? bodyPartYearMap
        : causeYearMap;
  const primaryTypes = Object.keys(primaryMap).sort();

  const datasets =
    primaryTypes.length > 0
      ? primaryTypes.map((type, idx) => ({
          label: type,
          data: sortedYears.map((y) => primaryMap[type][y] || 0),
          backgroundColor: TYPE_COLORS[idx % TYPE_COLORS.length],
        }))
      : [
          {
            label: "Total Incurred",
            data: sortedYears.map((y) => {
              let total = 0;
              data.forEach((row) => {
                if (
                  row.date_of_loss &&
                  row.date_of_loss instanceof Date &&
                  row.date_of_loss.getFullYear() === y
                ) {
                  total += row.total_incurred || 0;
                }
              });
              return total;
            }),
            backgroundColor: "rgba(56, 189, 248, 0.8)",
          },
        ];

  instances.lossByType = new Chart(canvas, {
    type: "bar",
    data: {
      labels: sortedYears.map((y) => String(y)),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: primaryTypes.length > 1 },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const label = ctx.dataset.label || "";
              const value = fmtMoney(ctx.parsed.y);
              return label ? `${label}: ${value}` : value;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: primaryTypes.length > 1,
          title: { display: true, text: "Year" },
        },
        y: {
          beginAtZero: true,
          stacked: primaryTypes.length > 1,
          ticks: {
            callback: (value: number) => "$" + value.toLocaleString(),
          },
          title: { display: true, text: "Total Incurred ($)" },
        },
      },
    },
  });
}

function drawLossByYear(
  data: CanonicalRecord[],
  results: CalculationResults,
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const canvas = canvasRefs["lossByYearChart"];
  if (!canvas) return;

  const isCustomer = results.isExistingCustomer;

  const yearlyMap: Record<number, number> = {};
  data.forEach((row) => {
    if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
    const y = row.date_of_loss.getFullYear();
    if (!yearlyMap[y]) yearlyMap[y] = 0;
    yearlyMap[y] += row.total_incurred || 0;
  });

  const labels = Object.keys(yearlyMap)
    .map((y) => parseInt(y))
    .sort((a, b) => a - b);
  const dataPoints = labels.map((y) => yearlyMap[y]);

  // Customer mode: calculate hypothetical (without Voxel)
  const hypotheticalDataPoints: (number | null)[] = [];
  if (isCustomer && results.voxelStartDate) {
    const multiplier = 1 / Math.max(0.01, 1 - results.wcReduction);
    const startYear = results.voxelStartDate.getFullYear();
    const startMonth = results.voxelStartDate.getMonth();

    labels.forEach((y, idx) => {
      const actual = dataPoints[idx];
      if (y < startYear) {
        hypotheticalDataPoints.push(null);
      } else if (y === startYear) {
        const impactedMonths = 12 - startMonth;
        const factor = (startMonth * 1 + impactedMonths * multiplier) / 12;
        hypotheticalDataPoints.push(actual * factor);
      } else {
        hypotheticalDataPoints.push(actual * multiplier);
      }
    });
  }

  const datasets: any[] = [
    {
      label: isCustomer ? "Actual (With Voxel)" : "Total Incurred",
      data: dataPoints,
      borderColor: "rgba(56, 189, 248, 1)",
      backgroundColor: "rgba(56, 189, 248, 0.1)",
      tension: 0.4,
      fill: true,
    },
  ];

  if (isCustomer && hypotheticalDataPoints.length) {
    datasets.push({
      label: "Projected (No Voxel)",
      data: hypotheticalDataPoints,
      borderColor: "rgba(148, 163, 184, 1)",
      backgroundColor: "rgba(148, 163, 184, 0.1)",
      borderDash: [5, 5],
      tension: 0.4,
      fill: false,
    });
  }

  instances.lossByYear = new Chart(canvas, {
    type: "line",
    data: {
      labels: labels.map((y) => String(y)),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: isCustomer },
        tooltip: {
          callbacks: {
            label: (ctx: any) => " " + fmtMoney(ctx.parsed.y),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) => "$" + value.toLocaleString(),
          },
        },
      },
    },
  });
}

function drawCostComparison(
  results: CalculationResults,
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const canvas = canvasRefs["costComparisonChart"];
  if (!canvas) return;

  instances.costComparison = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Current", "Improved"],
      datasets: [
        {
          label: "Direct",
          data: [results.directManual, results.directImproved],
          backgroundColor: "rgba(56, 189, 248, 0.8)",
        },
        {
          label: "Indirect",
          data: [results.indirectManual, results.indirectImproved],
          backgroundColor: "rgba(34, 197, 94, 0.8)",
        },
        {
          label: "Observation",
          data: [results.obsManual, results.obsImproved],
          backgroundColor: "rgba(251, 146, 60, 0.8)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx: any) =>
              ctx.dataset.label + ": " + fmtMoney(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: { stacked: true },
        y: {
          beginAtZero: true,
          stacked: true,
          ticks: {
            callback: (value: number) => "$" + value.toLocaleString(),
          },
        },
      },
    },
  });
}

function drawImprovements(
  data: CanonicalRecord[],
  results: CalculationResults,
  params: AdjustmentParams,
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const canvas = canvasRefs["improvementsChart"];
  if (!canvas) return;

  const isCustomer = results.isExistingCustomer;
  const wcReduction =
    Math.max(0, Math.min(100, params.wcReduction)) / 100;
  const miscCostReduction =
    Math.max(0, Math.min(100, params.miscCostReduction)) / 100;
  const lostTimeReduction =
    Math.max(0, Math.min(100, params.lostTimeReduction)) / 100;
  const retentionImprovement =
    Math.max(0, Math.min(100, params.retentionImprovement)) / 100;
  const includeObs = params.includeObs;
  const mult = Math.max(0, params.indirectMult);
  const miscDirect = params.miscDirect;
  const miscIndirect = params.miscIndirect;
  const rate = params.rate;

  // Build yearly projection data from filtered records
  const yearlyMapForProjection: Record<number, number> = {};
  const yearlyClaimCounts: Record<number, number> = {};
  data.forEach((row) => {
    if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
    const y = row.date_of_loss.getFullYear();
    if (!yearlyMapForProjection[y]) {
      yearlyMapForProjection[y] = 0;
      yearlyClaimCounts[y] = 0;
    }
    yearlyMapForProjection[y] += row.total_incurred || 0;
    yearlyClaimCounts[y] += 1;
  });

  const historicalYears = Object.keys(yearlyMapForProjection)
    .map((y) => parseInt(y))
    .sort((a, b) => a - b);
  const latestYear =
    historicalYears.length > 0
      ? historicalYears[historicalYears.length - 1]
      : new Date().getFullYear();

  let annualBaselineCost = results.totalManual;
  let annualBaselineImproved = results.totalImproved;
  const inflationFactor = isCustomer
    ? results.totalManual / Math.max(0.01, results.totalImproved)
    : 1;

  if (historicalYears.length > 0) {
    let baselineIncurred = 0;
    let baselineClaims = 0;
    const sliceCount = Math.min(historicalYears.length, 3);
    const recentYears = historicalYears.slice(-sliceCount);
    recentYears.forEach((y) => {
      baselineIncurred += yearlyMapForProjection[y];
      baselineClaims += yearlyClaimCounts[y];
    });
    baselineIncurred /= sliceCount;
    baselineClaims /= sliceCount;

    const avgCostFromData =
      baselineIncurred / Math.max(baselineClaims, 1);
    const injuriesFromData = Math.round(baselineClaims);
    const indirectImprovementFactor =
      1 - (lostTimeReduction * 0.6 + retentionImprovement * 0.4);
    const sup = params.supCount;
    const shifts = params.shifts;
    const obsPerShiftManual = params.obsPerShift;
    const minManual = Math.max(0, params.minObsManual);
    const workdays = params.workdays;
    const obsSpeedImprovement = Math.max(1, params.obsSpeedImprovement);

    if (isCustomer) {
      const injuriesWith = injuriesFromData;
      const directWith = avgCostFromData * injuriesWith + miscDirect;
      const indirectWith =
        directWith * mult * indirectImprovementFactor + miscIndirect;
      const costWith =
        sup *
        shifts *
        obsPerShiftManual *
        (minManual / 60) *
        rate *
        workdays;

      annualBaselineImproved =
        directWith + indirectWith + (includeObs ? costWith : 0);
      annualBaselineCost = annualBaselineImproved * inflationFactor;
    } else {
      const injuriesManualProj = injuriesFromData;
      const injuriesImprovedProj = Math.max(
        0,
        Math.round(injuriesManualProj * (1 - wcReduction)),
      );
      const directManualProj =
        avgCostFromData * injuriesManualProj + miscDirect;
      const directImprovedProj =
        avgCostFromData * injuriesImprovedProj +
        miscDirect * (1 - miscCostReduction);
      const indirectManualProj =
        directManualProj * mult + miscIndirect;
      const indirectImprovedProj =
        directImprovedProj * mult * indirectImprovementFactor +
        miscIndirect * (1 - miscCostReduction);
      const minImproved = Math.max(0.1, minManual / obsSpeedImprovement);
      const costManualProj =
        sup *
        shifts *
        obsPerShiftManual *
        (minManual / 60) *
        rate *
        workdays;
      const costImprovedProj =
        sup *
        shifts *
        obsPerShiftManual *
        (minImproved / 60) *
        rate *
        workdays;

      annualBaselineCost =
        directManualProj +
        indirectManualProj +
        (includeObs ? costManualProj : 0);
      annualBaselineImproved =
        directImprovedProj +
        indirectImprovedProj +
        (includeObs ? costImprovedProj : 0);
    }
  }

  // Project 3 years into the future
  const projectionYears: number[] = [];
  const currentProjections: number[] = [];
  const improvedProjections: number[] = [];

  for (let i = 0; i < 3; i++) {
    projectionYears.push(latestYear + i + 1);
    currentProjections.push(annualBaselineCost);
    improvedProjections.push(annualBaselineImproved);
  }

  const allYearsForProjection = [...historicalYears, ...projectionYears];
  const improvementFactor =
    annualBaselineImproved / Math.max(0.01, annualBaselineCost);

  // Build historical full-cost data
  const historicalData = historicalYears.map((y) => {
    const yearIncurred = yearlyMapForProjection[y];
    const yearClaims = yearlyClaimCounts[y];
    const yearAvgCost = yearIncurred / Math.max(yearClaims, 1);
    const yearDirect = yearAvgCost * yearClaims + miscDirect;
    const yearIndirect = yearDirect * mult + miscIndirect;
    const costObsBaseline =
      params.supCount *
      params.shifts *
      params.obsPerShift *
      (Math.max(0, params.minObsManual) / 60) *
      rate *
      params.workdays;

    return yearDirect + yearIndirect + (includeObs ? costObsBaseline : 0);
  });

  // Build datasets
  const improvementDatasets: any[] = [];

  if (isCustomer) {
    const startYear = results.voxelStartDate
      ? results.voxelStartDate.getFullYear()
      : 9999;
    const startMonth = results.voxelStartDate
      ? results.voxelStartDate.getMonth()
      : 0;

    const histActual: number[] = [];
    const histHypothetical: number[] = [];

    historicalYears.forEach((y, idx) => {
      const val = historicalData[idx];
      if (y < startYear) {
        histActual.push(val);
        histHypothetical.push(val);
      } else {
        histActual.push(val);
        let factor = inflationFactor;
        if (y === startYear) {
          const impactedMonths = 12 - startMonth;
          factor =
            (startMonth * 1 + impactedMonths * inflationFactor) / 12;
        }
        histHypothetical.push(val * factor);
      }
    });

    improvementDatasets.push({
      label: "Actual (With Voxel)",
      data: [...histActual, null, null, null],
      borderColor: "rgba(56, 189, 248, 1)",
      backgroundColor: "rgba(56, 189, 248, 0.1)",
      borderWidth: 2,
      fill: false,
    });

    improvementDatasets.push({
      label: "Hypothetical (No Voxel)",
      data: [...histHypothetical, ...currentProjections],
      borderColor: "rgba(148, 163, 184, 1)",
      borderDash: [5, 5],
      borderWidth: 2,
      fill: false,
    });

    improvementDatasets.push({
      label: "Projected (With Voxel)",
      data: [
        ...new Array(historicalYears.length).fill(null),
        ...improvedProjections,
      ],
      borderColor: "rgba(56, 189, 248, 1)",
      borderWidth: 2,
      borderDash: [5, 5],
      fill: false,
    });
  } else {
    // Prospect mode
    const histImproved = historicalData.map((v) => v * improvementFactor);

    improvementDatasets.push({
      label: "Historical Actual",
      data: [...historicalData, null, null, null],
      borderColor: "rgba(148, 163, 184, 1)",
      backgroundColor: "rgba(148, 163, 184, 0.1)",
      borderWidth: 2,
      fill: false,
    });

    improvementDatasets.push({
      label: "Historical (if improved)",
      data: [...histImproved, null, null, null],
      borderColor: "rgba(34, 197, 94, 0.6)",
      backgroundColor: "rgba(34, 197, 94, 0.1)",
      borderWidth: 2,
      borderDash: [5, 5],
      fill: false,
    });

    improvementDatasets.push({
      label: "Projected Current",
      data: [
        ...new Array(historicalYears.length).fill(null),
        ...currentProjections,
      ],
      borderColor: "rgba(251, 146, 60, 1)",
      borderWidth: 2,
      borderDash: [10, 5],
      fill: false,
    });

    improvementDatasets.push({
      label: "Projected Improved",
      data: [
        ...new Array(historicalYears.length).fill(null),
        ...improvedProjections,
      ],
      borderColor: "rgba(34, 197, 94, 1)",
      borderWidth: 3,
      fill: false,
    });
  }

  instances.improvements = new Chart(canvas, {
    type: "line",
    data: {
      labels: allYearsForProjection.map((y) => String(y)),
      datasets: improvementDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              if (ctx.parsed.y === null) return null;
              return ctx.dataset.label + ": " + fmtMoney(ctx.parsed.y);
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Year" } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) => "$" + value.toLocaleString(),
          },
          title: { display: true, text: "Total Safety Cost ($)" },
        },
      },
    },
  });
}

function drawBreakdown(
  results: CalculationResults,
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const canvas = canvasRefs["breakdownChart"];
  if (!canvas) return;

  instances.breakdown = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Direct Cost", "Indirect Cost", "Observation Cost"],
      datasets: [
        {
          label: "Current",
          data: [
            results.directManual,
            results.indirectManual,
            results.obsManual,
          ],
          backgroundColor: "rgba(148, 163, 184, 0.8)",
        },
        {
          label: "Improved",
          data: [
            results.directImproved,
            results.indirectImproved,
            results.obsImproved,
          ],
          backgroundColor: "rgba(34, 197, 94, 0.8)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx: any) =>
              ctx.dataset.label + ": " + fmtMoney(ctx.parsed.y),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) => "$" + value.toLocaleString(),
          },
        },
      },
    },
  });
}

function drawSiteComparison(
  allData: CanonicalRecord[],
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const allSites = new Set<string>();
  const siteIncurredMap: Record<string, number> = {};
  const siteClaimsMap: Record<string, number> = {};

  allData.forEach((row) => {
    const site = row.site_name || "Unknown";
    allSites.add(site);
    if (!siteIncurredMap[site]) {
      siteIncurredMap[site] = 0;
      siteClaimsMap[site] = 0;
    }
    siteIncurredMap[site] += row.total_incurred || 0;
    siteClaimsMap[site] += 1;
  });

  if (allSites.size <= 1) return;

  const sortedSites = Array.from(allSites)
    .sort((a, b) => siteIncurredMap[b] - siteIncurredMap[a])
    .slice(0, 10);

  // Site comparison — total incurred
  const canvasIncurred = canvasRefs["siteComparisonChart"];
  if (canvasIncurred) {
    instances.siteComparison = new Chart(canvasIncurred, {
      type: "bar",
      data: {
        labels: sortedSites,
        datasets: [
          {
            label: "Total Incurred",
            data: sortedSites.map((s) => siteIncurredMap[s]),
            backgroundColor: "rgba(56, 189, 248, 0.8)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => fmtMoney(ctx.parsed.y),
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: number) => "$" + value.toLocaleString(),
            },
            title: { display: true, text: "Total Incurred ($)" },
          },
          x: { title: { display: true, text: "Site" } },
        },
      },
    });
  }

  // Site claims count
  const canvasClaims = canvasRefs["siteClaimsChart"];
  if (canvasClaims) {
    instances.siteClaims = new Chart(canvasClaims, {
      type: "bar",
      data: {
        labels: sortedSites,
        datasets: [
          {
            label: "Number of Claims",
            data: sortedSites.map((s) => siteClaimsMap[s]),
            backgroundColor: "rgba(34, 197, 94, 0.8)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.parsed.y} claim(s)`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            title: { display: true, text: "Number of Claims" },
          },
          x: { title: { display: true, text: "Site" } },
        },
      },
    });
  }
}

function drawLostDays(
  data: CanonicalRecord[],
  lostTimeReduction: number,
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
): void {
  const lostDaysData = data.filter(
    (row) => row.lost_days !== undefined && (row.lost_days as number) > 0,
  );

  if (lostDaysData.length === 0) return;

  drawLostDaysCharts(lostDaysData, canvasRefs, instances, lostTimeReduction);
}

/** Internal: renders the 3 lost-days charts */
function drawLostDaysCharts(
  lostDaysData: CanonicalRecord[],
  canvasRefs: Record<string, HTMLCanvasElement | null>,
  instances: Record<string, any>,
  lostTimeReduction: number,
): void {
  // 9. Lost Days by Category (horizontal bar)
  const canvasByCategory = canvasRefs["lostDaysByCategoryChart"];
  if (canvasByCategory) {
    const lostDaysByCategory: Record<
      string,
      { total: number; count: number }
    > = {};
    lostDaysData.forEach((row) => {
      const category = row.cause_of_loss || "Uncategorized";
      if (!lostDaysByCategory[category])
        lostDaysByCategory[category] = { total: 0, count: 0 };
      lostDaysByCategory[category].total += (row.lost_days as number) || 0;
      lostDaysByCategory[category].count += 1;
    });

    const sortedCategories = Object.entries(lostDaysByCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    instances.lostDaysByCategory = new Chart(canvasByCategory, {
      type: "bar",
      data: {
        labels: sortedCategories.map(([cat]) => cat),
        datasets: [
          {
            label: "Total Lost Days",
            data: sortedCategories.map(([, d]) => d.total),
            backgroundColor: "rgba(251, 146, 60, 0.8)",
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const idx = ctx.dataIndex;
                const d = sortedCategories[idx][1];
                return `${fmtInt(d.total)} days (${d.count} claim(s), avg: ${fmtNum(d.total / d.count, 1)} days/claim)`;
              },
            },
          },
        },
      },
    });
  }

  // 10. Lost Days Projection (bar — current vs projected)
  const canvasProjection = canvasRefs["lostDaysProjectionChart"];
  if (canvasProjection) {
    const totalLostDays = lostDaysData.reduce(
      (sum, row) => sum + ((row.lost_days as number) || 0),
      0,
    );
    const projectedLostDays = totalLostDays * (1 - lostTimeReduction);

    instances.lostDaysProjection = new Chart(canvasProjection, {
      type: "bar",
      data: {
        labels: ["Current", "Projected (with Voxel)"],
        datasets: [
          {
            label: "Total Lost Days",
            data: [totalLostDays, projectedLostDays],
            backgroundColor: [
              "rgba(148, 163, 184, 0.8)",
              "rgba(34, 197, 94, 0.8)",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const savings = totalLostDays - projectedLostDays;
                if (ctx.dataIndex === 1) {
                  return `${fmtInt(ctx.parsed.y)} days (savings: ${fmtInt(savings)} days, ${(lostTimeReduction * 100).toFixed(0)}% reduction)`;
                }
                return `${fmtInt(ctx.parsed.y)} days`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: Math.max(1, Math.ceil(totalLostDays / 10)),
            },
            title: { display: true, text: "Total Lost Days" },
          },
        },
      },
    });
  }

  // 11. Lost Days Trend (line — YoY)
  const canvasTrend = canvasRefs["lostDaysTrendChart"];
  if (canvasTrend) {
    const lostDaysByYear: Record<number, number> = {};
    lostDaysData.forEach((row) => {
      if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
      const year = row.date_of_loss.getFullYear();
      if (!lostDaysByYear[year]) lostDaysByYear[year] = 0;
      lostDaysByYear[year] += (row.lost_days as number) || 0;
    });

    const lostDaysYears = Object.keys(lostDaysByYear)
      .map((y) => parseInt(y))
      .sort((a, b) => a - b);
    const lostDaysValues = lostDaysYears.map((y) => lostDaysByYear[y]);
    const projectedLostDaysValues = lostDaysValues.map(
      (v) => v * (1 - lostTimeReduction),
    );

    instances.lostDaysTrend = new Chart(canvasTrend, {
      type: "line",
      data: {
        labels: lostDaysYears.map((y) => String(y)),
        datasets: [
          {
            label: "Current Lost Days",
            data: lostDaysValues,
            borderColor: "rgba(148, 163, 184, 1)",
            backgroundColor: "rgba(148, 163, 184, 0.1)",
            tension: 0.4,
          },
          {
            label: "Projected Lost Days (with Voxel)",
            data: projectedLostDaysValues,
            borderColor: "rgba(34, 197, 94, 1)",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            borderDash: [5, 5],
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${fmtInt(ctx.parsed.y)} days`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Lost Days" },
          },
          x: { title: { display: true, text: "Year" } },
        },
      },
    });
  }
}
