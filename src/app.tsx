import { currentPage } from "./state/store";
import { Nav } from "./components/nav";
import { UploadPage } from "./components/upload-page";
import { AdjustmentsPage } from "./components/adjustments-page";
import { ResultsPage } from "./components/results-page";

export function App() {
  return (
    <div class="app">
      <div class="badge">
        <span>Loss &amp; ROI Analysis</span>
      </div>
      <h1>Site Loss Viewer &amp; Projected ROI</h1>
      <Nav />
      {currentPage.value === 1 && <UploadPage />}
      {currentPage.value === 2 && <AdjustmentsPage />}
      {currentPage.value === 3 && <ResultsPage />}
    </div>
  );
}
