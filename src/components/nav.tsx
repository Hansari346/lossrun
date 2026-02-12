import { currentPage, hasData } from "../state/store";

const steps = [
  { page: 1 as const, label: "1. Data Ingestion" },
  { page: 2 as const, label: "2. Adjustments" },
  { page: 3 as const, label: "3. Results" },
];

export function Nav() {
  return (
    <div class="nav">
      {steps.map(({ page, label }) => {
        const isActive = currentPage.value === page;
        const isDisabled = page > 1 && !hasData.value;
        return (
          <button
            key={page}
            class={`nav-btn${isActive ? " active" : ""}`}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) currentPage.value = page;
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
