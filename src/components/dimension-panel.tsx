import { detectedDimensions, dimensionOverrides, activeDimensions } from "../state/store";
import { DIMENSION_KEYS } from "../lib/dimensions";
import type { DimensionKey } from "../types";

/** Human-readable labels for dimension keys */
const DIMENSION_LABELS: Record<DimensionKey, string> = {
  cause_of_loss: "Cause of Loss",
  body_part: "Body Part",
  claim_category: "Claim Category",
  lost_days: "Lost Time / Days",
  site_comparison: "Site Comparison",
  loss_description: "Loss Description",
};

export function DimensionPanel() {
  const detected = detectedDimensions.value;
  if (!detected) return null; // No data loaded yet

  const active = activeDimensions.value;

  const toggleDimension = (key: DimensionKey) => {
    const current = dimensionOverrides.value;
    const currentActive = active[key];
    dimensionOverrides.value = { ...current, [key]: !currentActive };
  };

  return (
    <div class="card" style={{ marginBottom: "16px" }}>
      <div class="card-header">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>Detected Dimensions</h2>
      </div>
      <p style={{ fontSize: "0.875rem", color: "#64748B", margin: "0 0 12px" }}>
        We detected these analysis dimensions in your data. Toggle to include or exclude from analysis.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
        {DIMENSION_KEYS.map((key) => {
          const info = detected[key];
          const isActive = active[key];
          const coverage = Math.round(info.coverage * 100);
          return (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: isActive ? "var(--card-bg, #f8fafc)" : "transparent",
                border: `1px solid ${isActive ? "var(--accent, #6366f1)" : "#e2e8f0"}`,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => toggleDimension(key)}
                style={{ accentColor: "var(--accent, #6366f1)" }}
              />
              <div>
                <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                  {DIMENSION_LABELS[key]}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {info.available
                    ? `${coverage}% populated · ${info.distinctValues} values`
                    : info.recordCount === 0
                      ? "No data found"
                      : `${coverage}% populated (below threshold)`}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
