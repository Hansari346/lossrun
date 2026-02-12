import type { FieldDefinition } from "../types";

// ── Pure utilities ──────────────────────────────────────────────────────────

/** Lowercase, collapse separators to single space, remove special chars, trim */
export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ") // Replace underscores, hyphens, multiple spaces with single space
    .replace(/[^\w\s]/g, "") // Remove special characters except word chars and spaces
    .trim();
}

/**
 * Score how well a header matches a set of hint strings.
 * Higher score → better match. Returns best score across all hints.
 */
export function calculateMatchScore(
  header: string,
  hints: string[],
  fieldType?: string,
): number {
  const normalizedHeader = normalizeString(header);
  let bestScore = 0;

  for (const hint of hints) {
    const normalizedHint = normalizeString(hint);
    let score = 0;

    // Exact match (highest score)
    if (normalizedHeader === normalizedHint) {
      score = 100;
    }
    // Starts with hint (high score)
    else if (
      normalizedHeader.startsWith(normalizedHint + " ") ||
      normalizedHeader.startsWith(normalizedHint)
    ) {
      score = 90;
    }
    // Ends with hint (high score)
    else if (
      normalizedHeader.endsWith(" " + normalizedHint) ||
      normalizedHeader.endsWith(normalizedHint)
    ) {
      score = 85;
    }
    // Contains hint as whole word (medium-high score)
    else if (new RegExp(`\\b${normalizedHint}\\b`).test(normalizedHeader)) {
      score = 80;
    }
    // Contains hint anywhere (medium score)
    else if (normalizedHeader.includes(normalizedHint)) {
      score = 60;
    }
    // Fuzzy match – check if all words in hint are present
    else {
      const hintWords = normalizedHint.split(/\s+/).filter((w) => w.length > 2);
      const headerWords = normalizedHeader.split(/\s+/);
      const matchingWords = hintWords.filter((hw) =>
        headerWords.some((hdw) => hdw.includes(hw) || hw.includes(hdw)),
      );
      if (matchingWords.length === hintWords.length && hintWords.length > 0) {
        score = 50 + matchingWords.length * 5;
      }
    }

    // Bonus for field-type-specific patterns
    if (fieldType === "date") {
      if (
        /\b(date|dt|dte|day|time)\b/i.test(header) &&
        /\b(loss|injury|incident|occur|accident|claim)\b/i.test(header)
      ) {
        score += 10;
      }
    } else if (fieldType === "number") {
      if (
        /\b(total|sum|amount|cost|paid|incurred|reserve|value|amt)\b/i.test(
          header,
        )
      ) {
        score += 10;
      }
    } else if (fieldType === "text") {
      if (
        /\b(site|location|facility|store|city|place|address)\b/i.test(header)
      ) {
        score += 10;
      }
    }

    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

/**
 * Detect the predominant data type of a column from sample values.
 * Returns "date", "number", or "text".
 */
export function detectColumnType(
  sampleValues: any[],
): "date" | "number" | "text" | "unknown" {
  if (!sampleValues || sampleValues.length === 0) return "unknown";

  let dateCount = 0;
  let numberCount = 0;
  let textCount = 0;

  const datePatterns = [
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/, // MM/DD/YYYY or similar
    /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/, // YYYY-MM-DD
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // MM/DD/YYYY
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s,]\d{1,2},?\s\d{4}$/i, // Month DD, YYYY
    /^\d{1,2}[\s\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-]\d{2,4}$/i, // DD Month YYYY
  ];

  sampleValues.slice(0, 10).forEach((val) => {
    if (val === null || val === undefined || val === "") return;

    const str = String(val).trim();
    if (str.length < 3) {
      textCount++;
      return;
    }

    // Check if it's a date – try multiple methods
    let isDate = false;

    // Check date patterns
    if (datePatterns.some((pattern) => pattern.test(str))) {
      isDate = true;
    }
    // Check if Date constructor can parse it
    else {
      const dateTest = new Date(str);
      if (!isNaN(dateTest.getTime()) && str.length > 5) {
        const year = dateTest.getFullYear();
        if (year >= 1900 && year <= 2100) {
          isDate = true;
        }
      }
    }

    if (isDate) {
      dateCount++;
    }
    // Check if it's a number (including currency)
    else if (
      /^[\$,\d\s\.\-\(\)]+$/.test(str.replace(/[,\$\(\)]/g, "")) &&
      !isNaN(parseFloat(str.replace(/[,\$\(\)]/g, ""))) &&
      str.replace(/[,\$\(\)\s]/g, "").length > 0
    ) {
      numberCount++;
    } else {
      textCount++;
    }
  });

  if (dateCount > numberCount && dateCount > textCount && dateCount >= 2)
    return "date";
  if (numberCount > textCount && numberCount >= 2) return "number";
  return "text";
}

/**
 * Find the best matching column header for a given field definition.
 * Returns the matched header string and its score, or null if below threshold.
 */
export function findBestMatch(
  headers: string[],
  sampleData: any[][] | null,
  fieldDef: FieldDefinition,
): { index: number; score: number } | null {
  let bestIndex = -1;
  let bestScore = 0;

  headers.forEach((header, idx) => {
    if (!header || header.trim() === "") return;

    let score = calculateMatchScore(
      header,
      fieldDef.hints,
      fieldDef.fieldType,
    );

    // Bonus if detected column type matches expected field type
    if (sampleData && sampleData[idx]) {
      const detectedType = detectColumnType(sampleData[idx]);
      if (detectedType === fieldDef.fieldType) {
        score += 15; // Significant bonus for type match
      }
    }

    if (score > bestScore && score >= 50) {
      // Minimum threshold
      bestScore = score;
      bestIndex = idx;
    }
  });

  if (bestIndex < 0) return null;
  return { index: bestIndex, score: bestScore };
}

// ── Canonical field definitions ─────────────────────────────────────────────

export const requiredFields: Record<string, FieldDefinition> = {
  site_name: {
    label: "Site / Location",
    description: "City or location name used to filter claims.",
    required: true,
    hints: [
      "site",
      "location",
      "facility",
      "store",
      "city",
      "place",
      "address",
      "branch",
      "plant",
      "warehouse",
    ],
    fieldType: "text",
  },
  date_of_loss: {
    label: "Date of Loss",
    description: "Date the injury/claim occurred.",
    required: true,
    hints: [
      "date of loss",
      "loss date",
      "date of injury",
      "doi",
      "date loss",
      "incident date",
      "accident date",
      "occurrence date",
      "claim date",
      "injury date",
    ],
    fieldType: "date",
  },
  total_incurred: {
    label: "Total Incurred",
    description: "Total incurred cost (paid + reserves).",
    required: true,
    hints: [
      "total incurred",
      "net incurred",
      "all gross incurred",
      "incurred",
      "total incur",
      "incurred total",
      "total loss",
      "loss amount",
      "claim amount",
      "total cost",
      "total paid incurred",
    ],
    fieldType: "number",
  },
};

export const optionalFields: Record<string, FieldDefinition> = {
  claim_number: {
    label: "Claim Number",
    description: "Unique claim identifier.",
    hints: [
      "claim number",
      "claim #",
      "cnr",
      "claim num",
      "claim id",
      "claim no",
      "claim#",
      "case number",
      "case #",
      "file number",
    ],
    fieldType: "text",
  },
  claim_category: {
    label: "Claim Category (MO vs Indemnity)",
    description: "Medical-only vs indemnity / lost-time classification.",
    hints: [
      "claim type",
      "derived claim type",
      "coverage line",
      "category",
      "type",
      "classification",
      "claim category",
      "mo indemnity",
      "medical only",
    ],
    fieldType: "text",
  },
  body_part: {
    label: "Body Part",
    description: "Primary body part injured.",
    hints: [
      "body part",
      "part of body",
      "bodypart",
      "part body",
      "injury part",
      "affected part",
      "anatomy",
    ],
    fieldType: "text",
  },
  lost_days: {
    label: "Lost Work Days",
    description: "Number of days lost due to the claim.",
    hints: [
      "lost days",
      "days lost",
      "disability days",
      "lost time days",
      "lt days",
      "days disability",
      "work days lost",
      "days off",
      "lost work",
      "time loss days",
    ],
    fieldType: "number",
  },
  cause_of_loss: {
    label: "Loss Category / Cause Bucket",
    description:
      "Categorical classification of the loss (e.g., Slip/Trip, Overexertion, Struck By).",
    hints: [
      "loss category",
      "cause bucket",
      "loss bucket",
      "category",
      "cause category",
      "loss type",
      "accident category",
      "incident category",
      "injury category",
      "loss classification",
      "cause classification",
      "loss code",
      "cause code",
    ],
    fieldType: "text",
  },
  loss_description: {
    label: "Loss Description",
    description:
      "Text description of the incident (used for AI categorization).",
    hints: [
      "description",
      "loss description",
      "accident description",
      "incident description",
      "notes",
      "comments",
      "narrative",
      "details",
      "injury description",
      "cause description",
    ],
    fieldType: "text",
  },
};
