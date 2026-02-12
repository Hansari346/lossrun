/** Definition of a mappable field (required or optional) */
export interface FieldDefinition {
  label: string;
  description: string;
  required?: boolean;
  hints: string[];
  fieldType: "text" | "number" | "date";
}

/** Column index mapping: canonical field name → column index in the sheet */
export type Mappings = Record<string, number>;

/** A single normalized claim record after column mapping */
export interface CanonicalRecord {
  site_name: string;
  date_of_loss: Date | null;
  total_incurred: number;
  claim_number?: string;
  claim_category?: string;
  body_part?: string;
  lost_days?: number;
  cause_of_loss?: string;
  loss_description?: string;
  [key: string]: any;
}

/** User-configurable adjustment parameters */
export interface AdjustmentParams {
  // Improvement percentages (0–100 scale, converted to ratio in calculations)
  wcReduction: number;
  lostTimeReduction: number;
  retentionImprovement: number;
  miscCostReduction: number;
  obsSpeedImprovement: number;

  // Customer mode
  isExistingCustomer: boolean;
  voxelStartYear: number;
  voxelStartMonth: number;

  // Annualization
  annualize: boolean;
  annualizeMonths: number;
  annualizeRounding: "round" | "ceil" | "floor";

  // Financial inputs
  avgCost: number;
  miscDirect: number;
  miscIndirect: number;
  indirectMult: number;
  injuries: number;

  // Org inputs
  headcount: number;
  supCount: number;
  shifts: number;
  rate: number;
  workdays: number;
  trainingHours: number;

  // Observation inputs
  includeObs: boolean;
  minObsManual: number;
  obsPerShift: number;
  totalAnnualObs: number;
}

/** Output of the calculation engine — consumed by charts, KPI tiles, and exports */
export interface CalculationResults {
  // --- KPI tile values ---
  directManual: number;
  directImproved: number;
  indirectManual: number;
  indirectImproved: number;
  obsManual: number;
  obsImproved: number;
  totalManual: number;
  totalImproved: number;
  annualSavings: number;

  // Injuries & TRIR
  injuriesManual: number;
  injuriesImproved: number;
  trirManual: number;
  trirImproved: number;

  // Observation cost decomposition
  costObsLaborManual: number;
  costObsReportingManual: number;
  costObsLaborImproved: number;
  costObsReportingImproved: number;
  costTraining: number;

  // Payback (sigmoid ramp-up, 24 months)
  paybackData: PaybackData;

  // Year-1 realized savings (sigmoid-adjusted)
  totalImprovedYear1: number;

  // Annualization detail
  annualizeDetail: string;

  // Customer / prospect mode flag (passed through for charts/export)
  isExistingCustomer: boolean;
  voxelStartDate: Date | null;
  wcReduction: number;
  includeObs: boolean;

  // Per-year breakdown for trend charts
  yearlyData: YearlyBreakdown[];
  // Category breakdowns
  categoryBreakdown: CategoryBreakdown[];
  bodyPartBreakdown: CategoryBreakdown[];
  causeBreakdown: CategoryBreakdown[];
  // Site comparison data
  siteComparison: SiteBreakdown[];
}

export interface PaybackData {
  months: number[];
  cumulativeSavings: number[];
  cumulativeCost: number[];
  netCashFlow: number[];
  paybackMonth: number;
}

export interface YearlyBreakdown {
  year: number;
  claims: number;
  incurred: number;
  moClaims: number;
  indemnClaims: number;
  moIncurred: number;
  indemnIncurred: number;
}

export interface CategoryBreakdown {
  name: string;
  count: number;
  incurred: number;
  percentage: number;
}

export interface SiteBreakdown {
  site: string;
  claims: number;
  incurred: number;
  avgCost: number;
}

// ── Ingestion Pipeline Types ──────────────────────────────────────────

/** Generic parse-or-report result — universal return type for all parsing functions */
export interface ParseResult<T> {
  value: T | null;
  error: string | null;
  raw: string;
}

/** Per-row validation error */
export interface RowError {
  rowIndex: number;
  field: string;
  message: string;
  rawValue: string;
}

/** Aggregated validation output for a parsed sheet */
export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  errors: RowError[];
  warnings: string[];
  unparsableDates: number;
  invalidAmounts: number;
  missingRequired: number;
}

/** Sheet ranking result for multi-sheet workbooks */
export interface SheetScore {
  sheetName: string;
  score: number;
  reasons: string[];
}

/** Detected Key:Value column for composite field extraction */
export interface CompositeField {
  columnIndex: number;
  headerName: string;
  extractedKeys: string[];
  keyFrequency: Map<string, number>;
}
