import {
  workbook,
  currentSheetName,
  headerRow,
  mappings,
  canonicalData,
  availableSites,
  selectedSite,
  adjustments,
  statusMessage,
} from "../state/store";
import {
  findBestMatch,
  requiredFields,
  optionalFields,
} from "./field-mapping";
import type { CanonicalRecord, Mappings } from "../types";

// ── Internal state ──────────────────────────────────────────────────────────

/** Index of the detected header row within the sheet (0-based) */
let headerRowIndex = 0;

// ── File handling ───────────────────────────────────────────────────────────

/**
 * Read an uploaded Excel file and populate the workbook signal.
 * Auto-selects the first sheet and kicks off header detection.
 */
export function handleFileSelect(file: File): void {
  // Reset state
  workbook.value = null;
  currentSheetName.value = null;
  headerRow.value = [];
  canonicalData.value = [];
  mappings.value = {};

  if (!file) {
    statusMessage.value = "No file selected.";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    try {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });

      const sheetNames: string[] = wb.SheetNames || [];
      if (!sheetNames.length) {
        throw new Error("No sheets found in workbook.");
      }

      workbook.value = wb;
      currentSheetName.value = sheetNames[0];
      statusMessage.value = `Loaded workbook with ${sheetNames.length} sheet(s). Select a sheet and map fields.`;

      // Auto-run header detection on the first sheet
      handleSheetSelect(sheetNames[0]);
    } catch (err: any) {
      console.error(err);
      statusMessage.value = "Error reading file: " + err.message;
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Header detection ────────────────────────────────────────────────────────

interface HeaderResult {
  rowIndex: number;
  headerRow: string[];
}

/**
 * Scan the first N rows of a sheet to locate the header row.
 * Returns the best-scoring row index and the header values as strings.
 */
export function findHeaderRow(rows: any[][]): HeaderResult {
  if (!rows || rows.length === 0) return { rowIndex: -1, headerRow: [] };

  const maxScanRows = Math.min(20, rows.length);
  let bestRowIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < maxScanRows; i++) {
    const row = rows[i] || [];
    const nonEmptyCells = row.filter((cell: any) => {
      const str = String(cell || "").trim();
      return str.length > 0;
    }).length;

    let score = 0;

    if (nonEmptyCells >= 3) {
      score = nonEmptyCells;

      // Bonus for rows that look like headers (contain text, not just numbers)
      const textCells = row.filter((cell: any) => {
        const str = String(cell || "").trim();
        if (str.length === 0) return false;
        const isNumber =
          /^[\$,\d\s\.\-\(\)]+$/.test(str.replace(/[,\$\(\)\s]/g, "")) &&
          !isNaN(parseFloat(str.replace(/[,\$\(\)]/g, "")));
        const isDate = !isNaN(new Date(str).getTime()) && str.length > 5;
        return !isNumber && !isDate;
      }).length;

      if (textCells >= Math.ceil(nonEmptyCells / 2)) {
        score += 5;
      }

      if (nonEmptyCells > 50) {
        score -= 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = i;
    }
  }

  if (bestRowIndex >= 0 && bestScore >= 3) {
    const hr = (rows[bestRowIndex] || []).map((v: any) =>
      String(v || "").trim(),
    );
    return { rowIndex: bestRowIndex, headerRow: hr };
  }

  // Fallback: use first row
  const hr = (rows[0] || []).map((v: any) => String(v || "").trim());
  return { rowIndex: 0, headerRow: hr };
}

// ── Sheet selection ─────────────────────────────────────────────────────────

/**
 * Called when the user selects a different sheet.
 * Re-runs header detection and extracts sample data for auto-mapping.
 * Returns per-column sample data so the UI can feed it to findBestMatch.
 */
export function handleSheetSelect(
  sheetName: string,
): { sampleData: any[][] } | null {
  const wb = workbook.value;
  if (!wb) return null;

  currentSheetName.value = sheetName;

  const ws = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
  });

  if (!rows.length) {
    statusMessage.value = "Sheet appears to be empty.";
    headerRow.value = [];
    return null;
  }

  const result = findHeaderRow(rows);
  headerRowIndex = result.rowIndex;
  headerRow.value = result.headerRow;

  if (!result.headerRow.length || result.rowIndex < 0) {
    statusMessage.value = "Could not detect header row.";
    return null;
  }

  if (result.rowIndex > 0) {
    statusMessage.value += ` Header row detected at row ${result.rowIndex + 1} (skipped ${result.rowIndex} blank row(s) at top).`;
  }

  // Extract sample data for each column (first 10 data rows after the header)
  const sampleData: any[][] = [];
  const numColumns = result.headerRow.length;
  for (let colIdx = 0; colIdx < numColumns; colIdx++) {
    sampleData[colIdx] = [];
    const startRow = result.rowIndex + 1;
    for (
      let rowIdx = startRow;
      rowIdx < Math.min(rows.length, startRow + 10);
      rowIdx++
    ) {
      const cellValue =
        rows[rowIdx] && rows[rowIdx][colIdx] !== undefined
          ? rows[rowIdx][colIdx]
          : null;
      sampleData[colIdx].push(cellValue);
    }
  }

  return { sampleData };
}

// ── Data loading ────────────────────────────────────────────────────────────

/**
 * Apply column mappings, parse sheet rows into canonical records,
 * and load them into the signal store.
 *
 * `mappingOverrides` maps canonical field key → column index.
 */
export function applyMappingAndLoad(
  mappingOverrides: Record<string, number>,
): boolean {
  const wb = workbook.value;
  const sheet = currentSheetName.value;
  const headers = headerRow.value;

  if (!wb || !sheet || !headers.length) {
    statusMessage.value = "No sheet/header information available.";
    return false;
  }

  // Build header-name-based mappings from index overrides
  const newMappings: Mappings = {};
  for (const [key, idx] of Object.entries(mappingOverrides)) {
    if (idx >= 0 && idx < headers.length) {
      newMappings[key] = headers[idx];
    }
  }

  // Validate required fields
  const missingRequired = Object.keys(requiredFields).filter(
    (key) => !newMappings[key],
  );
  if (missingRequired.length) {
    statusMessage.value =
      "Missing required mappings for: " +
      missingRequired.map((k) => requiredFields[k].label).join(", ");
    canonicalData.value = [];
    return false;
  }

  mappings.value = newMappings;
  statusMessage.value = "Mappings applied. Parsing rows\u2026";

  // Parse sheet into JSON using the detected header row
  const ws = wb.Sheets[sheet];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    header: headers,
    range: headerRowIndex + 1,
    raw: false,
    defval: null,
  });

  const out: CanonicalRecord[] = [];
  rawRows.forEach((row: Record<string, any>) => {
    // Required fields
    const siteName = (row[newMappings.site_name] || "").toString().trim();
    const rawDate = row[newMappings.date_of_loss];
    let parsedDate: Date | null = null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) parsedDate = d;
    }
    let incurred = row[newMappings.total_incurred];
    let incurredNum = parseFloat(
      (typeof incurred === "string"
        ? incurred.replace(/[$,]/g, "")
        : incurred) || 0,
    );
    if (!isFinite(incurredNum)) incurredNum = 0;

    if (!siteName || !parsedDate || !isFinite(incurredNum) || incurredNum <= 0) {
      return;
    }

    const canon: CanonicalRecord = {
      site_name: siteName,
      date_of_loss: parsedDate,
      total_incurred: incurredNum,
    };

    // Optional fields
    if (newMappings.claim_number) {
      canon.claim_number = (row[newMappings.claim_number] || "")
        .toString()
        .trim();
    }
    if (newMappings.claim_category) {
      canon.claim_category = (row[newMappings.claim_category] || "")
        .toString()
        .trim();
    }
    if (newMappings.body_part) {
      canon.body_part = (row[newMappings.body_part] || "").toString().trim();
    }
    if (newMappings.lost_days) {
      const ld = row[newMappings.lost_days];
      const ldNum = parseFloat(
        (typeof ld === "string" ? ld.replace(/,/g, "") : ld) || 0,
      );
      canon.lost_days = isFinite(ldNum) && ldNum > 0 ? ldNum : 0;
    }
    if (newMappings.cause_of_loss) {
      canon.cause_of_loss = (row[newMappings.cause_of_loss] || "")
        .toString()
        .trim();
    }
    if (newMappings.loss_description) {
      canon.loss_description = (row[newMappings.loss_description] || "")
        .toString()
        .trim();
    }

    out.push(canon);
  });

  canonicalData.value = out;

  if (!out.length) {
    statusMessage.value =
      "No valid rows after parsing. Check that date and incurred values are valid.";
    return false;
  }

  statusMessage.value = `Parsed ${out.length} valid row(s). Proceed to adjustments.`;

  // Populate site filter and auto-fill adjustments
  populateSiteFilter(out);
  populateAdjustmentsFromData(out);

  return true;
}

// ── Site filtering ──────────────────────────────────────────────────────────

/** Extract unique site names from canonical data and write to the store. */
export function populateSiteFilter(data: CanonicalRecord[]): void {
  if (!data.length) return;

  const siteSet = new Set<string>();
  data.forEach((row) => {
    if (row.site_name) siteSet.add(row.site_name);
  });

  availableSites.value = Array.from(siteSet).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

/** Return canonical data filtered by the currently selected site. */
export function getFilteredData(): CanonicalRecord[] {
  const site = selectedSite.value;
  if (!site || site === "all") return canonicalData.value;
  return canonicalData.value.filter((row) => row.site_name === site);
}

// ── Adjustment auto-population ──────────────────────────────────────────────

/**
 * Auto-populate adjustment parameters based on ingested data.
 * Uses the most recent 2-3 years of data to compute annual baselines.
 *
 * Sets: avgCost (average direct cost per injury) and injuries (annual count).
 */
export function populateAdjustmentsFromData(data: CanonicalRecord[]): void {
  if (!data.length) return;

  // Calculate annual metrics
  const yearlyData: Record<
    number,
    { totalIncurred: number; claimCount: number }
  > = {};
  data.forEach((row) => {
    if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
    const year = row.date_of_loss.getFullYear();
    if (!yearlyData[year]) {
      yearlyData[year] = { totalIncurred: 0, claimCount: 0 };
    }
    yearlyData[year].totalIncurred += row.total_incurred || 0;
    yearlyData[year].claimCount += 1;
  });

  const years = Object.keys(yearlyData)
    .map((y) => parseInt(y, 10))
    .sort((a, b) => b - a);

  if (years.length === 0) {
    // Fallback to aggregate if no valid dates
    const totalIncurred = data.reduce(
      (acc, r) => acc + (r.total_incurred || 0),
      0,
    );
    const claimCount = data.length;
    const avgCost = totalIncurred / Math.max(claimCount, 1);

    adjustments.value = {
      ...adjustments.value,
      avgCost: Math.round(avgCost),
      injuries: claimCount,
    };
    return;
  }

  let avgCostPerYear = 0;
  let avgInjuriesPerYear = 0;

  if (years.length >= 3) {
    const recentYears = years.slice(0, 3);
    let totalCost = 0;
    let totalClaims = 0;
    recentYears.forEach((y) => {
      totalCost += yearlyData[y].totalIncurred;
      totalClaims += yearlyData[y].claimCount;
    });
    avgCostPerYear = totalCost / Math.max(totalClaims, 1);
    avgInjuriesPerYear = totalClaims / recentYears.length;
  } else if (years.length >= 2) {
    const recentYears = years.slice(0, 2);
    let totalCost = 0;
    let totalClaims = 0;
    recentYears.forEach((y) => {
      totalCost += yearlyData[y].totalIncurred;
      totalClaims += yearlyData[y].claimCount;
    });
    avgCostPerYear = totalCost / Math.max(totalClaims, 1);
    avgInjuriesPerYear = totalClaims / recentYears.length;
  } else {
    const yearData = yearlyData[years[0]];
    avgCostPerYear =
      yearData.totalIncurred / Math.max(yearData.claimCount, 1);
    avgInjuriesPerYear = yearData.claimCount;
  }

  adjustments.value = {
    ...adjustments.value,
    avgCost: Math.round(avgCostPerYear),
    injuries: Math.round(avgInjuriesPerYear),
  };
}
