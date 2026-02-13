import { signal, computed, batch } from "@preact/signals";
import { detectDimensions, DIMENSION_KEYS } from "../lib/dimensions";
import type { DimensionKey, DimensionAvailability } from "../types";
import { computeResults, getFilteredData } from "../lib/calculations";
import type {
  CanonicalRecord,
  Mappings,
  AdjustmentParams,
  CalculationResults,
  ValidationSummary,
  SheetScore,
  CompositeField,
} from "../types";

export { batch } from "@preact/signals";

// === Core data signals (replacing 6 global variables from monolith) ===
export const workbook = signal<any>(null);
export const currentSheetName = signal<string | null>(null);
export const headerRow = signal<string[]>([]);
export const mappings = signal<Mappings>({});
export const canonicalData = signal<CanonicalRecord[]>([]);
export const chartInstances = signal<Record<string, any>>({});

// === Wizard navigation ===
export const currentPage = signal<1 | 2 | 3>(1);

// === Adjustment parameters (with defaults matching monolith's "Balanced" preset) ===
export const adjustments = signal<AdjustmentParams>({
  wcReduction: 65,
  lostTimeReduction: 81,
  retentionImprovement: 18,
  miscCostReduction: 41,
  obsSpeedImprovement: 2.0,
  isExistingCustomer: false,
  voxelStartYear: new Date().getFullYear(),
  voxelStartMonth: 0,
  annualize: false,
  annualizeMonths: new Date().getMonth() + 1,
  annualizeRounding: "round",
  avgCost: 0,
  miscDirect: 0,
  miscIndirect: 0,
  indirectMult: 1.3,
  injuries: 0,
  headcount: 150,
  supCount: 0,
  shifts: 0,
  rate: 0,
  workdays: 0,
  trainingHours: 0,
  includeObs: false,
  minObsManual: 0,
  obsPerShift: 0,
  totalAnnualObs: 0,
});

// === Site filtering ===
export const selectedSite = signal<string>("all");
export const availableSites = signal<string[]>([]);

// === UI state ===
export const statusMessage = signal<string>("");

// === Validation state ===
export const validationSummary = signal<ValidationSummary | null>(null);

// === Sheet analysis state ===
export const sheetScores = signal<SheetScore[]>([]);

// === Composite field state ===
export const compositeFields = signal<CompositeField[]>([]);

// === Dimension detection state ===
export const dimensionOverrides = signal<Partial<Record<DimensionKey, boolean>>>({});

// === Derived: dimension detection (recomputes only when canonicalData changes) ===
export const detectedDimensions = computed<DimensionAvailability | null>(() => {
  const data = canonicalData.value;
  if (data.length === 0) return null;
  return detectDimensions(data);
});

// === Derived: active dimensions (merges detected + user overrides) ===
export const activeDimensions = computed<Record<DimensionKey, boolean>>(() => {
  const detected = detectedDimensions.value;
  if (!detected) {
    return Object.fromEntries(DIMENSION_KEYS.map((k) => [k, false])) as Record<DimensionKey, boolean>;
  }
  const overrides = dimensionOverrides.value;
  return Object.fromEntries(
    DIMENSION_KEYS.map((k) => [k, overrides[k] ?? detected[k].available])
  ) as Record<DimensionKey, boolean>;
});

// === Reactive results — auto-recomputes when inputs change ===
export const results = computed<CalculationResults | null>(() => {
  const data = canonicalData.value;
  if (data.length === 0) return null;

  const filtered = getFilteredData(data, selectedSite.value);
  const params = adjustments.value;
  const dims = activeDimensions.value;

  try {
    return computeResults(filtered, params, dims);
  } catch (e) {
    console.error("Calculation error:", e);
    return null;
  }
});

// === Derived state ===
export const hasData = computed(() => canonicalData.value.length > 0);
export const sheetNames = computed(() => {
  const wb = workbook.value;
  return wb ? (wb.SheetNames as string[]) ?? [] : [];
});
export const hasValidationErrors = computed(() => {
  const vs = validationSummary.value;
  return vs !== null && vs.skippedRows > 0;
});

// === Reset ===
export function resetState() {
  workbook.value = null;
  currentSheetName.value = null;
  headerRow.value = [];
  mappings.value = {};
  canonicalData.value = [];
  chartInstances.value = {};
  currentPage.value = 1;
  selectedSite.value = "all";
  availableSites.value = [];
  statusMessage.value = "";
  validationSummary.value = null;
  sheetScores.value = [];
  compositeFields.value = [];
  dimensionOverrides.value = {};
}
