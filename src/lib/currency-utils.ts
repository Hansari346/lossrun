import type { ParseResult } from "../types";

// ── Regex patterns ────────────────────────────────────────────────────

/** Parenthetical negative: "(1,234.56)" or "($1,234.56)" */
const PARENS_RE = /^\((.+)\)$/;

/** European format: dots for thousands, comma before 2 decimal digits — e.g. "1.234,56" */
const EUROPEAN_RE = /^[\d.]+,(\d{2})$/;

/** Leading currency prefix: $, $$, or USD (case-insensitive) */
const CURRENCY_PREFIX_RE = /^(?:\$\$?|USD\s*)/i;

// ── Helpers ───────────────────────────────────────────────────────────

function stringify(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input).trim();
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Parse currency values from carrier loss runs.
 *
 * Handles:
 * - Plain numbers (typeof number)
 * - $-prefixed and $$-prefixed strings
 * - Parenthetical negatives: "(1,234.56)"
 * - Leading-minus negatives: "-$1,234.56"
 * - European comma-decimal format: "1.234,56"
 * - US thousands-comma format: "1,234.56"
 * - Empty / placeholder inputs → error (never silent null)
 *
 * Returns ParseResult<number> — always includes raw input for traceability.
 */
export function parseCurrency(input: unknown): ParseResult<number> {
  const raw = stringify(input);

  // ── 1. Already a number ─────────────────────────────────────────────
  if (typeof input === "number") {
    if (Number.isFinite(input)) {
      return { value: input, error: null, raw };
    }
    return { value: null, error: `Non-finite number: "${raw}"`, raw };
  }

  // ── 2. Null / empty / placeholder guard ─────────────────────────────
  if (input === null || input === undefined || raw === "") {
    return { value: null, error: "Empty currency value", raw };
  }

  if (raw === "-" || raw === "$" || raw === "$$") {
    return { value: null, error: `Currency placeholder: "${raw}"`, raw };
  }

  let str = raw;
  let isNegative = false;

  // ── 3. Detect parenthetical negatives ───────────────────────────────
  const parensMatch = str.match(PARENS_RE);
  if (parensMatch) {
    isNegative = true;
    str = parensMatch[1].trim();
  }

  // ── 4. Detect leading minus ─────────────────────────────────────────
  if (str.startsWith("-")) {
    isNegative = true;
    str = str.slice(1).trim();
  }

  // ── 5. Strip currency symbols ───────────────────────────────────────
  str = str.replace(CURRENCY_PREFIX_RE, "").trim();

  // ── 6/7. Detect format and normalize ────────────────────────────────
  if (EUROPEAN_RE.test(str)) {
    // European: dots are thousands separators, comma is decimal
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    // US format: commas are thousands separators
    str = str.replace(/,/g, "");
  }

  // ── 8. Parse ────────────────────────────────────────────────────────
  const value = parseFloat(str);

  if (isNaN(value) || !isFinite(value)) {
    return { value: null, error: `Unparseable currency: "${raw}"`, raw };
  }

  // ── 9. Apply sign and return ────────────────────────────────────────
  return { value: isNegative ? -value : value, error: null, raw };
}
