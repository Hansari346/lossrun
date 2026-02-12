import { useSignal } from "@preact/signals";
import {
  adjustments,
  currentPage,
  canonicalData,
  selectedSite,
  availableSites,
} from "../state/store";
import {
  getPresetValues,
  calculateResults,
  calculateObservationCost,
  getFilteredData,
} from "../lib/calculations";
import type { AdjustmentParams } from "../types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function buildYearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 10; y--) {
    years.push(y);
  }
  return years;
}

export function AdjustmentsPage() {
  const activePreset = useSignal<string>("balanced");
  const showAdvanced = useSignal(false);

  // Helper to update a single adjustment field
  const updateAdj = (key: keyof AdjustmentParams, value: any) => {
    adjustments.value = { ...adjustments.value, [key]: value };
  };

  // Helper to parse numeric input
  const numVal = (e: Event): number => {
    return parseFloat((e.target as HTMLInputElement).value) || 0;
  };

  // Apply a preset
  const applyPreset = (preset: "conservative" | "balanced" | "aggressive") => {
    activePreset.value = preset;
    const vals = getPresetValues(preset);
    adjustments.value = { ...adjustments.value, ...vals };
  };

  // Calculate obs total from calculator inputs
  const recalcObs = () => {
    const a = adjustments.value;
    const total = Math.round(a.supCount * a.shifts * a.obsPerShift * a.workdays);
    adjustments.value = { ...adjustments.value, totalAnnualObs: total };
  };

  // Calculate and navigate to results
  const onCalculate = () => {
    calculateResults();
    currentPage.value = 3;
  };

  const adj = adjustments.value;
  const years = buildYearOptions();

  // Compute observation cost summary for display
  const obsCost = calculateObservationCost(
    adj.totalAnnualObs,
    adj.minObsManual,
    adj.obsSpeedImprovement,
    adj.rate,
    adj.headcount,
    adj.trainingHours,
  );

  return (
    <div id="page2" class="page active">
      <p>
        Adjust calculation assumptions and parameters. Data from the ingested
        loss run will be used to calculate baseline metrics.
      </p>

      {/* Site filter */}
      {availableSites.value.length > 1 && (
        <div class="card" style={{ marginBottom: "16px" }}>
          <div class="card-header">
            <h2 style={{ fontSize: "1rem", margin: 0 }}>
              Filter by site (optional)
            </h2>
          </div>
          <label>Select site for analysis</label>
          <select
            value={selectedSite.value}
            onChange={(e) => {
              selectedSite.value = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="all">All Sites</option>
            {availableSites.value.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
          <div class="hint">
            Select a specific site to focus the analysis, or leave as "All
            Sites" to analyze all locations.
          </div>
        </div>
      )}

      {/* Existing Customer Toggle */}
      <div class="card" style={{ marginBottom: "16px" }}>
        <div class="card-header">
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Customer Mode</h2>
        </div>
        <div class="switch" style={{ background: "transparent", padding: 0, border: "none" }}>
          <input
            type="checkbox"
            id="existingCustomerToggle"
            checked={adj.isExistingCustomer}
            onChange={(e) =>
              updateAdj(
                "isExistingCustomer",
                (e.target as HTMLInputElement).checked,
              )
            }
          />
          <label
            for="existingCustomerToggle"
            style={{ fontWeight: 600, color: "var(--fg)" }}
          >
            Currently using Voxel?
          </label>
        </div>
        {adj.isExistingCustomer && (
          <div style={{ marginTop: "12px" }}>
            <label>Voxel Start Date</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <select
                style={{ flex: 1 }}
                value={String(adj.voxelStartMonth)}
                onChange={(e) =>
                  updateAdj(
                    "voxelStartMonth",
                    parseInt((e.target as HTMLSelectElement).value, 10),
                  )
                }
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={String(i)}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                style={{ flex: 1 }}
                value={String(adj.voxelStartYear)}
                onChange={(e) =>
                  updateAdj(
                    "voxelStartYear",
                    parseInt((e.target as HTMLSelectElement).value, 10),
                  )
                }
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div class="hint">
              Select when Voxel was deployed to estimate savings realized to
              date.
            </div>
          </div>
        )}
      </div>

      {/* Improvement Assumptions */}
      <div class="card">
        <div class="card-header">
          <h2>Assumptions for Improved Scenario</h2>
          <div class="presets">
            {(["conservative", "balanced", "aggressive"] as const).map(
              (preset) => (
                <button
                  key={preset}
                  class={`btn-preset${activePreset.value === preset ? " active" : ""}`}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>

        <div class="row3">
          <div>
            <label>Observation speed improvement</label>
            <select
              value={String(adj.obsSpeedImprovement)}
              onChange={(e) =>
                updateAdj(
                  "obsSpeedImprovement",
                  parseFloat((e.target as HTMLSelectElement).value),
                )
              }
            >
              <option value="1.5">Low</option>
              <option value="2.0">Medium</option>
              <option value="2.5">High</option>
            </select>
            <div class="hint">How much faster observations become</div>
          </div>
          <div>
            <label>WC claims reduction (%)</label>
            <input
              type="number"
              value={adj.wcReduction}
              min={0}
              max={100}
              step={1}
              onInput={(e) => updateAdj("wcReduction", numVal(e))}
            />
            <div class="hint">Reduction in workers' compensation claims</div>
          </div>
        </div>

        <div class="row3" style={{ marginTop: "8px" }}>
          <div>
            <label>Lost time reduction (%)</label>
            <input
              type="number"
              value={adj.lostTimeReduction}
              min={0}
              max={100}
              step={1}
              onInput={(e) => updateAdj("lostTimeReduction", numVal(e))}
            />
            <div class="hint">Reduction in lost time days</div>
          </div>
          <div>
            <label>Retention improvement (%)</label>
            <input
              type="number"
              value={adj.retentionImprovement}
              min={0}
              max={100}
              step={1}
              onInput={(e) => updateAdj("retentionImprovement", numVal(e))}
            />
            <div class="hint">
              Improvement in retention (fewer turnover events)
            </div>
          </div>
          <div>
            <label>Misc Cost Reduction (%)</label>
            <input
              type="number"
              value={adj.miscCostReduction}
              min={0}
              max={100}
              step={1}
              onInput={(e) => updateAdj("miscCostReduction", numVal(e))}
            />
            <div class="hint">
              Reduction in misc direct and indirect costs
            </div>
          </div>
        </div>
      </div>

      {/* Injury Cost Inputs */}
      <div class="card">
        <div class="card-header">
          <h2>Injury Cost Inputs</h2>
        </div>
        <div class="row2">
          <div>
            <label>Average direct cost per injury</label>
            <input
              type="number"
              value={adj.avgCost}
              min={0}
              step={1}
              onInput={(e) => updateAdj("avgCost", numVal(e))}
            />
            <div class="hint">
              Auto-calculated from ingested data, or enter manually.
            </div>
          </div>
          <div>
            <label>Injuries last year (count or YTD)</label>
            <input
              type="number"
              value={adj.injuries}
              min={0}
              step={1}
              onInput={(e) => updateAdj("injuries", numVal(e))}
            />
            <div class="hint">
              Auto-calculated from ingested data, or enter manually.
            </div>
          </div>
        </div>
        <div class="row2" style={{ marginTop: "8px" }}>
          <div>
            <label>Misc Cost (Direct)</label>
            <input
              type="number"
              value={adj.miscDirect}
              min={0}
              step={1}
              onInput={(e) => updateAdj("miscDirect", numVal(e))}
            />
            <div class="hint">
              Additional direct costs not included in average injury cost.
            </div>
          </div>
          <div>
            <label>Misc Cost (Indirect)</label>
            <input
              type="number"
              value={adj.miscIndirect}
              min={0}
              step={1}
              onInput={(e) => updateAdj("miscIndirect", numVal(e))}
            />
            <div class="hint">
              Additional indirect costs not captured by other methods.
            </div>
          </div>
        </div>
        <div class="sep"></div>
        <div class="row2">
          <div>
            <label>Indirect cost multiplier</label>
            <input
              type="number"
              value={adj.indirectMult}
              min={0}
              step={0.05}
              onInput={(e) => updateAdj("indirectMult", numVal(e))}
            />
            <div class="hint">Typical range ~1.1x–4x.</div>
          </div>
          <div></div>
        </div>
        <div class="sep"></div>

        {/* YTD Annualization */}
        <div class="switch small">
          <input
            type="checkbox"
            id="isYTD"
            checked={adj.annualize}
            onChange={(e) =>
              updateAdj("annualize", (e.target as HTMLInputElement).checked)
            }
          />
          <label for="isYTD">
            I only have YTD injuries (annualize to 12 months)
          </label>
        </div>
        {adj.annualize && (
          <div class="row2">
            <div>
              <label>Months observed (1–12)</label>
              <input
                type="number"
                value={adj.annualizeMonths}
                min={1}
                max={12}
                step={1}
                onInput={(e) => updateAdj("annualizeMonths", numVal(e))}
              />
              <div class="hint">
                Annualized injuries = injuries × (12 ÷ months)
              </div>
            </div>
            <div>
              <label>Annualization rounding</label>
              <select
                value={adj.annualizeRounding}
                onChange={(e) =>
                  updateAdj(
                    "annualizeRounding",
                    (e.target as HTMLSelectElement).value as
                      | "round"
                      | "ceil"
                      | "floor",
                  )
                }
              >
                <option value="ceil">Ceiling (round up)</option>
                <option value="round">Nearest</option>
                <option value="floor">Floor (round down)</option>
              </select>
              <div class="hint">
                Rounding applied to the annualized injury count.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Observation Program Costs */}
      <div class="card">
        <div class="card-header">
          <h2>Observation Program Costs</h2>
        </div>
        <div class="switch small">
          <input
            type="checkbox"
            id="includeObs"
            checked={adj.includeObs}
            onChange={(e) =>
              updateAdj("includeObs", (e.target as HTMLInputElement).checked)
            }
          />
          <label for="includeObs">
            Include observation program in totals
          </label>
        </div>
        <div class="row3">
          <div>
            <label>Total Headcount (#)</label>
            <input
              type="number"
              value={adj.headcount}
              min={1}
              step={1}
              onInput={(e) => updateAdj("headcount", numVal(e))}
            />
            <div class="hint">For TRIR calculation</div>
          </div>
          <div>
            <label>Labor rate (per hour)</label>
            <input
              type="number"
              value={adj.rate}
              min={0}
              step={1}
              onInput={(e) => updateAdj("rate", numVal(e))}
            />
          </div>
          <div>
            <label>Total Annual Observations (#)</label>
            <input
              type="number"
              value={adj.totalAnnualObs}
              min={0}
              step={100}
              onInput={(e) => updateAdj("totalAnnualObs", numVal(e))}
            />
            <div class="hint">Est. total manual observations / year</div>
          </div>
        </div>

        {/* Advanced Calculator */}
        <div
          class="advanced-toggle"
          onClick={() => {
            showAdvanced.value = !showAdvanced.value;
          }}
        >
          {showAdvanced.value ? "Hide" : "Show"} Advanced / Calculator
        </div>
        {showAdvanced.value && (
          <div class="advanced-section open">
            <p
              style={{
                marginBottom: "8px",
                fontSize: "0.9rem",
                color: "#64748B",
              }}
            >
              Calculator: Updates "Total Annual Observations" above.
            </p>
            <div class="row3">
              <div>
                <label>Supervisors (#)</label>
                <input
                  type="number"
                  value={adj.supCount}
                  min={0}
                  step={1}
                  onInput={(e) => {
                    updateAdj("supCount", numVal(e));
                    recalcObs();
                  }}
                />
              </div>
              <div>
                <label>Shifts per day (#)</label>
                <input
                  type="number"
                  value={adj.shifts}
                  min={1}
                  step={1}
                  onInput={(e) => {
                    updateAdj("shifts", numVal(e));
                    recalcObs();
                  }}
                />
              </div>
              <div>
                <label>Observations per shift</label>
                <input
                  type="number"
                  value={adj.obsPerShift}
                  min={0}
                  step={1}
                  onInput={(e) => {
                    updateAdj("obsPerShift", numVal(e));
                    recalcObs();
                  }}
                />
              </div>
            </div>
            <div class="row3" style={{ marginTop: "8px" }}>
              <div>
                <label>Workdays per year</label>
                <input
                  type="number"
                  value={adj.workdays}
                  min={0}
                  step={1}
                  onInput={(e) => {
                    updateAdj("workdays", numVal(e));
                    recalcObs();
                  }}
                />
              </div>
              <div>
                <label>Minutes per observation</label>
                <input
                  type="number"
                  value={adj.minObsManual}
                  min={0}
                  step={1}
                  onInput={(e) => updateAdj("minObsManual", numVal(e))}
                />
              </div>
              <div>
                <label>Training Hours/Year</label>
                <input
                  type="number"
                  value={adj.trainingHours}
                  min={0}
                  step={0.5}
                  onInput={(e) => updateAdj("trainingHours", numVal(e))}
                />
                <div class="hint">Safety training hours per employee</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calculate Button */}
      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <button
          onClick={onCalculate}
          style={{ padding: "12px 24px", fontSize: "1rem" }}
        >
          Calculate &amp; View Results →
        </button>
      </div>
    </div>
  );
}
