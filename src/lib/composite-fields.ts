import type { CompositeField } from "../types";

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Matches "Key: Value" where the key starts with a letter, is 3–31 chars total,
 * followed by `: ` (colon + optional space) and a non-empty value.
 */
const COMPOSITE_PATTERN = /^([A-Za-z][A-Za-z\s]{2,30}):\s*(.+)$/;

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * Detect columns that contain consistent "Key: Value" composite patterns.
 *
 * For each column index, scans sample data for Key:Value patterns.
 * A column is composite if at least one key appears in `minKeyFrequency`
 * or more rows (default 3).
 *
 * Pure function — no state access.
 *
 * @param columnIndices  Array of column indices to check
 * @param headers        Header names for each column
 * @param sampleData     Array of sample value arrays, indexed by column
 * @param minKeyFrequency Minimum occurrences for a key to be significant (default 3)
 * @returns CompositeField[] for columns that have composite patterns
 */
export function detectCompositeFields(
  columnIndices: number[],
  headers: string[],
  sampleData: any[][],
  minKeyFrequency: number = 3,
): CompositeField[] {
  const results: CompositeField[] = [];

  for (const colIdx of columnIndices) {
    const values = sampleData[colIdx];
    if (!values || !Array.isArray(values)) continue;

    const keyFrequency = new Map<string, number>();

    for (const val of values) {
      if (val == null || val === "") continue;
      const str = String(val).trim();
      const match = COMPOSITE_PATTERN.exec(str);
      if (!match) continue;

      const key = match[1].trim();

      // Filter out false positives
      if (key.length < 3) continue;
      if (/^\d+$/.test(key)) continue;

      keyFrequency.set(key, (keyFrequency.get(key) ?? 0) + 1);
    }

    // Find keys that meet the frequency threshold
    const extractedKeys: string[] = [];
    for (const [key, count] of keyFrequency.entries()) {
      if (count >= minKeyFrequency) {
        extractedKeys.push(key);
      }
    }

    // Column is composite only if at least one key met the threshold
    if (extractedKeys.length === 0) continue;

    // Sort keys alphabetically for deterministic output
    extractedKeys.sort((a, b) => a.localeCompare(b));

    results.push({
      columnIndex: colIdx,
      headerName: headers[colIdx] ?? `Column ${colIdx}`,
      extractedKeys,
      keyFrequency,
    });
  }

  return results;
}

/**
 * Extract the value portion from a composite "Key: Value" cell.
 *
 * Given a cell value like "Nature of Injury: Strain" and targetKey
 * "Nature of Injury", returns "Strain". Returns null if the cell
 * doesn't match the target key pattern.
 *
 * @param cellValue  The raw cell string
 * @param targetKey  The key to match against
 * @returns The extracted value, or null if no match
 */
export function extractCompositeValue(
  cellValue: string,
  targetKey: string,
): string | null {
  if (!cellValue || !targetKey) return null;

  const str = String(cellValue).trim();
  const match = COMPOSITE_PATTERN.exec(str);
  if (!match) return null;

  const key = match[1].trim();
  if (key.toLowerCase() !== targetKey.toLowerCase()) return null;

  return match[2].trim();
}
