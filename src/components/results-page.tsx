import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  results,
  adjustments,
  chartInstances,
  canonicalData,
  selectedSite,
} from "../state/store";
import { drawCharts, destroyCharts } from "../lib/charts";
import { getFilteredData } from "../lib/calculations";
import { exportToPPT } from "../lib/export-ppt";
import { fmtMoney, fmtInt, fmtNum } from "../lib/formatting";

/** Chart definition: id → title */
const CHART_SECTIONS: { id: string; title: string; fullWidth?: boolean }[] = [
  {
    id: "causeOfLossChart",
    title: "Indemnity Breakdown by Loss Category",
    fullWidth: true,
  },
  { id: "lossByTypeChart", title: "Loss by Type Year-over-Year" },
  { id: "lossByYearChart", title: "Total Incurred by Year" },
  { id: "costComparisonChart", title: "Current vs Improved Costs" },
  { id: "improvementsChart", title: "Projected Improvements" },
  { id: "breakdownChart", title: "Total Cost Breakdown by Category", fullWidth: true },
  {
    id: "siteComparisonChart",
    title: "Site Comparison (Total Incurred)",
  },
  { id: "siteClaimsChart", title: "Site Claims Count" },
  {
    id: "lostDaysByCategoryChart",
    title: "Lost Days by Category",
  },
  { id: "lostDaysProjectionChart", title: "Lost Days Projection" },
  { id: "lostDaysTrendChart", title: "Lost Days Trend" },
];

export function ResultsPage() {
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const collapsedCharts = useSignal<Record<string, boolean>>({});

  // Draw charts when results change
  useEffect(() => {
    if (!results.value) return;

    const filteredData = getFilteredData(
      canonicalData.value,
      selectedSite.value,
    );
    const allData = canonicalData.value;

    const instances = drawCharts(
      results.value,
      filteredData,
      allData,
      canvasRefs.current,
      chartInstances.value,
      adjustments.value,
    );
    chartInstances.value = instances;

    return () => {
      destroyCharts(instances);
    };
  }, [results.value]);

  const toggleChart = (chartId: string) => {
    collapsedCharts.value = {
      ...collapsedCharts.value,
      [chartId]: !collapsedCharts.value[chartId],
    };
  };

  const handleExport = async () => {
    if (!results.value) return;
    const chartImages: Record<string, string> = {};
    Object.entries(canvasRefs.current).forEach(([id, canvas]) => {
      if (canvas) {
        chartImages[id] = canvas.toDataURL("image/png");
      }
    });
    await exportToPPT(
      results.value,
      chartImages,
      adjustments.value.isExistingCustomer,
    );
  };

  const r = results.value;
  if (!r) {
    return (
      <div id="page3" class="page active">
        <div class="status">
          No results yet. Upload data and visit the Adjustments page first.
        </div>
      </div>
    );
  }

  const isCustomer = r.isExistingCustomer;
  const currentLabel = isCustomer ? "Projected (No Voxel)" : "Current";
  const improvedLabel = isCustomer ? "Actual (With Voxel)" : "Improved";

  // Compute lost-days KPIs
  const filteredData = getFilteredData(
    canonicalData.value,
    selectedSite.value,
  );
  const lostDaysData = filteredData.filter(
    (row) => row.lost_days !== undefined && (row.lost_days as number) > 0,
  );
  const totalLostDaysCurrent = lostDaysData.reduce(
    (sum, row) => sum + ((row.lost_days as number) || 0),
    0,
  );
  const lostTimeReduction =
    Math.max(0, Math.min(100, adjustments.value.lostTimeReduction)) / 100;
  const totalLostDaysProjected = totalLostDaysCurrent * (1 - lostTimeReduction);
  const avgLostDaysCurrent =
    lostDaysData.length > 0 ? totalLostDaysCurrent / lostDaysData.length : 0;
  const avgLostDaysProjected = avgLostDaysCurrent * (1 - lostTimeReduction);

  return (
    <div id="page3" class="page active">
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
        }}
      >
        <div>
          <p>
            View comprehensive analysis of losses and projected improvements
            based on your assumptions.
          </p>
        </div>
        <button class="btn-ppt" onClick={handleExport}>
          <span>Download PowerPoint</span>
        </button>
      </div>

      {/* KPI Summary Tiles */}
      <div class="card">
        <div class="card-header">
          <h2>Summary Metrics</h2>
        </div>
        <div class="kpi">
          <div class="tile">
            <h3>Direct Cost — {currentLabel}</h3>
            <div class="v">{fmtMoney(r.directManual)}</div>
          </div>
          <div class="tile">
            <h3>Direct Cost — {improvedLabel}</h3>
            <div class="v">{fmtMoney(r.directImproved)}</div>
          </div>
          <div class="tile">
            <h3>Indirect Cost — {currentLabel}</h3>
            <div class="v">{fmtMoney(r.indirectManual)}</div>
          </div>
          <div class="tile">
            <h3>Indirect Cost — {improvedLabel}</h3>
            <div class="v">{fmtMoney(r.indirectImproved)}</div>
          </div>
          <div class="tile">
            <h3>Observation Cost — {currentLabel}</h3>
            <div class="v">{fmtMoney(r.obsManual)}</div>
          </div>
          <div class="tile">
            <h3>Observation Cost — {improvedLabel}</h3>
            <div class="v">{fmtMoney(r.obsImproved)}</div>
          </div>
          <div class="tile">
            <h3>Total Safety Cost — {currentLabel}</h3>
            <div class="v total">{fmtMoney(r.totalManual)}</div>
          </div>
          <div class="tile">
            <h3>Total Safety Cost — {improvedLabel}</h3>
            <div class="v total">{fmtMoney(r.totalImproved)}</div>
          </div>
        </div>
        <div class="sep"></div>
        <div class="kpi">
          <div class="tile">
            <h3>
              {isCustomer ? "Estimated Savings" : "Potential Savings"}
            </h3>
            <div class="v total">{fmtMoney(r.annualSavings)}</div>
          </div>
          <div class="tile">
            <h3>TRIR — {currentLabel}</h3>
            <div class="v">{fmtNum(r.trirManual, 2)}</div>
          </div>
          <div class="tile">
            <h3>TRIR — {improvedLabel}</h3>
            <div class="v">{fmtNum(r.trirImproved, 2)}</div>
          </div>
          <div class="tile">
            <h3>Injuries — {currentLabel}</h3>
            <div class="v">{fmtInt(r.injuriesManual)}</div>
          </div>
          <div class="tile">
            <h3>Injuries — {improvedLabel}</h3>
            <div class="v">{fmtInt(r.injuriesImproved)}</div>
          </div>
          {r.paybackData.paybackMonth > 0 && (
            <div class="tile">
              <h3>Payback Period</h3>
              <div class="v">{r.paybackData.paybackMonth} months</div>
            </div>
          )}
        </div>
      </div>

      {/* Chart Sections */}
      {renderChartPairs()}

      {/* Lost Days KPI tiles (alongside lost days charts) */}
      {lostDaysData.length > 0 && (
        <div class="card" style={{ marginTop: "16px" }}>
          <div class="card-header">
            <h2>Lost Days Summary</h2>
          </div>
          <div class="kpi" style={{ marginTop: 0 }}>
            <div class="tile">
              <h3>Current Avg Lost Days/Claim</h3>
              <div class="v">{fmtNum(avgLostDaysCurrent, 1)}</div>
            </div>
            <div class="tile">
              <h3>Projected Avg Lost Days/Claim</h3>
              <div class="v">{fmtNum(avgLostDaysProjected, 1)}</div>
            </div>
            <div class="tile">
              <h3>Total Lost Days (Current)</h3>
              <div class="v">{fmtInt(totalLostDaysCurrent)}</div>
            </div>
            <div class="tile">
              <h3>Total Lost Days (Projected)</h3>
              <div class="v">{fmtInt(totalLostDaysProjected)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderChartPairs() {
    const elements: preact.JSX.Element[] = [];
    let i = 0;

    while (i < CHART_SECTIONS.length) {
      const chart = CHART_SECTIONS[i];

      if (chart.fullWidth) {
        // Full-width chart
        elements.push(
          <div class="card" style={{ marginTop: "16px" }} key={chart.id}>
            <div
              class="card-header"
              onClick={() => toggleChart(chart.id)}
              style={{ cursor: "pointer" }}
            >
              <h2>{chart.title}</h2>
              <span class="collapse-toggle">
                {collapsedCharts.value[chart.id] ? "+" : "\u2212"}
              </span>
            </div>
            {!collapsedCharts.value[chart.id] && (
              <div class="chart-content">
                <div class="chart-container" style={{ height: "400px" }}>
                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current[chart.id] = el;
                    }}
                  />
                </div>
              </div>
            )}
          </div>,
        );
        i++;
      } else {
        // Pair two charts side-by-side
        const next = i + 1 < CHART_SECTIONS.length ? CHART_SECTIONS[i + 1] : null;
        if (next && !next.fullWidth) {
          elements.push(
            <div class="row" style={{ marginTop: "16px" }} key={chart.id + "-row"}>
              <div class="col">
                {renderChartCard(chart)}
              </div>
              <div class="col">
                {renderChartCard(next)}
              </div>
            </div>,
          );
          i += 2;
        } else {
          // Single non-full-width chart in a row
          elements.push(
            <div class="card" style={{ marginTop: "16px" }} key={chart.id}>
              <div
                class="card-header"
                onClick={() => toggleChart(chart.id)}
                style={{ cursor: "pointer" }}
              >
                <h2>{chart.title}</h2>
                <span class="collapse-toggle">
                  {collapsedCharts.value[chart.id] ? "+" : "\u2212"}
                </span>
              </div>
              {!collapsedCharts.value[chart.id] && (
                <div class="chart-content">
                  <div class="chart-container">
                    <canvas
                      ref={(el) => {
                        if (el) canvasRefs.current[chart.id] = el;
                      }}
                    />
                  </div>
                </div>
              )}
            </div>,
          );
          i++;
        }
      }
    }

    return <>{elements}</>;
  }

  function renderChartCard(chart: { id: string; title: string }) {
    return (
      <div class="card">
        <div
          class="card-header"
          onClick={() => toggleChart(chart.id)}
          style={{ cursor: "pointer" }}
        >
          <h2>{chart.title}</h2>
          <span class="collapse-toggle">
            {collapsedCharts.value[chart.id] ? "+" : "\u2212"}
          </span>
        </div>
        {!collapsedCharts.value[chart.id] && (
          <div class="chart-content">
            <div class="chart-container">
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current[chart.id] = el;
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
}
