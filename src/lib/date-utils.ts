import type { ParseResult } from "../types";

// ── Month name lookup ─────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

// ── Regex patterns ────────────────────────────────────────────────────

/** ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss */
const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T\d{2}:\d{2}:\d{2})?$/;

/** US format: MM/DD/YYYY or MM-DD-YYYY (supports 2- or 4-digit year) */
const US_RE = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/;

/** Text month first: "Jan 15, 2024" or "January 15 2024" */
const TEXT_MONTH_FIRST_RE = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/;

/** Day-month-year: "15-Jan-2024" or "15 January 2024" */
const DAY_MONTH_YEAR_RE = /^(\d{1,2})[/\s-]([A-Za-z]+)[/\s-](\d{4})$/;

/** Numeric string that looks like an Excel serial (e.g. "45000") */
const SERIAL_STRING_RE = /^\d{1,6}$/;

// ── Helpers ───────────────────────────────────────────────────────────

function stringify(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input).trim();
}

function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}

/** Resolve 2-digit year: 00–49 → 2000–2049, 50–99 → 1950–1999 */
function resolve2DigitYear(y: number): number {
  if (y < 100) {
    return y < 50 ? 2000 + y : 1900 + y;
  }
  return y;
}

/** Validate year is within reasonable range for loss-run data */
function isReasonableYear(y: number): boolean {
  return y >= 1990 && y <= 2100;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Convert Excel 1900-date-system serial number to a JS Date.
 *
 * Serial 1 = Jan 1, 1900. Adjusts for the Lotus 1-2-3 leap-year bug
 * where serial 60 is the non-existent Feb 29, 1900.
 */
export function excelSerialToDate(serial: number): ParseResult<Date> {
  const raw = String(serial);

  if (!Number.isFinite(serial) || serial < 1 || serial > 200000) {
    return { value: null, error: `Excel serial out of range: "${raw}"`, raw };
  }

  // Lotus 1-2-3 bug: serial 60 = fake Feb 29, 1900 — serials > 60 are off by 1
  const adjusted = serial > 60 ? serial - 1 : serial;
  const utcDays = Math.floor(adjusted - 1);
  const epoch = new Date(1900, 0, 1).getTime();
  const date = new Date(epoch + utcDays * 86_400_000);

  if (!isValidDate(date)) {
    return { value: null, error: `Invalid date from serial: "${raw}"`, raw };
  }

  return { value: date, error: null, raw };
}

/**
 * Parse any date format commonly found in workers' comp loss runs.
 *
 * Priority:
 * 1. Already a Date object (SheetJS cellDates: true)
 * 2. SheetJS serial number (number 1–200 000)
 * 3. Numeric string that looks like a serial
 * 4. ISO 8601 (YYYY-MM-DD)
 * 5. US format (MM/DD/YYYY, supports 2-digit year)
 * 6. Text-month formats ("Jan 15, 2024", "15-Jan-2024")
 * 7. Everything else → error
 *
 * CRITICAL: Never uses `new Date(string)` for numeric date formats.
 */
export function parseDate(input: unknown): ParseResult<Date> {
  const raw = stringify(input);

  // ── Null / empty guard ──────────────────────────────────────────────
  if (input === null || input === undefined || raw === "") {
    return { value: null, error: `Empty date value`, raw };
  }

  // ── 1. Already a Date ──────────────────────────────────────────────
  if (input instanceof Date) {
    if (isValidDate(input)) {
      return { value: input, error: null, raw };
    }
    return { value: null, error: `Invalid Date object`, raw };
  }

  // ── 2. Numeric (SheetJS serial) ────────────────────────────────────
  if (typeof input === "number") {
    if (input >= 1 && input <= 200_000) {
      return excelSerialToDate(input);
    }
    return { value: null, error: `Number out of serial range: "${raw}"`, raw };
  }

  // Beyond this point, input should be a string
  const str = raw;

  if (str === "-" || str === "N/A" || str.toLowerCase() === "n/a") {
    return { value: null, error: `Non-date placeholder: "${raw}"`, raw };
  }

  // ── 3. Numeric string (serial) ─────────────────────────────────────
  if (SERIAL_STRING_RE.test(str)) {
    const num = Number(str);
    if (num >= 1 && num <= 200_000) {
      return excelSerialToDate(num);
    }
    // Fall through — might be a short number that isn't a valid serial
  }

  // ── 4. ISO 8601 ────────────────────────────────────────────────────
  const isoMatch = str.match(ISO_RE);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && isReasonableYear(y)) {
      const date = new Date(y, m - 1, d);
      if (isValidDate(date)) {
        return { value: date, error: null, raw };
      }
    }
    return { value: null, error: `Invalid ISO date: "${raw}"`, raw };
  }

  // ── 5. US format (MM/DD/YYYY or MM-DD-YYYY) ────────────────────────
  const usMatch = str.match(US_RE);
  if (usMatch) {
    const m = Number(usMatch[1]);
    const d = Number(usMatch[2]);
    const y = resolve2DigitYear(Number(usMatch[3]));
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && isReasonableYear(y)) {
      const date = new Date(y, m - 1, d);
      if (isValidDate(date)) {
        return { value: date, error: null, raw };
      }
    }
    return { value: null, error: `Invalid US date: "${raw}"`, raw };
  }

  // ── 6a. Text month first: "Jan 15, 2024" ───────────────────────────
  const textFirstMatch = str.match(TEXT_MONTH_FIRST_RE);
  if (textFirstMatch) {
    const monthIdx = MONTH_MAP[textFirstMatch[1].toLowerCase()];
    if (monthIdx !== undefined) {
      const d = Number(textFirstMatch[2]);
      const y = Number(textFirstMatch[3]);
      if (d >= 1 && d <= 31 && isReasonableYear(y)) {
        const date = new Date(y, monthIdx, d);
        if (isValidDate(date)) {
          return { value: date, error: null, raw };
        }
      }
    }
    return { value: null, error: `Invalid text-month date: "${raw}"`, raw };
  }

  // ── 6b. Day-month-year: "15-Jan-2024" ──────────────────────────────
  const dayMonthMatch = str.match(DAY_MONTH_YEAR_RE);
  if (dayMonthMatch) {
    const monthIdx = MONTH_MAP[dayMonthMatch[2].toLowerCase()];
    if (monthIdx !== undefined) {
      const d = Number(dayMonthMatch[1]);
      const y = Number(dayMonthMatch[3]);
      if (d >= 1 && d <= 31 && isReasonableYear(y)) {
        const date = new Date(y, monthIdx, d);
        if (isValidDate(date)) {
          return { value: date, error: null, raw };
        }
      }
    }
    return { value: null, error: `Invalid text-month date: "${raw}"`, raw };
  }

  // ── 7. Nothing matched ─────────────────────────────────────────────
  return { value: null, error: `Unparseable date: "${raw}"`, raw };
}
