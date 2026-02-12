import { signal, computed } from "@preact/signals";
import type {
  CanonicalRecord,
  Mappings,
  AdjustmentParams,
  CalculationResults,
} from "../types";

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
  wcReduction: 40,
  lostTimeReduction: 60,
  retentionImprovement: 10,
  miscCostReduction: 25,
  obsSpeedImprovement: 1.5,
  isExistingCustomer: false,
  voxelStartYear: new Date().getFullYear(),
  annualize: false,
  annualizeMonths: new Date().getMonth() + 1,
  observationCost: 0,
});

// === Calculation results ===
export const results = signal<CalculationResults | null>(null);

// === Site filtering ===
export const selectedSite = signal<string>("all");
export const availableSites = signal<string[]>([]);

// === UI state ===
export const isCalculating = signal<boolean>(false);
export const statusMessage = signal<string>("");

// === Derived state ===
export const hasData = computed(() => canonicalData.value.length > 0);
export const sheetNames = computed(() => {
  const wb = workbook.value;
  return wb ? (wb.SheetNames as string[]) ?? [] : [];
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
  results.value = null;
  selectedSite.value = "all";
  availableSites.value = [];
  statusMessage.value = "";
}
