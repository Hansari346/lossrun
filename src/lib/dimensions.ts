/**
 * Dimension detection — pure functions, no signals, no DOM.
 *
 * Inspects canonical data to determine which optional analysis dimensions
 * have meaningful data. Used by the calculation engine to skip breakdowns
 * for unavailable dimensions, and to carry dimension metadata in results.
 */

import type {
  CanonicalRecord,
  DimensionKey,
  DimensionInfo,
  DimensionAvailability,
} from "../types";

// Re-export dimension types for convenience
export type { DimensionKey, DimensionInfo, DimensionAvailability };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All 6 optional analysis dimension keys */
export const DIMENSION_KEYS = [
  "cause_of_loss",
  "body_part",
  "claim_category",
  "lost_days",
  "site_comparison",
  "loss_description",
] as const satisfies readonly DimensionKey[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a single row has meaningful data for a given dimension.
 * Pure function — no side effects.
 */
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

/**
 * Extract the string value used for distinct-value counting.
 * Returns null if the row isn't populated for this dimension.
 */
function extractValue(key: DimensionKey, row: CanonicalRecord): string | null {
  switch (key) {
    case "cause_of_loss":
      return row.cause_of_loss?.trim().toLowerCase() || null;
    case "body_part":
      return row.body_part?.trim().toLowerCase() || null;
    case "claim_category":
      return row.claim_category?.trim().toLowerCase() || null;
    case "lost_days":
      return row.lost_days !== undefined && row.lost_days > 0
        ? String(row.lost_days)
        : null;
    case "loss_description":
      return row.loss_description?.trim().toLowerCase() || null;
    case "site_comparison":
      return row.site_name?.trim().toLowerCase() || null;
  }
}

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

/**
 * Detect which analysis dimensions have sufficient data.
 *
 * For each of the 6 dimensions:
 * - Counts how many records have meaningful data
 * - Counts distinct values (cardinality)
 * - Threshold: available when populated >= max(3, ceil(total * 0.05))
 * - Exception: site_comparison also requires distinctValues > 1
 *
 * @param data - Array of canonical records to inspect
 * @returns DimensionAvailability with info for all 6 dimensions
 */
export function detectDimensions(
  data: CanonicalRecord[],
): DimensionAvailability {
  const total = data.length;

  // Handle empty data — all dimensions unavailable
  if (total === 0) {
    const empty = {} as DimensionAvailability;
    for (const key of DIMENSION_KEYS) {
      empty[key] = {
        available: false,
        recordCount: 0,
        totalRecords: 0,
        coverage: 0,
        distinctValues: 0,
      };
    }
    return empty;
  }

  const threshold = Math.max(3, Math.ceil(total * 0.05));
  const result = {} as DimensionAvailability;

  for (const key of DIMENSION_KEYS) {
    let recordCount = 0;
    const distinctSet = new Set<string>();

    for (const row of data) {
      if (isPopulated(key, row)) {
        recordCount++;
        const val = extractValue(key, row);
        if (val !== null) {
          distinctSet.add(val);
        }
      }
    }

    const distinctValues = distinctSet.size;
    const meetsThreshold = recordCount >= threshold;

    // site_comparison needs more than 1 unique site to be meaningful
    const available =
      key === "site_comparison"
        ? meetsThreshold && distinctValues > 1
        : meetsThreshold;

    result[key] = {
      available,
      recordCount,
      totalRecords: total,
      coverage: recordCount / total,
      distinctValues,
    };
  }

  return result;
}
