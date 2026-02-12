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
  wcReduction: number;
  lostTimeReduction: number;
  retentionImprovement: number;
  miscCostReduction: number;
  obsSpeedImprovement: number;
  isExistingCustomer: boolean;
  voxelStartYear: number;
  annualize: boolean;
  annualizeMonths: number;
  observationCost: number;
}

/** Output of the calculation engine — consumed by charts, KPI tiles, and exports */
export interface CalculationResults {
  // Counts
  totalClaims: number;
  moClaims: number;
  indemnClaims: number;
  // Costs
  totalIncurred: number;
  moIncurred: number;
  indemnIncurred: number;
  avgCostPerClaim: number;
  // Derived metrics
  trirCurrent: number;
  trirImproved: number;
  // Payback / ROI
  currentTotal: number;
  improvedTotal: number;
  savings: number;
  roi: number;
  paybackMonths: number;
  // Per-year breakdown for trend charts
  yearlyData: YearlyBreakdown[];
  // Category breakdowns
  categoryBreakdown: CategoryBreakdown[];
  bodyPartBreakdown: CategoryBreakdown[];
  causeBreakdown: CategoryBreakdown[];
  // Site comparison data
  siteComparison: SiteBreakdown[];
  // Chart-specific data objects
  chartData: Record<string, any>;
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
