import type {
  ParseResult,
  RowError,
  ValidationSummary,
  CanonicalRecord,
} from "../types";
import { parseDate } from "./date-utils";
import { parseCurrency } from "./currency-utils";

// ── Helpers ───────────────────────────────────────────────────────────

/** Safely convert a cell value to a trimmed string (empty on null/undefined). */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Look up a cell value from a row using column-index-based mappings.
 *
 * `mappings` maps field keys → column indices (numbers).
 * `headers` is the header row array.
 * The row object uses header strings as keys (from SheetJS `sheet_to_json`).
 *
 * Lookup: `row[headers[mappings[fieldKey]]]`
 */
function getCellValue(
  row: Record<string, any>,
  mappings: Record<string, number>,
  headers: string[],
  fieldKey: string,
): unknown {
  const colIndex = mappings[fieldKey];
  if (colIndex === undefined || colIndex === null) return undefined;
  const headerName = headers[colIndex];
  if (headerName === undefined) return undefined;
  return row[headerName];
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Create a fresh, zeroed ValidationSummary.
 */
export function createEmptyValidationSummary(): ValidationSummary {
  return {
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    errors: [],
    warnings: [],
    unparsableDates: 0,
    invalidAmounts: 0,
    missingRequired: 0,
  };
}

/**
 * Validate and parse a single spreadsheet row into a CanonicalRecord.
 *
 * Returns `{ record, errors }`:
 * - If any **required** field fails → `record` is `null`, `errors` explains why.
 * - If only **optional** fields fail → `record` is returned, errors are warnings.
 * - Never silently drops a row.
 *
 * @param row           - Row object from SheetJS (header strings as keys).
 * @param mappings      - Map of canonical field names → column indices.
 * @param headers       - Header row array (column index → header string).
 * @param rowIndex      - 0-based row index in the sheet (for error reporting).
 * @param compositeOverrides - Pre-extracted composite values (field → value).
 */
export function validateAndParseRow(
  row: Record<string, any>,
  mappings: Record<string, number>,
  headers: string[],
  rowIndex: number,
  compositeOverrides?: Record<string, string>,
): { record: CanonicalRecord | null; errors: RowError[] } {
  const errors: RowError[] = [];
  let hasRequiredError = false;

  // ── 1. Required fields ──────────────────────────────────────────────

  // site_name (string, required)
  const rawSiteName = getCellValue(row, mappings, headers, "site_name");
  const siteName = cellToString(rawSiteName);
  if (!siteName) {
    hasRequiredError = true;
    errors.push({
      rowIndex,
      field: "site_name",
      message: "Missing site name",
      rawValue: cellToString(rawSiteName),
    });
  }

  // date_of_loss (Date, required)
  const rawDateOfLoss = getCellValue(row, mappings, headers, "date_of_loss");
  let dateOfLoss: Date | null = null;
  if (rawDateOfLoss === undefined || rawDateOfLoss === null || cellToString(rawDateOfLoss) === "") {
    hasRequiredError = true;
    errors.push({
      rowIndex,
      field: "date_of_loss",
      message: "Missing date of loss",
      rawValue: cellToString(rawDateOfLoss),
    });
  } else {
    const dateResult: ParseResult<Date> = parseDate(rawDateOfLoss);
    if (dateResult.error || dateResult.value === null) {
      hasRequiredError = true;
      errors.push({
        rowIndex,
        field: "date_of_loss",
        message: dateResult.error ?? "Unparseable date of loss",
        rawValue: dateResult.raw,
      });
    } else {
      dateOfLoss = dateResult.value;
    }
  }

  // total_incurred (number, required)
  const rawTotalIncurred = getCellValue(row, mappings, headers, "total_incurred");
  let totalIncurred = 0;
  if (rawTotalIncurred === undefined || rawTotalIncurred === null || cellToString(rawTotalIncurred) === "") {
    hasRequiredError = true;
    errors.push({
      rowIndex,
      field: "total_incurred",
      message: "Missing total incurred amount",
      rawValue: cellToString(rawTotalIncurred),
    });
  } else {
    const currencyResult: ParseResult<number> = parseCurrency(rawTotalIncurred);
    if (currencyResult.error || currencyResult.value === null || !Number.isFinite(currencyResult.value)) {
      hasRequiredError = true;
      errors.push({
        rowIndex,
        field: "total_incurred",
        message: currencyResult.error ?? "Invalid total incurred amount",
        rawValue: currencyResult.raw,
      });
    } else {
      totalIncurred = currencyResult.value;
    }
  }

  // ── 2. Bail early on required-field failure ─────────────────────────

  if (hasRequiredError) {
    return { record: null, errors };
  }

  // ── 3. Optional string fields ───────────────────────────────────────

  const optionalStringFields = [
    "claim_number",
    "claim_category",
    "body_part",
    "cause_of_loss",
    "loss_description",
  ] as const;

  const optionalValues: Record<string, string | undefined> = {};
  for (const field of optionalStringFields) {
    const raw = getCellValue(row, mappings, headers, field);
    const value = cellToString(raw);
    optionalValues[field] = value || undefined;
  }

  // lost_days (number, optional — failure is a warning, doesn't skip row)
  let lostDays: number | undefined;
  if (mappings.lost_days !== undefined) {
    const rawLostDays = getCellValue(row, mappings, headers, "lost_days");
    const lostDaysStr = cellToString(rawLostDays);
    if (lostDaysStr) {
      const lostDaysResult: ParseResult<number> = parseCurrency(rawLostDays);
      if (lostDaysResult.error || lostDaysResult.value === null || !Number.isFinite(lostDaysResult.value)) {
        errors.push({
          rowIndex,
          field: "lost_days",
          message: lostDaysResult.error ?? "Invalid lost days value",
          rawValue: lostDaysResult.raw,
        });
      } else {
        lostDays = lostDaysResult.value;
      }
    }
  }

  // ── 4. Apply composite field overrides ──────────────────────────────
  // For each key in compositeOverrides, if the corresponding optional field
  // is empty or unset, use the override value.

  if (compositeOverrides) {
    for (const [field, value] of Object.entries(compositeOverrides)) {
      if (value && (!optionalValues[field] || optionalValues[field] === "")) {
        optionalValues[field] = value;
      }
    }
  }

  // ── 5. Build and return CanonicalRecord ─────────────────────────────

  const record: CanonicalRecord = {
    site_name: siteName,
    date_of_loss: dateOfLoss,
    total_incurred: totalIncurred,
    claim_number: optionalValues.claim_number,
    claim_category: optionalValues.claim_category,
    body_part: optionalValues.body_part,
    cause_of_loss: optionalValues.cause_of_loss,
    loss_description: optionalValues.loss_description,
    lost_days: lostDays,
  };

  return { record, errors };
}

/**
 * Accumulate row errors into a ValidationSummary (mutates the summary).
 *
 * Categorization:
 * - "date" in field name → unparsableDates
 * - "incurred" or "amount" in field name → invalidAmounts
 * - Required field with "Missing" message → missingRequired
 */
export function accumulateErrors(
  summary: ValidationSummary,
  errors: RowError[],
): void {
  for (const error of errors) {
    summary.errors.push(error);

    const fieldLower = error.field.toLowerCase();
    const messageLower = error.message.toLowerCase();

    if (fieldLower.includes("date")) {
      summary.unparsableDates++;
    } else if (fieldLower.includes("incurred") || fieldLower.includes("amount")) {
      summary.invalidAmounts++;
    }

    if (messageLower.includes("missing")) {
      summary.missingRequired++;
    }
  }
}
