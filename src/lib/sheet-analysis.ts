import type { SheetScore } from "../types";

// ── Constants ────────────────────────────────────────────────────────────────

/** Sheet names containing these keywords score higher (claims-like data) */
const CLAIMS_KEYWORDS = [
  "claim",
  "loss",
  "detail",
  "data",
  "run",
  "listing",
  "report",
];

/** Sheet names containing these keywords score lower (summary/meta sheets) */
const SUMMARY_KEYWORDS = [
  "summary",
  "cover",
  "total",
  "index",
  "toc",
  "instruction",
  "contents",
  "pivot",
  "chart",
  "graph",
  "about",
  "notes",
];

/** Header cell keywords that indicate claims-related data */
const HEADER_KEYWORDS = [
  "claim",
  "date",
  "loss",
  "incurred",
  "paid",
  "reserve",
  "location",
  "site",
  "body part",
  "injury",
  "description",
  "accident",
];

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Score and rank all sheets in a workbook by claims-data likelihood.
 * Returns sorted array with highest-scoring sheet first.
 *
 * Pure function — no signal store access. Uses global XLSX.
 */
export function rankSheets(wb: any): SheetScore[] {
  const results: SheetScore[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const reasons: string[] = [];
    let score = 0;

    // ── Skip non-worksheets ────────────────────────────────────────────
    if (ws["!type"] && ws["!type"] !== "sheet") {
      results.push({
        sheetName,
        score: -100,
        reasons: [`Non-worksheet type: ${ws["!type"]}`],
      });
      continue;
    }

    if (!ws["!ref"]) {
      results.push({
        sheetName,
        score: -100,
        reasons: ["Empty sheet (no !ref)"],
      });
      continue;
    }

    // ── Dimension scoring ──────────────────────────────────────────────
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;

    if (rowCount > 10) {
      score += 20;
      reasons.push(`${rowCount} rows`);
    }
    if (rowCount > 50) {
      score += 15;
    }
    if (rowCount > 500) {
      score += 10;
    }

    if (colCount >= 5 && colCount <= 50) {
      score += 15;
      reasons.push(`${colCount} columns`);
    }
    if (colCount < 3) {
      score -= 20;
      reasons.push("Too few columns");
    }

    // ── Sheet name scoring (case-insensitive) ──────────────────────────
    const nameLower = sheetName.toLowerCase();

    if (CLAIMS_KEYWORDS.some((kw) => nameLower.includes(kw))) {
      score += 25;
      reasons.push(`Sheet name matches claims keyword`);
    }

    if (SUMMARY_KEYWORDS.some((kw) => nameLower.includes(kw))) {
      score -= 20;
      reasons.push(`Sheet name matches summary keyword`);
    }

    // ── Header pattern matching ────────────────────────────────────────
    // Read first 5 rows via sheet_to_json in array-of-arrays mode
    const rows: unknown[] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      range: 0,
      raw: false,
    });

    let hits = 0;
    const scannedRows = rows.slice(0, 5);

    for (const row of scannedRows) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        if (cell == null) continue;
        const cellStr = String(cell).toLowerCase();
        for (const kw of HEADER_KEYWORDS) {
          if (cellStr.includes(kw)) {
            hits++;
            break; // Only count one keyword match per cell
          }
        }
      }
    }

    if (hits >= 3) {
      score += 30;
      reasons.push(`${hits} header keyword matches`);
    }

    results.push({ sheetName, score, reasons });
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results;
}
