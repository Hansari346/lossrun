import { parseDate } from "./date-utils";
import { parseCurrency } from "./currency-utils";

// ── Types ────────────────────────────────────────────────────────────────

export interface ContentMatch {
  /** Column index in the header array */
  index: number;
  /** Confidence score (25–45 range, always below header-match threshold of 50) */
  score: number;
  /** Human-readable explanation of why this column matched */
  reason: string;
}

// ── Domain keyword sets ──────────────────────────────────────────────────

/** Common body-part values seen in workers' comp data */
const BODY_PART_KEYWORDS = new Set([
  "back", "knee", "shoulder", "hand", "finger", "arm", "leg", "foot",
  "head", "neck", "wrist", "ankle", "eye", "hip", "elbow", "chest",
  "abdomen", "thumb", "toe", "spine", "lower back", "upper back",
  "multiple", "left", "right", "lower extremity", "upper extremity",
  "torso", "rib", "groin", "pelvis", "jaw", "face", "nose", "ear",
  "skull", "calf", "shin", "forearm", "bicep", "thigh",
]);

/** Common cause-of-loss / nature-of-injury values */
const CAUSE_KEYWORDS = new Set([
  "strain", "sprain", "slip", "trip", "fall", "struck", "caught",
  "cut", "burn", "overexertion", "repetitive", "motor vehicle",
  "lifting", "laceration", "contusion", "fracture", "puncture",
  "crushing", "abrasion", "inflammation", "dislocation", "hernia",
  "carpal tunnel", "foreign body", "chemical", "exposure", "bite",
  "twist", "push", "pull", "jump", "collision",
]);

/** Claim category keywords (MO vs Indemnity) */
const CATEGORY_KEYWORDS = new Set([
  "medical only", "med only", "mo", "indemnity", "lost time",
  "temporary total", "temporary partial", "permanent partial",
  "permanent total", "fatality", "report only", "record only",
  "open", "closed", "litigated", "denied", "incident only",
  "first aid", "osha recordable",
]);

// ── Content analysis helpers ─────────────────────────────────────────────

/** Count how many sample values successfully parse as dates */
function countDates(samples: any[]): { count: number; total: number } {
  const nonEmpty = samples.filter((v) => v != null && String(v).trim() !== "");
  let count = 0;
  for (const val of nonEmpty) {
    const result = parseDate(val);
    if (result.value !== null) count++;
  }
  return { count, total: nonEmpty.length };
}

/** Count how many sample values successfully parse as currency/numbers */
function countCurrency(samples: any[]): {
  count: number;
  total: number;
  median: number;
  values: number[];
} {
  const nonEmpty = samples.filter((v) => v != null && String(v).trim() !== "");
  const values: number[] = [];
  for (const val of nonEmpty) {
    const result = parseCurrency(val);
    if (result.value !== null) values.push(result.value);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  return { count: values.length, total: nonEmpty.length, median, values };
}

/** Count distinct non-empty string values and compute cardinality ratio */
function analyzeCardinality(samples: any[]): {
  distinct: number;
  total: number;
  ratio: number;
  avgLength: number;
  values: string[];
} {
  const strings: string[] = [];
  for (const val of samples) {
    if (val == null) continue;
    const s = String(val).trim();
    if (s.length > 0) strings.push(s);
  }
  const distinct = new Set(strings.length > 0 ? strings.map((s) => s.toLowerCase()) : []).size;
  const avgLength =
    strings.length > 0
      ? strings.reduce((sum, s) => sum + s.length, 0) / strings.length
      : 0;
  return {
    distinct,
    total: strings.length,
    ratio: strings.length > 0 ? distinct / strings.length : 0,
    avgLength,
    values: strings,
  };
}

/** Check what fraction of values contain any keyword from a set */
function keywordMatchRate(
  values: string[],
  keywords: Set<string>,
): number {
  if (values.length === 0) return 0;
  let matches = 0;
  for (const val of values) {
    const lower = val.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matches++;
        break;
      }
    }
  }
  return matches / values.length;
}

/** Check if values look like identifiers (alphanumeric, consistent format) */
function looksLikeIdentifier(values: string[]): boolean {
  if (values.length < 3) return false;
  // Check if most values contain digits mixed with separators/letters
  let hasDigitCount = 0;
  let hasSeparatorCount = 0;
  const lengths: number[] = [];
  for (const val of values) {
    if (/\d/.test(val)) hasDigitCount++;
    if (/[-_#\/\\]/.test(val)) hasSeparatorCount++;
    lengths.push(val.length);
  }
  const digitRatio = hasDigitCount / values.length;
  // Identifiers typically have digits and relatively consistent length
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lenVariance =
    lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / lengths.length;
  const lenStdDev = Math.sqrt(lenVariance);
  // Low length variation + has digits = likely identifier
  return digitRatio > 0.6 && lenStdDev < avgLen * 0.5;
}

// ── Per-field content detectors ──────────────────────────────────────────

type FieldDetector = (
  sampleData: any[][],
  headers: string[],
  unmappedIndices: number[],
) => ContentMatch | null;

/**
 * date_of_loss: Look for columns where >50% of values parse as dates.
 * Use parseDate for robust detection (handles serials, ISO, US, text months).
 */
const detectDateOfLoss: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestRate = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const { count, total } = countDates(samples);
    if (total < 3) continue;
    const rate = count / total;
    if (rate > bestRate && rate >= 0.5) {
      bestRate = rate;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  const score = 25 + Math.round(bestRate * 20); // 25–45 range
  return {
    index: bestIdx,
    score,
    reason: `${Math.round(bestRate * 100)}% of values parse as dates`,
  };
};

/**
 * total_incurred: Look for currency/number columns where values tend to be
 * large ($100+). Distinguishes from lost_days (small integers).
 */
const detectTotalIncurred: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const { count, total, median, values } = countCurrency(samples);
    if (total < 3) continue;
    const rate = count / total;
    if (rate < 0.5) continue;

    // Large values (median > 100) suggest currency amounts, not counts
    let score = 25 + Math.round(rate * 10);
    if (median > 100) score += 5;
    if (median > 1000) score += 5;
    // Check for currency symbols in original data
    const hasCurrencySymbol = (sampleData[colIdx] || []).some(
      (v: any) => typeof v === "string" && /[\$]/.test(v),
    );
    if (hasCurrencySymbol) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column contains currency-like values (large numbers)",
  };
};

/**
 * site_name: Look for moderate-cardinality text columns (5–50 distinct values)
 * with short-to-medium strings. Not identifiers, not descriptions.
 */
const detectSiteName: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const card = analyzeCardinality(samples);
    if (card.total < 3) continue;

    // Site/location: moderate cardinality, short strings, mostly text
    let score = 0;
    // Cardinality ratio 0.05–0.5 is good for locations (not unique, not all-same)
    if (card.ratio >= 0.05 && card.ratio <= 0.5) score += 10;
    // Short-medium strings (3–50 chars)
    if (card.avgLength >= 3 && card.avgLength <= 50) score += 10;
    // Multiple distinct values
    if (card.distinct >= 2 && card.distinct <= 50) score += 5;
    // Not mostly numbers
    const { count: numCount, total: numTotal } = countCurrency(samples);
    const numRate = numTotal > 0 ? numCount / numTotal : 0;
    if (numRate < 0.3) score += 5;

    const totalScore = 25 + Math.min(score, 20);
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column contains moderate-cardinality location-like text",
  };
};

/**
 * claim_number: Look for high-cardinality identifier-like columns.
 * Nearly unique values, often alphanumeric with consistent format.
 */
const detectClaimNumber: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const card = analyzeCardinality(samples);
    if (card.total < 3) continue;

    let score = 0;
    // High cardinality (mostly unique)
    if (card.ratio > 0.8) score += 10;
    // Looks like identifiers (digits + consistent format)
    if (looksLikeIdentifier(card.values)) score += 15;
    // Not too long (identifiers are typically 5–25 chars)
    if (card.avgLength >= 3 && card.avgLength <= 30) score += 5;

    const totalScore = 25 + Math.min(score, 20);
    if (totalScore > bestScore && score >= 15) {
      bestScore = totalScore;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column contains unique identifier-like values",
  };
};

/**
 * claim_category: Look for very low cardinality text (2–10 distinct values)
 * matching known category keywords (MO, Indemnity, Lost Time, etc.).
 */
const detectClaimCategory: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const card = analyzeCardinality(samples);
    if (card.total < 3) continue;

    let score = 0;
    // Very low cardinality
    if (card.distinct >= 2 && card.distinct <= 10) score += 10;
    // Known category keywords
    const kwRate = keywordMatchRate(card.values, CATEGORY_KEYWORDS);
    if (kwRate > 0.3) score += 10 + Math.round(kwRate * 10);
    // Short strings
    if (card.avgLength >= 2 && card.avgLength <= 30) score += 5;

    const totalScore = 25 + Math.min(score, 20);
    if (totalScore > bestScore && score >= 10) {
      bestScore = totalScore;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column contains claim category keywords (MO/Indemnity)",
  };
};

/**
 * body_part: Look for categorical text columns matching body-part vocabulary.
 */
const detectBodyPart: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const card = analyzeCardinality(samples);
    if (card.total < 3) continue;

    let score = 0;
    const kwRate = keywordMatchRate(card.values, BODY_PART_KEYWORDS);
    if (kwRate > 0.3) score += 15 + Math.round(kwRate * 10);
    // Moderate cardinality (5–30 distinct body parts)
    if (card.distinct >= 2 && card.distinct <= 40) score += 5;
    if (card.avgLength >= 3 && card.avgLength <= 40) score += 5;

    const totalScore = 25 + Math.min(score, 20);
    if (totalScore > bestScore && kwRate > 0.3) {
      bestScore = totalScore;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column values match body part vocabulary",
  };
};

/**
 * cause_of_loss: Look for categorical text matching injury cause vocabulary.
 */
const detectCauseOfLoss: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const card = analyzeCardinality(samples);
    if (card.total < 3) continue;

    let score = 0;
    const kwRate = keywordMatchRate(card.values, CAUSE_KEYWORDS);
    if (kwRate > 0.3) score += 15 + Math.round(kwRate * 10);
    // Moderate cardinality
    if (card.distinct >= 2 && card.distinct <= 40) score += 5;
    if (card.avgLength >= 3 && card.avgLength <= 50) score += 5;

    const totalScore = 25 + Math.min(score, 20);
    if (totalScore > bestScore && kwRate > 0.3) {
      bestScore = totalScore;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column values match injury cause vocabulary",
  };
};

/**
 * lost_days: Look for number columns with small integer values (0–365).
 * Distinguishes from total_incurred (large currency) by value range.
 */
const detectLostDays: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const { count, total, median, values } = countCurrency(samples);
    if (total < 3) continue;
    const rate = count / total;
    if (rate < 0.5) continue;

    let score = 25 + Math.round(rate * 10);
    // Small integers (0–365) suggest day counts
    if (median >= 0 && median <= 365) score += 5;
    // Most values are small integers
    const smallIntCount = values.filter(
      (v) => v >= 0 && v <= 365 && Number.isInteger(v),
    ).length;
    if (values.length > 0 && smallIntCount / values.length > 0.6) score += 5;
    // No currency symbols (distinguishes from incurred)
    const hasCurrencySymbol = (sampleData[colIdx] || []).some(
      (v: any) => typeof v === "string" && /[\$]/.test(v),
    );
    if (!hasCurrencySymbol) score += 3;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column contains small integer values (day counts)",
  };
};

/**
 * loss_description: Look for high-cardinality, long text columns.
 * Narrative/descriptive text — mostly unique, avg length > 30 chars.
 */
const detectLossDescription: FieldDetector = (sampleData, _headers, unmappedIndices) => {
  let bestIdx = -1;
  let bestScore = 0;

  for (const colIdx of unmappedIndices) {
    const samples = sampleData[colIdx] || [];
    const card = analyzeCardinality(samples);
    if (card.total < 3) continue;

    let score = 0;
    // High cardinality (mostly unique narratives)
    if (card.ratio > 0.7) score += 10;
    // Long strings (narratives are typically 30+ chars)
    if (card.avgLength > 30) score += 10;
    if (card.avgLength > 60) score += 5;
    // Not numbers or dates
    const { count: numCount } = countCurrency(samples);
    const { count: dateCount } = countDates(samples);
    const numRate = card.total > 0 ? numCount / card.total : 0;
    const dateRate = card.total > 0 ? dateCount / card.total : 0;
    if (numRate < 0.2 && dateRate < 0.2) score += 5;

    const totalScore = 25 + Math.min(score, 20);
    if (totalScore > bestScore && score >= 15) {
      bestScore = totalScore;
      bestIdx = colIdx;
    }
  }

  if (bestIdx < 0) return null;
  return {
    index: bestIdx,
    score: Math.min(bestScore, 45),
    reason: "Column contains long narrative text",
  };
};

// ── Detector registry ────────────────────────────────────────────────────

const FIELD_DETECTORS: Record<string, FieldDetector> = {
  date_of_loss: detectDateOfLoss,
  total_incurred: detectTotalIncurred,
  site_name: detectSiteName,
  claim_number: detectClaimNumber,
  claim_category: detectClaimCategory,
  body_part: detectBodyPart,
  cause_of_loss: detectCauseOfLoss,
  lost_days: detectLostDays,
  loss_description: detectLossDescription,
};

// ── Public API ───────────────────────────────────────────────────────────

/**
 * For a specific field that wasn't matched by header name, analyze column
 * content to find the best candidate among unmapped columns.
 *
 * @param fieldKey - Canonical field name (e.g., "date_of_loss")
 * @param sampleData - Per-column sample values (sampleData[colIdx][rowIdx])
 * @param headers - Header strings for each column
 * @param alreadyMappedIndices - Set of column indices already claimed by other fields
 * @returns ContentMatch with score 25–45 (below header threshold of 50), or null
 */
export function detectFieldByContent(
  fieldKey: string,
  sampleData: any[][],
  headers: string[],
  alreadyMappedIndices: Set<number>,
): ContentMatch | null {
  const detector = FIELD_DETECTORS[fieldKey];
  if (!detector) return null;

  // Build list of unmapped column indices
  const unmappedIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (!alreadyMappedIndices.has(i)) {
      unmappedIndices.push(i);
    }
  }

  if (unmappedIndices.length === 0) return null;

  return detector(sampleData, headers, unmappedIndices);
}

/**
 * Run content-based detection for ALL unmapped fields in a single pass.
 * Respects field priority to avoid two fields claiming the same column.
 *
 * Priority order (required fields first, then by detection reliability):
 * 1. date_of_loss (dates are very distinctive)
 * 2. total_incurred (currency patterns are distinctive)
 * 3. site_name (moderate cardinality text)
 * 4. claim_number (unique identifiers)
 * 5. body_part (domain vocabulary)
 * 6. cause_of_loss (domain vocabulary)
 * 7. claim_category (low cardinality + keywords)
 * 8. lost_days (small integers)
 * 9. loss_description (long text)
 */
const DETECTION_ORDER = [
  "date_of_loss",
  "total_incurred",
  "site_name",
  "claim_number",
  "body_part",
  "cause_of_loss",
  "claim_category",
  "lost_days",
  "loss_description",
];

export function detectAllUnmappedFields(
  unmappedFieldKeys: string[],
  sampleData: any[][],
  headers: string[],
  alreadyMappedIndices: Set<number>,
): Record<string, ContentMatch> {
  const results: Record<string, ContentMatch> = {};
  const claimed = new Set(alreadyMappedIndices);

  // Process fields in priority order, but only those that are actually unmapped
  const unmappedSet = new Set(unmappedFieldKeys);

  for (const fieldKey of DETECTION_ORDER) {
    if (!unmappedSet.has(fieldKey)) continue;

    const match = detectFieldByContent(fieldKey, sampleData, headers, claimed);
    if (match) {
      results[fieldKey] = match;
      claimed.add(match.index); // Reserve this column for this field
    }
  }

  return results;
}
