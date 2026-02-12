/** Format a number as currency: $1,234 */
export function fmtMoney(v: number): string {
  if (isNaN(v) || !isFinite(v)) return "\u2014";
  return "$" + Math.round(v).toLocaleString();
}

/** Format a number as integer string */
export function fmtInt(v: number): string {
  return isFinite(v) ? String(Math.round(v)) : "\u2014";
}

/** Format a number with d decimal places */
export function fmtNum(v: number, d: number = 2): string {
  return isFinite(v) ? Number(v).toFixed(d) : "\u2014";
}
