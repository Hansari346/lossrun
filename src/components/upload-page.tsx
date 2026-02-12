import { useSignal } from "@preact/signals";
import {
  workbook,
  currentPage,
  headerRow,
  sheetNames,
  statusMessage,
  canonicalData,
  currentSheetName,
  validationSummary,
  sheetScores,
  compositeFields,
  hasValidationErrors,
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
import { detectAllUnmappedFields } from "../lib/content-detection";
import type { ContentMatch } from "../lib/content-detection";
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
  // Content-based fallback matches for unmapped fields
  const contentMatches = useSignal<Record<string, ContentMatch>>({});

  // ── Handlers ────────────────────────────────────────────────────────────

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      overrides.value = {};
      sampleData.value = null;
      contentMatches.value = {};
      handleFileSelect(file);
    }
  }

  function onSheetChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    overrides.value = {};
    contentMatches.value = {};
    const result = handleSheetSelect(select.value);
    sampleData.value = result?.sampleData ?? null;
    // compositeFields are written to store signal by handleSheetSelect directly
  }

  /**
   * Run content-based detection for fields that weren't matched by headers.
   * Called after header-based matching is computed (in render or on demand).
   */
  function computeContentFallbacks(
    headers: string[],
    sd: any[][] | null,
  ): Record<string, ContentMatch> {
    if (!sd || headers.length === 0) return {};

    // First, find which fields ARE matched by headers
    const headerMapped: Record<string, number> = {};
    const mappedIndices = new Set<number>();
    fieldKeys.forEach((key) => {
      const fieldDef = allFields[key];
      if (overrides.value[key] !== undefined && overrides.value[key] >= 0) {
        headerMapped[key] = overrides.value[key];
        mappedIndices.add(overrides.value[key]);
      } else {
        const match = findBestMatch(headers, sd, fieldDef);
        if (match) {
          headerMapped[key] = match.index;
          mappedIndices.add(match.index);
        }
      }
    });

    // Find unmapped fields
    const unmappedFields = fieldKeys.filter(
      (key) => headerMapped[key] === undefined,
    );
    if (unmappedFields.length === 0) return {};

    // Run content-based detection
    return detectAllUnmappedFields(unmappedFields, sd, headers, mappedIndices);
  }

  function onApply() {
    // Build final mapping: start with auto-detected, then overlay manual overrides
    const finalMapping: Record<string, number> = {};
    const headers = headerRow.value;
    const sd = sampleData.value;
    const cMatches = contentMatches.value;

    fieldKeys.forEach((key) => {
      const fieldDef = allFields[key];
      // Check for manual override first
      if (overrides.value[key] !== undefined && overrides.value[key] >= 0) {
        finalMapping[key] = overrides.value[key];
      } else {
        // Use header-based auto-detected match
        const match = findBestMatch(headers, sd, fieldDef);
        if (match) {
          finalMapping[key] = match.index;
        } else if (cMatches[key]) {
          // Fallback to content-based detection
          finalMapping[key] = cMatches[key].index;
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

  // Compute content-based fallbacks when sample data changes
  // (memoized by signal — only recalculates when sd or headers change)
  if (hasHeaders && sd && Object.keys(contentMatches.value).length === 0) {
    const detected = computeContentFallbacks(headers, sd);
    if (Object.keys(detected).length > 0) {
      contentMatches.value = detected;
    }
  }
  const cMatches = contentMatches.value;

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
                  sheets.map((name) => {
                    const scoreObj = sheetScores.value.find(
                      (s) => s.sheetName === name,
                    );
                    const scoreLabel = scoreObj
                      ? ` (score: ${scoreObj.score})`
                      : "";
                    return (
                      <option key={name} value={name}>
                        {name}
                        {scoreLabel}
                      </option>
                    );
                  })
                )}
              </select>
              {sheetScores.value.length > 1 && (
                <p
                  class="small"
                  style={{ marginTop: "4px", color: "#666" }}
                >
                  Auto-selected best match.{" "}
                  {sheetScores.value[0] && (
                    <span
                      title={sheetScores.value[0].reasons.join(", ")}
                    >
                      Score: {sheetScores.value[0].score}
                    </span>
                  )}
                </p>
              )}
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
                {compositeFields.value.length > 0 && (
                  <div
                    class="status"
                    style={{
                      marginBottom: "8px",
                      background: "#f0f7ff",
                      border: "1px solid #cce0ff",
                    }}
                  >
                    <strong>Composite fields detected:</strong>{" "}
                    {compositeFields.value.map((cf, i) => (
                      <span key={cf.columnIndex}>
                        {i > 0 && "; "}
                        {cf.headerName} &rarr;{" "}
                        {cf.extractedKeys.join(", ")}
                      </span>
                    ))}
                  </div>
                )}
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
                      const contentMatch = cMatches[key] || null;
                      const isContentFallback =
                        !autoMatch &&
                        contentMatch !== null &&
                        overrides.value[key] === undefined;
                      const currentIdx =
                        overrides.value[key] !== undefined
                          ? overrides.value[key]
                          : autoMatch
                            ? autoMatch.index
                            : contentMatch
                              ? contentMatch.index
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
                              style={
                                isContentFallback
                                  ? {
                                      borderColor: "#e69500",
                                      backgroundColor: "#fffbf0",
                                    }
                                  : {}
                              }
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
                            {isContentFallback && (
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "0.75rem",
                                  color: "#b37400",
                                  marginTop: "2px",
                                }}
                                title={contentMatch.reason}
                              >
                                detected by content
                              </span>
                            )}
                          </td>
                          <td>
                            {isContentFallback ? (
                              <span
                                style={{ color: "#b37400", fontSize: "0.85em" }}
                              >
                                {contentMatch.reason}
                              </span>
                            ) : (
                              meta.description
                            )}
                          </td>
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
                  {validationSummary.value ? (
                    <div
                      class="status"
                      style={
                        validationSummary.value.skippedRows > 0
                          ? {
                              background: "#fff8e1",
                              border: "1px solid #ffcc02",
                            }
                          : {}
                      }
                    >
                      <strong>{validationSummary.value.validRows}</strong>{" "}
                      valid rows of {validationSummary.value.totalRows}{" "}
                      total.
                      {validationSummary.value.skippedRows > 0 && (
                        <span>
                          {" "}
                          <strong>
                            {validationSummary.value.skippedRows}
                          </strong>{" "}
                          skipped
                          {validationSummary.value.unparsableDates >
                            0 && (
                            <span>
                              {" "}
                              ({validationSummary.value.unparsableDates}{" "}
                              unparsable dates)
                            </span>
                          )}
                          {validationSummary.value.invalidAmounts >
                            0 && (
                            <span>
                              {" "}
                              ({validationSummary.value.invalidAmounts}{" "}
                              invalid amounts)
                            </span>
                          )}
                          {validationSummary.value.missingRequired >
                            0 && (
                            <span>
                              {" "}
                              ({validationSummary.value.missingRequired}{" "}
                              missing required fields)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ) : (
                    canonicalData.value.length > 0 && (
                      <span class="status ok">
                        {canonicalData.value.length} rows loaded
                      </span>
                    )
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
