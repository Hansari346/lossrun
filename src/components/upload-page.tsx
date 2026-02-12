import { useSignal } from "@preact/signals";
import {
  workbook,
  currentPage,
  headerRow,
  sheetNames,
  statusMessage,
  canonicalData,
  currentSheetName,
} from "../state/store";
import {
  handleFileSelect,
  handleSheetSelect,
  applyMappingAndLoad,
} from "../lib/parsing";
import {
  requiredFields,
  optionalFields,
  findBestMatch,
} from "../lib/field-mapping";
import type { FieldDefinition } from "../types";

// Merge required + optional for the mapping table
const allFields: Record<string, FieldDefinition> = {
  ...requiredFields,
  ...optionalFields,
};
const fieldKeys = Object.keys(allFields);

export function UploadPage() {
  // Local UI state: per-field column overrides (field key → header index)
  const overrides = useSignal<Record<string, number>>({});
  // Sample data from the last handleSheetSelect call (for auto-mapping)
  const sampleData = useSignal<any[][] | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      overrides.value = {};
      sampleData.value = null;
      handleFileSelect(file);
    }
  }

  function onSheetChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    overrides.value = {};
    const result = handleSheetSelect(select.value);
    sampleData.value = result?.sampleData ?? null;
  }

  function onApply() {
    // Build final mapping: start with auto-detected, then overlay manual overrides
    const finalMapping: Record<string, number> = {};
    const headers = headerRow.value;
    const sd = sampleData.value;

    fieldKeys.forEach((key) => {
      const fieldDef = allFields[key];
      // Check for manual override first
      if (overrides.value[key] !== undefined && overrides.value[key] >= 0) {
        finalMapping[key] = overrides.value[key];
      } else {
        // Use auto-detected match
        const match = findBestMatch(headers, sd, fieldDef);
        if (match) {
          finalMapping[key] = match.index;
        }
      }
    });

    const success = applyMappingAndLoad(finalMapping);
    if (success) {
      currentPage.value = 2;
    }
  }

  function setOverride(key: string, idx: number) {
    overrides.value = { ...overrides.value, [key]: idx };
  }

  // ── Derived values ──────────────────────────────────────────────────────

  const headers = headerRow.value;
  const sheets = sheetNames.value;
  const hasHeaders = headers.length > 0;
  const sd = sampleData.value;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div id="page1" class="page active">
      <p>
        Upload a carrier loss run, map the key fields, then proceed to
        adjustments and results. Required fields:{" "}
        <strong>Site</strong>, <strong>Date of Loss</strong>, and{" "}
        <strong>Total Incurred</strong>.
      </p>

      <div class="row">
        {/* ── Column 1: Upload ─────────────────────────────────────── */}
        <div class="col">
          <div class="card">
            <div class="card-header">
              <h2 style={{ fontSize: "1rem", margin: 0 }}>
                1. Upload loss run
              </h2>
              <span class="pill">
                <span class="key">Step 1</span>
                <span>Excel (.xlsx)</span>
              </span>
            </div>

            <label for="fileInput">Loss run file (.xlsx)</label>
            <input
              type="file"
              id="fileInput"
              accept=".xlsx,.xls"
              onChange={onFileChange}
            />

            <div style={{ marginTop: "10px" }}>
              <label for="sheetSelect">Sheet</label>
              <select
                id="sheetSelect"
                disabled={sheets.length === 0}
                onChange={onSheetChange}
                value={currentSheetName.value ?? ""}
              >
                {sheets.length === 0 ? (
                  <option value="">Select a file first&hellip;</option>
                ) : (
                  sheets.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {statusMessage.value && (
              <div class="status">{statusMessage.value}</div>
            )}
          </div>
        </div>

        {/* ── Column 2: Mapping ────────────────────────────────────── */}
        <div class="col">
          <div class="card">
            <div class="card-header">
              <h2 style={{ fontSize: "1rem", margin: 0 }}>2. Map columns</h2>
              <span class="pill">
                <span class="key">Step 2</span>
                <span>Field mapping</span>
              </span>
            </div>

            <p class="small">
              Map columns from your sheet to the tool's fields. Fields marked{" "}
              <span class="mapping-required">required</span> must be mapped.
            </p>

            {!hasHeaders ? (
              <div class="status">
                Select a sheet to see available columns.
              </div>
            ) : (
              <div>
                <table class="mapping-table">
                  <thead>
                    <tr>
                      <th style={{ width: "35%" }}>Tool field</th>
                      <th style={{ width: "40%" }}>Column from sheet</th>
                      <th style={{ width: "25%" }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldKeys.map((key) => {
                      const meta = allFields[key];
                      const autoMatch = findBestMatch(headers, sd, meta);
                      const currentIdx =
                        overrides.value[key] !== undefined
                          ? overrides.value[key]
                          : autoMatch
                            ? autoMatch.index
                            : -1;

                      return (
                        <tr key={key}>
                          <td>
                            <strong>{meta.label}</strong>
                            {meta.required && (
                              <span class="mapping-required">required</span>
                            )}
                          </td>
                          <td>
                            <select
                              value={String(currentIdx)}
                              onChange={(e) =>
                                setOverride(
                                  key,
                                  parseInt(
                                    (e.target as HTMLSelectElement).value,
                                    10,
                                  ),
                                )
                              }
                            >
                              <option value="-1">
                                {meta.required
                                  ? "\u2014 Select column \u2014"
                                  : "Not mapped"}
                              </option>
                              {headers.map((h, i) => (
                                <option key={i} value={String(i)}>
                                  {h || "(blank)"}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{meta.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <button onClick={onApply}>
                    Apply mapping &amp; load data
                  </button>
                  {canonicalData.value.length > 0 && (
                    <span class="status ok">
                      {canonicalData.value.length} rows loaded
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
