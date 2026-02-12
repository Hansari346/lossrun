// src/worker.js
var HTML_CONTENT = `  <!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Site Loss & ROI Tool</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <!-- SheetJS for Excel parsing -->
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"><\/script>
  <!-- Chart.js for charts -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
  <!-- PptxGenJS for PowerPoint export -->
  <script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"><\/script>
  <style>
    :root {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color-scheme: light;
      --bg: #f8fafc;
      --fg: #0f172a;
      --card-bg: #ffffff;
      --card-border: #e2e8f0;
      --accent: #0f172a;
      --accent-hover: #334155;
      --accent-soft: #f1f5f9;
      --muted: #64748b;
      --danger: #ef4444;
      --success: #22c55e;
      --input-bg: #ffffff;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background-color: var(--bg);
      color: var(--fg);
      line-height: 1.5;
    }
    .app {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 20px 60px;
    }
    .nav {
      display: flex;
      gap: 12px;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }
    .nav-btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .nav-btn:hover:not(:disabled) {
      background: #f1f5f9;
      color: var(--fg);
    }
    .nav-btn.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    .nav-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .page {
      display: none;
      animation: fadeIn 0.3s ease;
    }
    .page.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.75rem;
      letter-spacing: -0.02em;
      color: var(--fg);
    }
    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 1rem;
      color: var(--fg);
    }
    p {
      color: var(--muted);
      margin-top: 0;
      line-height: 1.6;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: var(--accent);
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .col {
      flex: 1 1 300px;
      min-width: 300px;
    }
    .card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--card-border);
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
      margin-bottom: 20px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      cursor: pointer;
      user-select: none;
    }
    .collapse-toggle {
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--muted);
      margin-left: 12px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .card-header:hover .collapse-toggle {
      background: #f1f5f9;
      color: var(--fg);
    }
    .chart-content {
      overflow: hidden;
      transition: all 0.3s ease-out;
      max-height: 5000px;
    }
    .chart-content.collapsed {
      max-height: 0 !important;
      opacity: 0;
      margin: 0 !important;
      padding: 0 !important;
    }
    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--fg);
      display: block;
      margin-bottom: 6px;
    }
    input[type="file"],
    select,
    input[type="number"],
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--card-border);
      background: var(--input-bg);
      color: var(--fg);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    select:focus,
    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.1);
    }
    button {
      border-radius: 8px;
      border: none;
      padding: 10px 20px;
      font-size: 0.9rem;
      cursor: pointer;
      background: var(--accent);
      color: white;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    button:hover:not([disabled]) {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }
    button:active:not([disabled]) {
      transform: translateY(0);
    }
    button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
      background: #cbd5e1;
      color: var(--muted);
    }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--card-border);
      color: var(--fg);
    }
    .btn-secondary:hover:not([disabled]) {
      background: #f8fafc;
      border-color: var(--muted);
    }
    .pill {
      display: inline-flex;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #f1f5f9;
      border: 1px solid var(--card-border);
      font-size: 0.75rem;
      color: var(--muted);
      gap: 6px;
      align-items: center;
    }
    .pill span.key {
      color: var(--fg);
      font-weight: 600;
    }
    .mapping-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.875rem;
      margin-top: 12px;
    }
    .mapping-table th,
    .mapping-table td {
      padding: 12px;
      border-bottom: 1px solid var(--card-border);
    }
    .mapping-table th {
      text-align: left;
      font-weight: 600;
      color: var(--muted);
      background: #f8fafc;
    }
    .mapping-table tr:last-child td {
      border-bottom: none;
    }
    .mapping-required {
      color: var(--danger);
      font-size: 0.75rem;
      font-weight: 600;
      margin-left: 6px;
      background: rgba(239, 68, 68, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .status {
      font-size: 0.875rem;
      margin-top: 8px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status.error {
      color: var(--danger);
    }
    .status.ok {
      color: var(--success);
    }
    .row3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .row2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    @media (max-width: 768px) {
      .row3, .row2 {
        grid-template-columns: 1fr;
      }
    }
    .hint {
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 6px;
      margin-bottom: 12px;
    }
    .switch {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid var(--card-border);
    }
    .switch input {
      width: auto;
      margin: 0;
    }
    .small {
      font-size: 0.875rem;
    }
    .sep {
      height: 1px;
      background: var(--card-border);
      margin: 24px 0;
    }
    .kpi {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 12px;
    }
    .kpi .tile {
      background: #f8fafc;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
    }
    .kpi .tile h3 {
      font-size: 0.875rem;
      color: var(--muted);
      margin: 0 0 8px;
      font-weight: 500;
    }
    .kpi .tile .v {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      font-size: 1.5rem;
      color: var(--fg);
      margin-top: auto;
    }
    .total {
      color: var(--accent) !important;
    }
    canvas {
      max-width: 100%;
    }
    .chart-container {
      position: relative;
      height: 350px;
      width: 100%;
    }
    
    /* PPT Export Button Styles */
    .action-bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .btn-ppt {
      background: var(--accent);
      color: white;
    }
    .btn-ppt:hover:not([disabled]) {
      background: var(--accent-hover);
    }
    .btn-preset { background: #e2e8f0; color: #475569; padding: 4px 12px; font-size: 0.85rem; border-radius: 12px; margin-left: 4px; border: 1px solid #cbd5e1; }
    .btn-preset:hover { background: #cbd5e1; }
    .btn-preset.active { background: #3b82f6; color: white; border-color: #3b82f6; }
    .presets { display: flex; align-items: center; }
    .advanced-toggle { cursor: pointer; color: #3b82f6; font-size: 0.9rem; margin-top: 8px; display: inline-block; text-decoration: underline; }
    .advanced-section { display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; }
    .advanced-section.open { display: block; }
  </style>
</head>
<body>
<div class="app">
  <div class="badge">
    <span>Loss & ROI Analysis</span>
  </div>
  <h1>Site Loss Viewer & Projected ROI</h1>
  
  <!-- Navigation -->
  <div class="nav">
    <button class="nav-btn active" id="navPage1" onclick="showPage(1)">1. Data Ingestion</button>
    <button class="nav-btn" id="navPage2" onclick="showPage(2)" disabled>2. Adjustments</button>
    <button class="nav-btn" id="navPage3" onclick="showPage(3)" disabled>3. Results</button>
  </div>

  <!-- PAGE 1: Data Ingestion -->
  <div id="page1" class="page active">
    <p>
      Upload a carrier loss run, map the key fields, then proceed to adjustments and results.
      Required fields: <strong>Site</strong>, <strong>Date of Loss</strong>, and <strong>Total Incurred</strong>.
    </p>

  <div class="row">
    <div class="col">
      <div class="card">
        <div class="card-header">
          <h2 style="font-size:1rem;margin:0;">1. Upload loss run</h2>
          <span class="pill">
            <span class="key">Step 1</span>
            <span>Excel (.xlsx)</span>
          </span>
        </div>
        <label for="fileInput">Loss run file (.xlsx)</label>
        <input type="file" id="fileInput" accept=".xlsx,.xls" />
        <div style="margin-top:10px;">
          <label for="sheetSelect">Sheet</label>
          <select id="sheetSelect" disabled>
            <option value="">Select a file first\u2026</option>
          </select>
        </div>
            <div id="uploadStatus" class="status"></div>
            
            <!-- Existing Customer Toggle -->
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--card-border);">
              <div class="switch" style="margin-bottom: 0; background: transparent; padding: 0; border: none;">
                <input type="checkbox" id="existingCustomerToggle">
                <label for="existingCustomerToggle" style="font-weight: 600; color: var(--fg);">Currently using Voxel?</label>
              </div>
              <div id="customerDateRow" style="display:none; margin-top: 12px; animation: fadeIn 0.3s ease;">
                <label>Voxel Start Date</label>
                <div style="display:flex; gap:10px;">
                  <select id="voxelStartMonth" style="flex:1;">
                    <option value="0">January</option>
                    <option value="1">February</option>
                    <option value="2">March</option>
                    <option value="3">April</option>
                    <option value="4">May</option>
                    <option value="5">June</option>
                    <option value="6">July</option>
                    <option value="7">August</option>
                    <option value="8">September</option>
                    <option value="9">October</option>
                    <option value="10">November</option>
                    <option value="11">December</option>
                  </select>
                  <select id="voxelStartYear" style="flex:1;"></select>
                </div>
                <div class="hint">Select when Voxel was deployed to estimate savings realized to date.</div>
              </div>
            </div>
          </div>
        </div>

    <div class="col">
      <div class="card">
        <div class="card-header">
          <h2 style="font-size:1rem;margin:0;">2. Map columns</h2>
          <span class="pill">
            <span class="key">Step 2</span>
            <span>Field mapping</span>
          </span>
        </div>
        <p class="small">
            Map columns from your sheet to the tool's fields. Fields marked
          <span class="mapping-required">required</span> must be mapped.
        </p>
        <div id="mappingContainer" class="small">
          <div class="status">Select a sheet to see available columns.</div>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div>
            <button id="applyMappingBtn" disabled>Apply mapping &amp; load data</button>
          </div>
          <span id="mappingStatus" class="status"></span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Site Filter (shown after data is loaded) -->
  <div class="row" id="siteFilterRow" style="display:none; margin-top:16px;">
    <div class="col">
      <div class="card">
        <div class="card-header">
          <h2 style="font-size:1rem;margin:0;">3. Filter by site (optional)</h2>
          <span class="pill">
            <span class="key">Filter</span>
            <span>Focus analysis</span>
          </span>
        </div>
        <label for="siteFilterSelect">Select site for analysis</label>
        <select id="siteFilterSelect">
          <option value="">All Sites</option>
        </select>
        <div class="hint">Select a specific site to focus the analysis, or leave as "All Sites" to analyze all locations.</div>
        <div id="siteFilterStatus" class="status" style="margin-top:8px;"></div>
      </div>
    </div>
  </div>

  <!-- PAGE 2: Adjustments -->
  <div id="page2" class="page">
    <p>
      Adjust calculation assumptions and parameters. Data from the ingested loss run will be used to calculate baseline metrics.
    </p>

      <div class="card">
      <div class="card-header">
        <h2>Assumptions for Improved Scenario</h2>
        <div class="presets">
          <button class="btn-preset" onclick="applyPreset('conservative')">Conservative</button>
          <button class="btn-preset active" onclick="applyPreset('balanced')">Balanced</button>
          <button class="btn-preset" onclick="applyPreset('aggressive')">Aggressive</button>
        </div>
        </div>
      <div class="row3">
        <div>
          <label>Observation speed improvement</label>
          <select id="obsSpeedImprovement">
            <option value="1.5">Low</option>
            <option value="2.0" selected>Medium</option>
            <option value="2.5">High</option>
          </select>
          <div class="hint">How much faster observations become</div>
        </div>
        <div>
          <label>WC claims reduction (%)</label>
          <input type="number" id="wcReduction" value="65" min="0" max="100" step="1">
          <div class="hint">Reduction in workers' compensation claims</div>
          </div>
        </div>
      <div class="row3" style="margin-top: 8px;">
        <div>
          <label>Lost time reduction (%)</label>
          <input type="number" id="lostTimeReduction" value="81" min="0" max="100" step="1">
          <div class="hint">Reduction in lost time days</div>
          </div>
        <div>
          <label>Retention improvement (%)</label>
          <input type="number" id="retentionImprovement" value="18" min="0" max="100" step="1">
          <div class="hint">Improvement in retention (fewer turnover events)</div>
        </div>
        <div>
          <label>Misc Cost Reduction (%)</label>
          <input type="number" id="miscCostReduction" value="41" min="0" max="100" step="1">
          <div class="hint">Reduction in misc direct and indirect costs</div>
        </div>
      </div>
    </div>

      <div class="card">
      <div class="card-header">
        <h2>Injury Cost Inputs</h2>
        </div>
      <div class="row2">
        <div>
          <label>Average direct cost per injury</label>
          <input type="number" id="avgCost" value="0" min="0" step="1">
          <div class="hint">Auto-calculated from ingested data, or enter manually.</div>
        </div>
        <div>
          <label>Injuries last year (count or YTD)</label>
          <input type="number" id="injuries" value="0" min="0" step="1">
          <div class="hint">Auto-calculated from ingested data, or enter manually.</div>
        </div>
      </div>
      <div class="row2" style="margin-top: 8px;">
        <div>
          <label>Misc Cost (Direct)</label>
          <input type="number" id="miscDirect" value="0" min="0" step="1">
          <div class="hint">Additional direct costs not included in average injury cost.</div>
        </div>
        <div>
          <label>Misc Cost (Indirect)</label>
          <input type="number" id="miscIndirect" value="0" min="0" step="1">
          <div class="hint">Additional indirect costs not captured by other methods.</div>
        </div>
      </div>
      <div class="sep"></div>
      <div class="row2">
        <div>
          <label>Indirect cost multiplier</label>
          <input type="number" id="indirectMult" value="1.3" min="0" step="0.05">
          <div class="hint">Typical range ~1.1\xD7\u20134\xD7.</div>
        </div>
        <div></div>
      </div>
      <div class="sep"></div>
      <div class="switch small">
        <input type="checkbox" id="isYTD">
        <label for="isYTD">I only have YTD injuries (annualize to 12 months)</label>
      </div>
      <div class="row2" id="ytdRow" style="display:none">
        <div>
          <label>Months observed (1\u201312)</label>
          <input type="number" id="monthsObserved" value="9" min="1" max="12" step="1">
          <div class="hint">Annualized injuries = injuries \xD7 (12 \xF7 months)</div>
        </div>
        <div>
          <label>Annualization rounding</label>
          <select id="annualizeRound">
            <option value="ceil">Ceiling (round up)</option>
            <option value="round" selected>Nearest</option>
            <option value="floor">Floor (round down)</option>
          </select>
          <div class="hint">Rounding applied to the annualized injury count.</div>
      </div>
    </div>
  </div>

      <div class="card">
      <div class="card-header">
        <h2>Observation Program Costs</h2>
        </div>
      <div class="switch small">
        <input type="checkbox" id="includeObs" checked>
        <label for="includeObs">Include observation program in totals</label>
      </div>
      <div class="row3">
        <div>
          <label>Total Headcount (#)</label>
          <input type="number" id="headcount" value="150" min="1" step="1">
          <div class="hint">For TRIR calculation</div>
        </div>
        <div>
          <label>Labor rate (per hour)</label>
          <input type="number" id="rate" value="40" min="0" step="1">
        </div>
        <div>
          <label>Total Annual Observations (#)</label>
          <input type="number" id="totalAnnualObs" value="7500" min="0" step="100">
          <div class="hint">Est. total manual observations / year</div>
        </div>
      </div>
      
      <div class="advanced-toggle" onclick="toggleAdvanced('obsAdvanced')">Show Advanced / Calculator</div>
      <div id="obsAdvanced" class="advanced-section">
        <p style="margin-bottom:8px; font-size:0.9rem; color:#64748B;">Calculator: Updates "Total Annual Observations" above.</p>
        <div class="row3">
          <div>
            <label>Supervisors (#)</label>
            <input type="number" id="supCount" value="8" min="0" step="1" oninput="calculateObs()">
          </div>
          <div>
            <label>Shifts per day (#)</label>
            <input type="number" id="shifts" value="3" min="1" step="1" oninput="calculateObs()">
          </div>
          <div>
            <label>Observations per shift</label>
            <input type="number" id="obsPerShift" value="5" min="0" step="1" oninput="calculateObs()">
          </div>
        </div>
        <div class="row3" style="margin-top: 8px;">
          <div>
            <label>Workdays per year</label>
            <input type="number" id="workdays" value="313" min="0" step="1" oninput="calculateObs()">
          </div>
          <div>
             <label>Minutes per observation</label>
             <input type="number" id="minObsManual" value="30" min="0" step="1">
          </div>
          <div>
            <label>Training Hours/Year</label>
            <input type="number" id="trainingHours" value="4" min="0" step="0.5">
            <div class="hint">Safety training hours per employee</div>
          </div>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <button onclick="calculateAndNavigateToResults()" style="padding: 12px 24px; font-size: 1rem;">
        Calculate & View Results \u2192
      </button>
    </div>
  </div>

  <!-- PAGE 3: Results -->
  <div id="page3" class="page">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
      <div>
        <p>
          View comprehensive analysis of losses and projected improvements based on your assumptions.
        </p>
      </div>
      <button onclick="exportToPPT()" class="btn-ppt" id="exportBtn">
        <span>Download PowerPoint</span>
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Summary Metrics</h2>
      </div>
      <div class="kpi">
        <div class="tile">
          <h3>Direct Cost \u2014 Current</h3>
          <div class="v" id="directCostManual">\u2014</div>
        </div>
        <div class="tile">
          <h3>Direct Cost \u2014 Improved</h3>
          <div class="v" id="directCostImproved">\u2014</div>
        </div>
        <div class="tile">
          <h3>Indirect Cost \u2014 Current</h3>
          <div class="v" id="indirectCostManual">\u2014</div>
        </div>
        <div class="tile">
          <h3>Indirect Cost \u2014 Improved</h3>
          <div class="v" id="indirectCostImproved">\u2014</div>
        </div>
        <div class="tile">
          <h3>Observation Cost \u2014 Current</h3>
          <div class="v" id="obsManual">\u2014</div>
        </div>
        <div class="tile">
          <h3>Observation Cost \u2014 Improved</h3>
          <div class="v" id="obsImproved">\u2014</div>
        </div>
        <div class="tile">
          <h3>Total Safety Cost \u2014 Current</h3>
          <div class="v total" id="totalManual">\u2014</div>
        </div>
        <div class="tile">
          <h3>Total Safety Cost \u2014 Improved</h3>
          <div class="v total" id="totalImproved">\u2014</div>
        </div>
      </div>
      <div class="sep"></div>
      <div class="kpi">
        <div class="tile">
          <h3>Potential Savings</h3>
          <div class="v total" id="deltaBlock">\u2014</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <div class="card-header" onclick="toggleChart('causeOfLossChart')">
        <h2>Indemnity Breakdown by Loss Category</h2>
        <span class="collapse-toggle" id="toggle-causeOfLossChart">\u2212</span>
      </div>
      <div class="chart-content" id="content-causeOfLossChart">
        <div id="causeOfLossStatus" class="status" style="margin-bottom: 8px;"></div>
        <div class="chart-container" style="height: 400px;">
          <canvas id="causeOfLossChart"></canvas>
        </div>
      </div>
    </div>

        <div class="row">
          <div class="col">
        <div class="card">
          <div class="card-header" onclick="toggleChart('lossByTypeChart')">
            <h2>Loss by Type Year-over-Year</h2>
            <span class="collapse-toggle" id="toggle-lossByTypeChart">\u2212</span>
          </div>
          <div class="chart-content" id="content-lossByTypeChart">
            <div class="chart-container">
              <canvas id="lossByTypeChart"></canvas>
            </div>
          </div>
        </div>
          </div>
          <div class="col">
        <div class="card">
          <div class="card-header" onclick="toggleChart('lossByYearChart')">
            <h2>Total Incurred by Year</h2>
            <span class="collapse-toggle" id="toggle-lossByYearChart">\u2212</span>
          </div>
          <div class="chart-content" id="content-lossByYearChart">
            <div class="chart-container">
              <canvas id="lossByYearChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row" style="margin-top: 16px;">
    <div class="col">
      <div class="card">
          <div class="card-header" onclick="toggleChart('costComparisonChart')">
            <h2>Current vs Improved Costs</h2>
            <span class="collapse-toggle" id="toggle-costComparisonChart">\u2212</span>
          </div>
          <div class="chart-content" id="content-costComparisonChart">
            <div class="chart-container">
              <canvas id="costComparisonChart"></canvas>
            </div>
          </div>
          </div>
          </div>
      <div class="col">
        <div class="card">
          <div class="card-header" onclick="toggleChart('improvementsChart')">
            <h2>Projected Improvements</h2>
            <span class="collapse-toggle" id="toggle-improvementsChart">\u2212</span>
          </div>
          <div class="chart-content" id="content-improvementsChart">
            <div class="chart-container">
              <canvas id="improvementsChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row" style="margin-top: 16px;">
      <div class="col">
        <div class="card">
          <div class="card-header" onclick="toggleChart('paybackChart')">
            <h2>Investment Payback Analysis</h2>
            <span class="collapse-toggle" id="toggle-paybackChart">\u2212</span>
          </div>
          <div class="chart-content" id="content-paybackChart">
            <div class="chart-container">
              <canvas id="paybackChart"></canvas>
            </div>
            <div id="paybackStatus" class="status" style="margin-top:8px;"></div>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-header" onclick="toggleChart('trirChart')">
            <h2>TRIR Impact (OSHA Rate)</h2>
            <span class="collapse-toggle" id="toggle-trirChart">\u2212</span>
          </div>
          <div class="chart-content" id="content-trirChart">
            <div class="chart-container">
              <canvas id="trirChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <div class="card-header" onclick="toggleChart('obsBreakdownChart')">
        <h2>Observation Cost Decomposition</h2>
        <span class="collapse-toggle" id="toggle-obsBreakdownChart">\u2212</span>
      </div>
      <div class="chart-content" id="content-obsBreakdownChart">
        <div class="chart-container" style="height: 400px;">
          <canvas id="obsBreakdownChart"></canvas>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <div class="card-header" onclick="toggleChart('breakdownChart')">
        <h2>Total Cost Breakdown by Category</h2>
        <span class="collapse-toggle" id="toggle-breakdownChart">\u2212</span>
      </div>
      <div class="chart-content" id="content-breakdownChart">
        <div class="chart-container" style="height: 400px;">
          <canvas id="breakdownChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Site Comparison Section -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header" onclick="toggleChart('siteComparison')">
        <div>
          <h2>Site Comparison Analysis</h2>
          <span class="pill">
            <span class="key">Voxel Impact</span>
            <span>Multi-site insights</span>
          </span>
        </div>
        <span class="collapse-toggle" id="toggle-siteComparison">\u2212</span>
      </div>
      <div class="chart-content" id="content-siteComparison">
        <div id="siteComparisonStatus" class="status" style="margin-bottom: 8px;"></div>
        <div class="row">
          <div class="col">
            <div class="chart-container" style="height: 350px;">
              <canvas id="siteComparisonChart"></canvas>
            </div>
          </div>
          <div class="col">
            <div class="chart-container" style="height: 350px;">
              <canvas id="siteClaimsChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lost Days Analysis with Voxel Projections -->
    <div class="card" style="margin-top: 16px;">
      <div class="card-header" onclick="toggleChart('lostDaysAnalysis')">
        <div>
          <h2>Lost Work Days Analysis & Voxel Impact</h2>
          <span class="pill">
            <span class="key">Projection</span>
            <span>Based on Step 2 assumptions</span>
          </span>
        </div>
        <span class="collapse-toggle" id="toggle-lostDaysAnalysis">\u2212</span>
      </div>
      <div class="chart-content" id="content-lostDaysAnalysis">
        <div id="lostDaysStatus" class="status" style="margin-bottom: 8px;"></div>
      <div class="row">
        <div class="col">
          <div class="chart-container" style="height: 350px;">
            <canvas id="lostDaysByCategoryChart"></canvas>
          </div>
        </div>
        <div class="col">
          <div class="chart-container" style="height: 350px;">
            <canvas id="lostDaysProjectionChart"></canvas>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top: 16px;">
        <div class="col">
          <div class="chart-container" style="height: 300px;">
            <canvas id="lostDaysTrendChart"></canvas>
          </div>
        </div>
        <div class="col">
          <div class="kpi" style="margin-top: 0;">
            <div class="tile">
              <h3>Current Avg Lost Days/Claim</h3>
              <div class="v" id="avgLostDaysCurrent">\u2014</div>
            </div>
            <div class="tile">
              <h3>Projected Avg Lost Days/Claim</h3>
              <div class="v" id="avgLostDaysProjected">\u2014</div>
            </div>
            <div class="tile">
              <h3>Total Lost Days (Current)</h3>
              <div class="v" id="totalLostDaysCurrent">\u2014</div>
            </div>
            <div class="tile">
              <h3>Total Lost Days (Projected)</h3>
              <div class="v" id="totalLostDaysProjected">\u2014</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</div>

<script>
  // --- Utility formatters ---
  const fmtMoney = (v) => {
    if (isNaN(v) || !isFinite(v)) return '\u2014';
    return '$' + Math.round(v).toLocaleString();
  };
  const fmtInt = (v) => (isFinite(v) ? String(Math.round(v)) : '\u2014');
  const fmtNum = (v, d = 2) =>
    isFinite(v) ? Number(v).toFixed(d) : '\u2014';

  const el = id => document.getElementById(id);

  // --- Chart collapse/expand functionality ---
  function toggleChart(chartId) {
    const content = el(\`content-\${chartId}\`);
    const toggle = el(\`toggle-\${chartId}\`);
    
    if (!content || !toggle) return;
    
    if (content.classList.contains('collapsed')) {
      content.classList.remove('collapsed');
      toggle.textContent = '\u2212';
    } else {
      content.classList.add('collapsed');
      toggle.textContent = '+';
    }
  }

  // --- Global state ---
  let workbook = null;
  let currentSheetName = null;
  let headerRow = [];
  let mappings = {};
  let canonicalData = [];
  let chartInstances = {};

  // Set Chart.js defaults for light theme
  if (window.Chart) {
    Chart.defaults.color = '#0f172a';
    Chart.defaults.borderColor = '#e2e8f0';
  }

  // --- Navigation ---
  function showPage(pageNum) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    el(\`page\${pageNum}\`).classList.add('active');
    el(\`navPage\${pageNum}\`).classList.add('active');

    if (pageNum === 3 && canonicalData.length) {
      calculateAndShowResults();
    }
  }

  // --- Enhanced auto-mapping utilities ---
  function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[_\\-\\s]+/g, ' ') // Replace underscores, hyphens, multiple spaces with single space
      .replace(/[^\\w\\s]/g, '') // Remove special characters except word chars and spaces
      .trim();
  }

  function calculateMatchScore(header, hints, fieldType) {
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
      else if (normalizedHeader.startsWith(normalizedHint + ' ') || normalizedHeader.startsWith(normalizedHint)) {
        score = 90;
      }
      // Ends with hint (high score)
      else if (normalizedHeader.endsWith(' ' + normalizedHint) || normalizedHeader.endsWith(normalizedHint)) {
        score = 85;
      }
      // Contains hint as whole word (medium-high score)
      else if (new RegExp(\`\\\\b\${normalizedHint}\\\\b\`).test(normalizedHeader)) {
        score = 80;
      }
      // Contains hint anywhere (medium score)
      else if (normalizedHeader.includes(normalizedHint)) {
        score = 60;
      }
      // Fuzzy match - check if all words in hint are present
      else {
        const hintWords = normalizedHint.split(/\\s+/).filter(w => w.length > 2);
        const headerWords = normalizedHeader.split(/\\s+/);
        const matchingWords = hintWords.filter(hw => 
          headerWords.some(hdw => hdw.includes(hw) || hw.includes(hdw))
        );
        if (matchingWords.length === hintWords.length && hintWords.length > 0) {
          score = 50 + (matchingWords.length * 5);
        }
      }
      
      // Bonus for field type specific patterns
      if (fieldType === 'date') {
        if (/\\b(date|dt|dte|day|time)\\b/i.test(header) && 
            /\\b(loss|injury|incident|occur|accident|claim)\\b/i.test(header)) {
          score += 10;
        }
      } else if (fieldType === 'number') {
        if (/\\b(total|sum|amount|cost|paid|incurred|reserve|value|amt)\\b/i.test(header)) {
          score += 10;
        }
      } else if (fieldType === 'text') {
        if (/\\b(site|location|facility|store|city|place|address)\\b/i.test(header)) {
          score += 10;
        }
      }
      
      bestScore = Math.max(bestScore, score);
    }
    
    return bestScore;
  }

  function detectColumnType(sampleValues) {
    if (!sampleValues || sampleValues.length === 0) return 'unknown';
    
    let dateCount = 0;
    let numberCount = 0;
    let textCount = 0;
    const datePatterns = [
      /^\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}$/, // MM/DD/YYYY or similar
      /^\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}$/, // YYYY-MM-DD
      /^\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}$/, // MM/DD/YYYY
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\\s,]\\d{1,2},?\\s\\d{4}$/i, // Month DD, YYYY
      /^\\d{1,2}[\\s\\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\\s\\-]\\d{2,4}$/i // DD Month YYYY
    ];
    
    sampleValues.slice(0, 10).forEach(val => { // Check first 10 values
      if (val === null || val === undefined || val === '') return;
      
      const str = String(val).trim();
      if (str.length < 3) {
        textCount++;
        return;
      }
      
      // Check if it's a date - try multiple methods
      let isDate = false;
      
      // Check date patterns
      if (datePatterns.some(pattern => pattern.test(str))) {
        isDate = true;
      }
      // Check if Date constructor can parse it
      else {
        const dateTest = new Date(str);
        if (!isNaN(dateTest.getTime()) && str.length > 5) {
          // Additional validation: check if it's a reasonable date (not just a number)
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
      else if (/^[\\$,\\d\\s\\.\\-\\(\\)]+$/.test(str.replace(/[,\\$\\(\\)]/g, '')) && 
               !isNaN(parseFloat(str.replace(/[,\\$\\(\\)]/g, ''))) &&
               str.replace(/[,\\$\\(\\)\\s]/g, '').length > 0) {
        numberCount++;
      }
      else {
        textCount++;
      }
    });
    
    if (dateCount > numberCount && dateCount > textCount && dateCount >= 2) return 'date';
    if (numberCount > textCount && numberCount >= 2) return 'number';
    return 'text';
  }

  function findBestMatch(headerRow, hints, fieldType, sampleData = null) {
    let bestMatch = null;
    let bestScore = 0;
    
    headerRow.forEach((header, idx) => {
      if (!header || header.trim() === '') return;
      
      let score = calculateMatchScore(header, hints, fieldType);
      
      // Bonus if detected column type matches expected field type
      if (sampleData && sampleData[idx]) {
        const detectedType = detectColumnType(sampleData[idx]);
        if (detectedType === fieldType) {
          score += 15; // Significant bonus for type match
        } else if ((fieldType === 'number' && detectedType === 'number') ||
                   (fieldType === 'date' && detectedType === 'date')) {
          score += 15;
        }
      }
      
      if (score > bestScore && score >= 50) { // Minimum threshold
        bestScore = score;
        bestMatch = header;
      }
    });
    
    return bestMatch;
  }

  // --- Canonical schema configuration ---
  const requiredFields = {
    site_name: {
      label: 'Site / Location',
      description: 'City or location name used to filter claims.',
      required: true,
      hints: ['site', 'location', 'facility', 'store', 'city', 'place', 'address', 'branch', 'plant', 'warehouse'],
      fieldType: 'text'
    },
    date_of_loss: {
      label: 'Date of Loss',
      description: 'Date the injury/claim occurred.',
      required: true,
      hints: ['date of loss', 'loss date', 'date of injury', 'doi', 'date loss', 'incident date', 'accident date', 'occurrence date', 'claim date', 'injury date'],
      fieldType: 'date'
    },
    total_incurred: {
      label: 'Total Incurred',
      description: 'Total incurred cost (paid + reserves).',
      required: true,
      hints: ['total incurred', 'net incurred', 'all gross incurred', 'incurred', 'total incur', 'incurred total', 'total loss', 'loss amount', 'claim amount', 'total cost', 'total paid incurred'],
      fieldType: 'number'
    }
  };

  const optionalFields = {
    claim_number: {
      label: 'Claim Number',
      description: 'Unique claim identifier.',
      hints: ['claim number', 'claim #', 'cnr', 'claim num', 'claim id', 'claim no', 'claim#', 'case number', 'case #', 'file number'],
      fieldType: 'text'
    },
    claim_category: {
      label: 'Claim Category (MO vs Indemnity)',
      description: 'Medical-only vs indemnity / lost-time classification.',
      hints: ['claim type', 'derived claim type', 'coverage line', 'category', 'type', 'classification', 'claim category', 'mo indemnity', 'medical only'],
      fieldType: 'text'
    },
    body_part: {
      label: 'Body Part',
      description: 'Primary body part injured.',
      hints: ['body part', 'part of body', 'bodypart', 'part body', 'injury part', 'affected part', 'anatomy'],
      fieldType: 'text'
    },
    lost_days: {
      label: 'Lost Work Days',
      description: 'Number of days lost due to the claim.',
      hints: ['lost days', 'days lost', 'disability days', 'lost time days', 'lt days', 'days disability', 'work days lost', 'days off', 'lost work', 'time loss days'],
      fieldType: 'number'
    },
    cause_of_loss: {
      label: 'Loss Category / Cause Bucket',
      description: 'Categorical classification of the loss (e.g., Slip/Trip, Overexertion, Struck By).',
      hints: ['loss category', 'cause bucket', 'loss bucket', 'category', 'cause category', 'loss type', 'accident category', 'incident category', 'injury category', 'loss classification', 'cause classification', 'loss code', 'cause code'],
      fieldType: 'text'
    },
    loss_description: {
      label: 'Loss Description',
      description: 'Text description of the incident (used for AI categorization).',
      hints: ['description', 'loss description', 'accident description', 'incident description', 'notes', 'comments', 'narrative', 'details', 'injury description', 'cause description'],
      fieldType: 'text'
    }
  };

  // --- File upload handling ---
  el('fileInput').addEventListener('change', handleFileSelect);
  el('sheetSelect').addEventListener('change', handleSheetSelect);
  el('applyMappingBtn').addEventListener('click', applyMappingAndLoad);

  // Existing Customer Toggle Logic
  const existingCustomerToggle = el('existingCustomerToggle');
  const customerDateRow = el('customerDateRow');
  const voxelStartYear = el('voxelStartYear');
  
  // Populate years (current year - 10 to current year)
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 10; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    voxelStartYear.appendChild(opt);
  }

  existingCustomerToggle.addEventListener('change', () => {
    customerDateRow.style.display = existingCustomerToggle.checked ? 'block' : 'none';
    if (document.getElementById('page3') && document.getElementById('page3').classList.contains('active')) {
      calculateAndShowResults();
    }
  });
  
  [el('voxelStartMonth'), el('voxelStartYear')].forEach(e => {
    e.addEventListener('change', () => {
      if (document.getElementById('page3') && document.getElementById('page3').classList.contains('active')) {
        calculateAndShowResults();
      }
    });
  });

  // Setup event listeners for adjustments page
  const adjustmentInputs = ['obsSpeedImprovement', 'wcReduction', 'lostTimeReduction', 'retentionImprovement', 
   'miscCostReduction', 'avgCost', 'injuries', 'miscDirect', 'miscIndirect', 'indirectMult',
   'monthsObserved', 'annualizeRound', 'supCount', 'shifts', 
   'rate', 'minObsManual', 'obsPerShift', 'workdays',
   'headcount', 'trainingHours', 'totalAnnualObs'];
  
  adjustmentInputs.forEach(id => {
    const elem = el(id);
    if (elem) {
      elem.addEventListener('input', () => {
        if (document.getElementById('page3') && document.getElementById('page3').classList.contains('active')) {
          calculateAndShowResults();
        }
      });
    }
  });

  // Checkbox handlers
  const isYTDCheckbox = el('isYTD');
  if (isYTDCheckbox) {
    isYTDCheckbox.addEventListener('change', () => {
      el('ytdRow').style.display = isYTDCheckbox.checked ? '' : 'none';
          if (document.getElementById('page3') && document.getElementById('page3').classList.contains('active')) {
            calculateAndShowResults();
          }
        });
      }

  const includeObsCheckbox = el('includeObs');
  if (includeObsCheckbox) {
    includeObsCheckbox.addEventListener('change', () => {
      if (document.getElementById('page3') && document.getElementById('page3').classList.contains('active')) {
        calculateAndShowResults();
      }
    });
  }

  function handleFileSelect(evt) {
    const file = evt.target.files[0];
    workbook = null;
    currentSheetName = null;
    headerRow = [];
    canonicalData = [];
    mappings = {};
    clearSheetSelect();
    clearMappingUI();
    resetNavigation();

    if (!file) {
      el('uploadStatus').textContent = 'No file selected.';
      el('uploadStatus').className = 'status';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        workbook = XLSX.read(data, { type: 'array' });

        const sheetNames = workbook.SheetNames || [];
        if (!sheetNames.length) {
          throw new Error('No sheets found in workbook.');
        }

        const sheetSel = el('sheetSelect');
        sheetSel.innerHTML = '';
        sheetSel.disabled = false;
        sheetNames.forEach((name, idx) => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          if (idx === 0) opt.selected = true;
          sheetSel.appendChild(opt);
        });
        currentSheetName = sheetNames[0];
        el('uploadStatus').textContent = \`Loaded workbook with \${sheetNames.length} sheet(s). Select a sheet and map fields.\`;
        el('uploadStatus').className = 'status ok';

        handleSheetSelect();
      } catch (err) {
        console.error(err);
        el('uploadStatus').textContent = 'Error reading file: ' + err.message;
        el('uploadStatus').className = 'status error';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function clearSheetSelect() {
    const sheetSel = el('sheetSelect');
    sheetSel.innerHTML = '<option value="">Select a file first\u2026</option>';
    sheetSel.disabled = true;
  }

  function clearMappingUI() {
    el('mappingContainer').innerHTML = '<div class="status">Select a sheet to see available columns.</div>';
    el('applyMappingBtn').disabled = true;
    el('mappingStatus').textContent = '';
    el('mappingStatus').className = 'status';
  }

  function resetNavigation() {
    el('navPage2').disabled = true;
    el('navPage3').disabled = true;
  }

  function findHeaderRow(rows) {
    if (!rows || rows.length === 0) return { rowIndex: -1, headerRow: [] };

    // Scan up to first 20 rows to find the header
    const maxScanRows = Math.min(20, rows.length);
    let bestRowIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < maxScanRows; i++) {
      const row = rows[i] || [];
      const nonEmptyCells = row.filter(cell => {
        const str = String(cell || '').trim();
        return str.length > 0;
      }).length;

      // Score based on:
      // 1. Number of non-empty cells (more is better)
      // 2. Presence of text (not just numbers)
      // 3. Reasonable number of columns (at least 3, but not too many)
      let score = 0;
      
      if (nonEmptyCells >= 3) {
        score = nonEmptyCells;
        
        // Bonus for rows that look like headers (contain text, not just numbers)
        const textCells = row.filter(cell => {
          const str = String(cell || '').trim();
          if (str.length === 0) return false;
          // Check if it's mostly text (not a number or date)
          const isNumber = /^[\\$,\\d\\s\\.\\-\\(\\)]+$/.test(str.replace(/[,\\$\\(\\)\\s]/g, '')) && 
                         !isNaN(parseFloat(str.replace(/[,\\$\\(\\)]/g, '')));
          const isDate = !isNaN(new Date(str).getTime()) && str.length > 5;
          return !isNumber && !isDate;
        }).length;
        
        // If at least half the cells are text-like, it's likely a header
        if (textCells >= Math.ceil(nonEmptyCells / 2)) {
          score += 5;
        }
        
        // Penalty if too many columns (likely not a header)
        if (nonEmptyCells > 50) {
          score -= 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestRowIndex = i;
      }
    }

    if (bestRowIndex >= 0 && bestScore >= 3) {
      const headerRow = (rows[bestRowIndex] || []).map((v) => String(v || '').trim());
      return { rowIndex: bestRowIndex, headerRow };
    }

    // Fallback: use first row if nothing better found
    const headerRow = (rows[0] || []).map((v) => String(v || '').trim());
    return { rowIndex: 0, headerRow };
  }

  let headerRowIndex = 0; // Store the detected header row index

  function handleSheetSelect() {
    if (!workbook) return;
    const sheetName = el('sheetSelect').value;
    if (!sheetName) {
      clearMappingUI();
      return;
    }
    currentSheetName = sheetName;

    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    if (!rows.length) {
      el('mappingContainer').innerHTML = '<div class="status error">Sheet appears to be empty.</div>';
      el('applyMappingBtn').disabled = true;
      return;
    }

    // Dynamically find the header row
    const headerResult = findHeaderRow(rows);
    headerRowIndex = headerResult.rowIndex;
    headerRow = headerResult.headerRow;

    if (!headerRow.length || headerRowIndex < 0) {
      el('mappingContainer').innerHTML = '<div class="status error">Could not detect header row.</div>';
      el('applyMappingBtn').disabled = true;
      return;
    }

    // Show which row was detected as header (if not row 1)
    if (headerRowIndex > 0) {
      el('uploadStatus').textContent += \` Header row detected at row \${headerRowIndex + 1} (skipped \${headerRowIndex} blank row(s) at top).\`;
    }

    // Extract sample data for each column (first 10 data rows, skipping header)
    const sampleData = [];
    const numColumns = headerRow.length;
    for (let colIdx = 0; colIdx < numColumns; colIdx++) {
      sampleData[colIdx] = [];
      // Start from row after header row
      const startRow = headerRowIndex + 1;
      for (let rowIdx = startRow; rowIdx < Math.min(rows.length, startRow + 10); rowIdx++) {
        const cellValue = rows[rowIdx] && rows[rowIdx][colIdx] !== undefined 
          ? rows[rowIdx][colIdx] 
          : null;
        sampleData[colIdx].push(cellValue);
      }
    }

    // Build mapping UI
    const container = document.createElement('div');
    const tbl = document.createElement('table');
    tbl.className = 'mapping-table';
    const thead = document.createElement('thead');
    thead.innerHTML = \`
      <tr>
        <th style="width:35%;">Tool field</th>
        <th style="width:40%;">Column from sheet</th>
        <th style="width:25%;">Notes</th>
      </tr>
    \`;
    tbl.appendChild(thead);
    const tbody = document.createElement('tbody');

    const allFields = { ...requiredFields, ...optionalFields };

    Object.keys(allFields).forEach((key) => {
      const meta = allFields[key];
      const tr = document.createElement('tr');

      const labelTd = document.createElement('td');
      labelTd.innerHTML =
        \`<strong>\${meta.label}</strong>\` +
        (meta.required ? '<span class="mapping-required">required</span>' : '');
      tr.appendChild(labelTd);

      const selectTd = document.createElement('td');
      const select = document.createElement('select');
      select.dataset.fieldKey = key;
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = meta.required ? '\u2014 Select column \u2014' : 'Not mapped';
      select.appendChild(noneOpt);
      headerRow.forEach((h) => {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h || '(blank)';
        select.appendChild(opt);
      });
      // Attempt auto-mapping using enhanced matching with sample data
      const best = findBestMatch(headerRow, meta.hints || [], meta.fieldType || 'text', sampleData);
      if (best) {
        select.value = best;
      }
      selectTd.appendChild(select);
      tr.appendChild(selectTd);

      const notesTd = document.createElement('td');
      notesTd.textContent = meta.description;
      tr.appendChild(notesTd);

      tbody.appendChild(tr);
    });

    tbl.appendChild(tbody);
    container.appendChild(tbl);
    el('mappingContainer').innerHTML = '';
    el('mappingContainer').appendChild(container);

    el('applyMappingBtn').disabled = false;
    el('mappingStatus').textContent = 'Review mappings, then click "Apply".';
    el('mappingStatus').className = 'status';
  }

  function applyMappingAndLoad() {
    if (!workbook || !currentSheetName || !headerRow.length) {
      el('mappingStatus').textContent = 'No sheet/header information available.';
      el('mappingStatus').className = 'status error';
      return;
    }

    const selectorEls = el('mappingContainer').querySelectorAll('select[data-field-key]');
    const newMappings = {};
    selectorEls.forEach((sel) => {
      const key = sel.dataset.fieldKey;
      const val = sel.value;
      if (val) newMappings[key] = val;
    });

    // Validate required fields
    const missingRequired = Object.keys(requiredFields).filter(
      (key) => !newMappings[key]
    );
    if (missingRequired.length) {
      el('mappingStatus').textContent =
        'Missing required mappings for: ' +
        missingRequired.map((k) => requiredFields[k].label).join(', ');
      el('mappingStatus').className = 'status error';
      canonicalData = [];
      return;
    }

    mappings = newMappings;
    el('mappingStatus').textContent = 'Mappings applied. Parsing rows\u2026';
    el('mappingStatus').className = 'status';

    // Parse sheet into JSON with header row
    const ws = workbook.Sheets[currentSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, {
      header: headerRow,
      range: headerRowIndex + 1, // Start from row after detected header
      raw: false,
      defval: null
    });

    const out = [];
    rawRows.forEach((row) => {
      const canon = {};

      // Required fields
      canon.site_name = (row[mappings.site_name] || '').toString().trim();
      const rawDate = row[mappings.date_of_loss];
      let parsedDate = null;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) parsedDate = d;
      }
      let incurred = row[mappings.total_incurred];
      let incurredNum = parseFloat(
        (typeof incurred === 'string' ? incurred.replace(/[$,]/g, '') : incurred) || 0
      );
      if (!isFinite(incurredNum)) incurredNum = 0;

      if (!canon.site_name || !parsedDate || !isFinite(incurredNum) || incurredNum <= 0) {
        return;
      }
      canon.date_of_loss = parsedDate;
      canon.total_incurred = incurredNum;

      // Optional fields
      if (mappings.claim_number) {
        canon.claim_number = (row[mappings.claim_number] || '').toString().trim();
      }
      if (mappings.claim_category) {
        canon.claim_category = (row[mappings.claim_category] || '').toString().trim();
      }
      if (mappings.body_part) {
        canon.body_part = (row[mappings.body_part] || '').toString().trim();
      }
      if (mappings.lost_days) {
        let ld = row[mappings.lost_days];
        let ldNum = parseFloat(
          (typeof ld === 'string' ? ld.replace(/,/g, '') : ld) || 0
        );
        canon.lost_days = isFinite(ldNum) && ldNum > 0 ? ldNum : 0;
      }
      if (mappings.cause_of_loss) {
        canon.cause_of_loss = (row[mappings.cause_of_loss] || '').toString().trim();
      }
      if (mappings.loss_description) {
        canon.loss_description = (row[mappings.loss_description] || '').toString().trim();
      }
      out.push(canon);
    });

    canonicalData = out;
    if (!canonicalData.length) {
      el('mappingStatus').textContent =
        'No valid rows after parsing. Check that date and incurred values are valid.';
      el('mappingStatus').className = 'status error';
      return;
    }

    el('mappingStatus').textContent =
      \`Parsed \${canonicalData.length} valid row(s). Proceed to adjustments.\`;
    el('mappingStatus').className = 'status ok';


    // Populate site filter first
    populateSiteFilter();
    
    // Auto-populate page 2 with calculated values (will use filtered data if site selected)
    populateAdjustmentsFromData();
    
    // Enable navigation
    el('navPage2').disabled = false;
  }

  function populateSiteFilter() {
    if (!canonicalData.length) return;
    
    const siteSet = new Set();
    canonicalData.forEach(row => {
      if (row.site_name) siteSet.add(row.site_name);
    });
    
    const sortedSites = Array.from(siteSet).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    const siteSelect = el('siteFilterSelect');
    siteSelect.innerHTML = '<option value="">All Sites</option>';
    sortedSites.forEach(site => {
      const opt = document.createElement('option');
      opt.value = site;
      opt.textContent = site;
      siteSelect.appendChild(opt);
    });
    
    // Show the site filter row
    el('siteFilterRow').style.display = '';
    
    // Add event listener if not already added
    if (!siteSelect.hasAttribute('data-listener-added')) {
      siteSelect.setAttribute('data-listener-added', 'true');
      siteSelect.addEventListener('change', () => {
        const selectedSite = siteSelect.value;
        if (selectedSite) {
          el('siteFilterStatus').textContent = \`Filtering analysis for: \${selectedSite}\`;
          el('siteFilterStatus').className = 'status';
        } else {
          el('siteFilterStatus').textContent = 'Analyzing all sites';
          el('siteFilterStatus').className = 'status';
        }
        // Recalculate adjustments based on filtered data
        populateAdjustmentsFromData();
        // Recalculate if on results page
        if (document.getElementById('page3') && document.getElementById('page3').classList.contains('active')) {
          calculateAndShowResults();
        }
      });
    }
  }

  function getFilteredData() {
    const selectedSite = el('siteFilterSelect').value;
    if (!selectedSite) return canonicalData;
    return canonicalData.filter(row => row.site_name === selectedSite);
  }

  function populateAdjustmentsFromData() {
    if (!canonicalData.length) return;

    // Use filtered data if site is selected
    const dataToUse = getFilteredData();

    // Calculate annual metrics instead of aggregating all years
    const yearlyData = {};
    dataToUse.forEach(row => {
      if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
      const year = row.date_of_loss.getFullYear();
      if (!yearlyData[year]) {
        yearlyData[year] = { totalIncurred: 0, claimCount: 0 };
      }
      yearlyData[year].totalIncurred += row.total_incurred || 0;
      yearlyData[year].claimCount += 1;
    });

    const years = Object.keys(yearlyData).map(y => parseInt(y)).sort((a, b) => b - a);
    
    if (years.length === 0) {
      // Fallback to aggregate if no valid dates
    const totalIncurred = canonicalData.reduce((acc, r) => acc + (r.total_incurred || 0), 0);
    const claimCount = canonicalData.length;
    const avgCost = totalIncurred / Math.max(claimCount, 1);
    el('avgCost').value = Math.round(avgCost);
    el('injuries').value = claimCount;
      return;
    }

    // Use most recent year as baseline, or average of last 2-3 years if available
    let baselineYear = years[0];
    let avgCostPerYear = 0;
    let avgInjuriesPerYear = 0;
    
    if (years.length >= 3) {
      // Average of last 3 years
      const recentYears = years.slice(0, 3);
      let totalCost = 0;
      let totalClaims = 0;
      recentYears.forEach(y => {
        totalCost += yearlyData[y].totalIncurred;
        totalClaims += yearlyData[y].claimCount;
      });
      avgCostPerYear = totalCost / Math.max(totalClaims, 1);
      avgInjuriesPerYear = totalClaims / recentYears.length;
      baselineYear = recentYears[0];
    } else if (years.length >= 2) {
      // Average of last 2 years
      const recentYears = years.slice(0, 2);
      let totalCost = 0;
      let totalClaims = 0;
      recentYears.forEach(y => {
        totalCost += yearlyData[y].totalIncurred;
        totalClaims += yearlyData[y].claimCount;
      });
      avgCostPerYear = totalCost / Math.max(totalClaims, 1);
      avgInjuriesPerYear = totalClaims / recentYears.length;
      baselineYear = recentYears[0];
    } else {
      // Use single year
      const yearData = yearlyData[baselineYear];
      avgCostPerYear = yearData.totalIncurred / Math.max(yearData.claimCount, 1);
      avgInjuriesPerYear = yearData.claimCount;
    }

    el('avgCost').value = Math.round(avgCostPerYear);
    el('injuries').value = Math.round(avgInjuriesPerYear);
  }

  function annualizeInjuries(rawInjuries) {
    const isYTD = el('isYTD').checked;
    if (!isYTD) return { used: Math.max(0, rawInjuries), detail: 'Full-year value used (12 months)' };

    let months = parseFloat(el('monthsObserved').value) || 0;
    months = Math.min(12, Math.max(1, months));
    const factor = 12 / months;
    const raw = (Math.max(0, rawInjuries) * factor);
    const rounding = el('annualizeRound').value;
    let used;
    if (rounding === 'ceil') used = Math.ceil(raw);
    else if (rounding === 'floor') used = Math.floor(raw);
    else used = Math.round(raw);

    return { used, detail: \`YTD annualized: injuries \xD7 (12 \xF7 \${months}) = \${raw.toFixed(2)} \u2192 \${used}\` };
  }

  function calculateAndNavigateToResults() {
    if (!canonicalData.length) {
      alert('Please load data first on page 1.');
      showPage(1);
      return;
    }
    el('navPage3').disabled = false;
    showPage(3);
  }

  function calculateAndShowResults() {
    if (!canonicalData.length) return;

    // --- Inputs ---
    const filteredData = getFilteredData();
    const isCustomer = el('existingCustomerToggle').checked;
    
    // Financial Inputs
    const avgCost = parseFloat(el('avgCost').value) || 0;
    const miscDirect = parseFloat(el('miscDirect').value) || 0;
    const miscIndirect = parseFloat(el('miscIndirect').value) || 0;
    
    // Improvement Inputs
    const wcReduction = Math.max(0, Math.min(100, parseFloat(el('wcReduction').value) || 0)) / 100;
    const miscCostReduction = Math.max(0, Math.min(100, parseFloat(el('miscCostReduction').value) || 0)) / 100;
    const lostTimeReduction = Math.max(0, Math.min(100, parseFloat(el('lostTimeReduction').value) || 0)) / 100;
    const retentionImprovement = Math.max(0, Math.min(100, parseFloat(el('retentionImprovement').value) || 0)) / 100;
    
    // Org Inputs
    const sup = parseFloat(el('supCount').value) || 0;
    const shifts = parseFloat(el('shifts').value) || 0;
    const headcount = parseFloat(el('headcount').value) || 100;
    const rate = parseFloat(el('rate').value) || 0;
    const workdays = parseFloat(el('workdays').value) || 0;
    const trainingHours = parseFloat(el('trainingHours').value) || 0;
    
    // Observation Inputs
    const includeObs = el('includeObs').checked;
    const minManual = Math.max(0, parseFloat(el('minObsManual').value) || 0);
    const obsPerShiftManual = Math.max(0, parseFloat(el('obsPerShift').value) || 0);
    const obsSpeedImprovement = Math.max(1, parseFloat(el('obsSpeedImprovement').value) || 1);
    
    // Annualize injuries
    const injuriesInput = parseFloat(el('injuries').value) || 0;
    const ann = annualizeInjuries(injuriesInput);
    const injuriesCurrent = ann.used;

    // --- Calculations ---
    
    // 1. Injuries & TRIR
    let injuriesManual, injuriesImproved;
    if (isCustomer) {
        injuriesImproved = injuriesCurrent; // Actual
        injuriesManual = Math.round(injuriesCurrent / Math.max(0.01, 1 - wcReduction)); // Baseline
    } else {
        injuriesManual = injuriesCurrent; // Current
        injuriesImproved = Math.max(0, Math.round(injuriesManual * (1 - wcReduction))); // Projected
    }
    
    const trirManual = (injuriesManual * 200000) / (headcount * 2000);
    const trirImproved = (injuriesImproved * 200000) / (headcount * 2000);

    // 2. Direct & Indirect Costs
    let directManual, directImproved, indirectManual, indirectImproved;
    const mult = Math.max(0, parseFloat(el('indirectMult').value) || 0);
    const indirectImprovementFactor = 1 - (lostTimeReduction * 0.6 + retentionImprovement * 0.4);

    if (isCustomer) {
        directImproved = avgCost * injuriesImproved + miscDirect;
        const miscDirectHypothetical = miscDirect / Math.max(0.01, 1 - miscCostReduction);
        directManual = avgCost * injuriesManual + miscDirectHypothetical;
        
        indirectImproved = directImproved * mult * indirectImprovementFactor + miscIndirect;
        const miscIndirectHypothetical = miscIndirect / Math.max(0.01, 1 - miscCostReduction);
        indirectManual = directManual * mult + miscIndirectHypothetical;
    } else {
        directManual = avgCost * injuriesManual + miscDirect;
        directImproved = avgCost * injuriesImproved + miscDirect * (1 - miscCostReduction);
        
        indirectManual = directManual * mult + miscIndirect;
        indirectImproved = directImproved * mult * indirectImprovementFactor + miscIndirect * (1 - miscCostReduction);
    }

    // 3. Observation Cost Decomposition
    // Component A: Labor (Observation Time)
    // Component B: Reporting (Assume 20% of Manual Time, reduced by half with Voxel?)
    // Let's assume Reporting is separate. Manual = 10 mins/obs. Voxel = 2 mins/obs.
    // Component C: Training
    
    const minutesToHours = m => m / 60;
    // Cap improvement at 5 mins/obs max (minimum time per obs cannot go below 5 mins or defined min)
    // Actually request is "max improvement to 5 minutes per observation" - likely means the Resulting time is 5 mins?
    // "max improvement to 5 minutes per observation" usually implies the floor is 5 mins.
    
    // Logic: New Time = Manual Time / Improvement Factor.
    // Constraint: New Time >= 5 minutes.
    
    let rawImprovedTime = minManual / obsSpeedImprovement;
    const minImproved = Math.max(5, rawImprovedTime); 
    
    // Use Total Annual Observations input directly
    const totalAnnualObs = parseFloat(el('totalAnnualObs').value) || 0;

    // Current / Manual State
    const obsTimeAnnualManual = totalAnnualObs * minutesToHours(minManual);
    const costObsLaborManual = obsTimeAnnualManual * rate;
    
    const reportingTimeAnnualManual = totalAnnualObs * minutesToHours(10); // 10 mins reporting
    const costObsReportingManual = reportingTimeAnnualManual * rate;
    
    // Improved / Voxel State
    const obsTimeAnnualImproved = totalAnnualObs * minutesToHours(minImproved);
    const costObsLaborImproved = obsTimeAnnualImproved * rate;
    
    const reportingTimeAnnualImproved = totalAnnualObs * minutesToHours(2); // 2 mins reporting
    const costObsReportingImproved = reportingTimeAnnualImproved * rate;
    
    // Training (Constant?)
    const costTraining = headcount * trainingHours * rate;
    
    const obsTotalManual = costObsLaborManual + costObsReportingManual + costTraining;
    const obsTotalImproved = costObsLaborImproved + costObsReportingImproved + costTraining;
    
    // 4. Totals
    const baseManual = directManual + indirectManual;
    const baseImproved = directImproved + indirectImproved;
    
    // Using simple "Observation Cost" for the main KPI tiles (Labor + Reporting + Training if checked)
    const costManual = obsTotalManual;
    const costImproved = obsTotalImproved;
    
    const totalManual = includeObs ? baseManual + costManual : baseManual;
    const totalImproved = includeObs ? baseImproved + costImproved : baseImproved;
    
    // 5. Savings & Payback (Sigmoid)
    const annualSavingsMax = totalManual - totalImproved;
    const monthlySavingsMax = annualSavingsMax / 12;
    
    // Payback Calculation (Monthly)
    const paybackData = {
        months: [],
        cumulativeSavings: [],
        cumulativeCost: [],
        netCashFlow: [],
        paybackMonth: -1
    };
    
    let cumSavings = 0;
    let cumCost = 0;
    
    for (let m = 1; m <= 24; m++) {
        // Sigmoid Ramp-up for savings: S(t) = Max / (1 + e^-k(t-t0))
        // k=0.8, t0=3
        const rampFactor = 1 / (1 + Math.exp(-0.8 * (m - 3)));
        const monthlySavings = monthlySavingsMax * rampFactor;
        
        cumSavings += monthlySavings;
        const net = cumSavings - cumCost;
        
        paybackData.months.push(m);
        paybackData.cumulativeSavings.push(cumSavings);
        paybackData.cumulativeCost.push(cumCost);
        paybackData.netCashFlow.push(net);
        
        if (net >= 0 && paybackData.paybackMonth === -1) {
            paybackData.paybackMonth = m;
        }
    }
    
    // Year 1 Realized Savings (Sum of first 12 months)
    const year1Savings = paybackData.cumulativeSavings[11]; // Index 11 is Month 12
    const totalImprovedYear1 = totalManual - year1Savings; // Adjusted for ramp-up

    // --- Update UI ---
    
    // Update KPI Tiles
    el('directCostManual').textContent = fmtMoney(directManual);
    el('directCostImproved').textContent = fmtMoney(directImproved);
    el('indirectCostManual').textContent = fmtMoney(indirectManual);
    el('indirectCostImproved').textContent = fmtMoney(indirectImproved);
    el('obsManual').textContent = includeObs ? fmtMoney(costManual) : '\u2014';
    el('obsImproved').textContent = includeObs ? fmtMoney(costImproved) : '\u2014';
    el('totalManual').textContent = fmtMoney(totalManual);
    el('totalImproved').textContent = fmtMoney(totalImproved);
    el('deltaBlock').textContent = fmtMoney(annualSavingsMax);
    
    updateResultLabels(isCustomer);
    
    // Voxel Start Date
    const startMonth = parseInt(el('voxelStartMonth').value);
    const startYear = parseInt(el('voxelStartYear').value);
    const voxelStartDate = isCustomer ? new Date(startYear, startMonth, 1) : null;

    // Draw Charts
    drawCharts(filteredData, {
      directManual, directImproved,
      indirectManual, indirectImproved,
      costManual: includeObs ? costManual : 0,
      costImproved: includeObs ? costImproved : 0,
      totalManual, totalImproved,
      totalImprovedYear1, // Sigmoid adjusted for Year 1
      injuriesManual, injuriesImproved,
      trirManual, trirImproved,
      costObsLaborManual, costObsReportingManual, costTraining,
      costObsLaborImproved, costObsReportingImproved,
      paybackData,
      wcReduction, isCustomer, voxelStartDate
    });
  }

  function updateResultLabels(isCustomer) {
    const manualLabel = isCustomer ? 'Projected (No Voxel)' : 'Current (No Voxel)';
    const improvedLabel = isCustomer ? 'Actual (With Voxel)' : 'Projected (With Voxel)';
    const savingsLabel = isCustomer ? 'Estimated Savings' : 'Potential Savings';

    // Update Tile Headers
    const tiles = document.querySelectorAll('.kpi .tile h3');
    tiles.forEach(h3 => {
      if (h3.textContent.includes('Current')) h3.textContent = h3.textContent.replace('Current', isCustomer ? 'No Voxel' : 'Current');
      if (h3.textContent.includes('Improved')) h3.textContent = h3.textContent.replace('Improved', isCustomer ? 'With Voxel' : 'Improved');
      if (h3.textContent.includes('Savings')) h3.textContent = savingsLabel;
    });
  }

  function drawCharts(data, calculations) {
    // Destroy existing charts
    Object.values(chartInstances).forEach(chart => {
      if (chart) chart.destroy();
    });
    chartInstances = {};

    // Indemnity Breakdown by Loss Category
    const causeOfLossMap = {};
    let totalWithCause = 0;
    let totalWithoutCause = 0;
    
      data.forEach(row => {
      const incurred = row.total_incurred || 0;
      if (row.cause_of_loss && row.cause_of_loss.trim()) {
        const cause = row.cause_of_loss.trim();
        if (!causeOfLossMap[cause]) {
          causeOfLossMap[cause] = 0;
        }
        causeOfLossMap[cause] += incurred;
        totalWithCause += incurred;
      } else {
        totalWithoutCause += incurred;
      }
    });

    // Sort causes by total incurred (descending)
    const sortedCauses = Object.entries(causeOfLossMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15); // Limit to top 15 causes for readability

    if (sortedCauses.length > 0 || totalWithoutCause > 0) {
      const labels = sortedCauses.map(([cause]) => cause);
      const values = sortedCauses.map(([, value]) => value);
      
      // Add "Unspecified" if there are claims without cause
      if (totalWithoutCause > 0) {
        labels.push('Unspecified');
        values.push(totalWithoutCause);
      }

        const colors = [
          'rgba(56, 189, 248, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(14, 165, 233, 0.8)',
        'rgba(20, 184, 166, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(217, 70, 239, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(147, 51, 234, 0.8)',
        'rgba(148, 163, 184, 0.8)'
      ];

      el('causeOfLossStatus').textContent = 
        \`Showing \${sortedCauses.length} loss category/categories. Total indemnity: \${fmtMoney(totalWithCause + totalWithoutCause)}\`;
      el('causeOfLossStatus').className = 'status';

      chartInstances.causeOfLoss = new Chart(el('causeOfLossChart'), {
      type: 'bar',
      data: {
          labels: labels,
          datasets: [{
            label: 'Total Incurred',
            data: values,
            backgroundColor: labels.map((_, idx) => colors[idx % colors.length])
          }]
      },
      options: {
          indexAxis: 'y', // Horizontal bar chart
        responsive: true,
          maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
          tooltip: {
            callbacks: {
                label: (ctx) => {
                  const value = fmtMoney(ctx.parsed.x);
                  const percentage = ((ctx.parsed.x / (totalWithCause + totalWithoutCause)) * 100).toFixed(1);
                  return \`\${value} (\${percentage}%)\`;
                }
            }
          }
        },
        scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: (value) => '$' + value.toLocaleString()
              },
              title: {
                display: true,
                text: 'Total Incurred ($)'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Loss Category'
              }
            }
          }
        }
      });
    } else {
      el('causeOfLossStatus').textContent = 
        'No loss category data available. Map the "Loss Category / Cause Bucket" field in Step 2 to see this breakdown.';
      el('causeOfLossStatus').className = 'status error';
    }

    // Loss by Type YoY - Enhanced with better categorization
    const typeYearMap = {};
    const bodyPartYearMap = {};
    const causeYearMap = {};
    
      data.forEach(row => {
        if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
      const year = row.date_of_loss.getFullYear();
      const incurred = row.total_incurred || 0;
      
      // By claim category
      const category = row.claim_category || 'Uncategorized';
      if (!typeYearMap[category]) typeYearMap[category] = {};
      if (!typeYearMap[category][year]) typeYearMap[category][year] = 0;
      typeYearMap[category][year] += incurred;
      
      // By body part (if available)
      if (row.body_part) {
        const bodyPart = row.body_part;
        if (!bodyPartYearMap[bodyPart]) bodyPartYearMap[bodyPart] = {};
        if (!bodyPartYearMap[bodyPart][year]) bodyPartYearMap[bodyPart][year] = 0;
        bodyPartYearMap[bodyPart][year] += incurred;
      }
      
      // By cause (if available)
      if (row.cause_of_loss) {
        const cause = row.cause_of_loss;
        if (!causeYearMap[cause]) causeYearMap[cause] = {};
        if (!causeYearMap[cause][year]) causeYearMap[cause][year] = 0;
        causeYearMap[cause][year] += incurred;
      }
    });

    // Get all years
    const allYearsSet = new Set();
    Object.values(typeYearMap).forEach(typeData => {
      Object.keys(typeData).forEach(y => allYearsSet.add(parseInt(y)));
    });
    const sortedYears = Array.from(allYearsSet).sort((a, b) => a - b);
    const types = Object.keys(typeYearMap).sort();

    // Use claim category if available, otherwise use body part, then cause
    const primaryMap = types.length > 1 ? typeYearMap : 
                      (Object.keys(bodyPartYearMap).length > 0 ? bodyPartYearMap : causeYearMap);
    const primaryTypes = Object.keys(primaryMap).sort();

    const datasets = primaryTypes.map((type, idx) => {
      const colors = [
        'rgba(56, 189, 248, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(245, 158, 11, 0.8)'
      ];
      return {
        label: type,
        data: sortedYears.map(y => primaryMap[type][y] || 0),
        backgroundColor: colors[idx % colors.length]
      };
    });

      chartInstances.lossByType = new Chart(el('lossByTypeChart'), {
        type: 'bar',
        data: {
        labels: sortedYears.map(y => String(y)),
        datasets: datasets.length > 0 ? datasets : [{
            label: 'Total Incurred',
          data: sortedYears.map(y => {
            let total = 0;
            data.forEach(row => {
              if (row.date_of_loss && row.date_of_loss instanceof Date && 
                  row.date_of_loss.getFullYear() === y) {
                total += row.total_incurred || 0;
              }
            });
            return total;
          }),
            backgroundColor: 'rgba(56, 189, 248, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
          legend: { display: primaryTypes.length > 1 },
            tooltip: {
              callbacks: {
              label: (ctx) => {
                const label = ctx.dataset.label || '';
                const value = fmtMoney(ctx.parsed.y);
                return label ? \`\${label}: \${value}\` : value;
              }
              }
            }
          },
          scales: {
          x: { 
            stacked: primaryTypes.length > 1,
            title: {
              display: true,
              text: 'Year'
            }
          },
          y: {
            beginAtZero: true,
            stacked: primaryTypes.length > 1,
            ticks: {
              callback: (value) => '$' + value.toLocaleString()
            },
            title: {
              display: true,
              text: 'Total Incurred ($)'
            }
          }
        }
      }
    });

    // Loss by Year
    const yearlyMapForChart = {};
    data.forEach(row => {
      if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
      const y = row.date_of_loss.getFullYear();
      if (!yearlyMapForChart[y]) yearlyMapForChart[y] = 0;
      yearlyMapForChart[y] += row.total_incurred || 0;
    });
    const labels = Object.keys(yearlyMapForChart).map(y => parseInt(y)).sort((a, b) => a - b);
    const dataPoints = labels.map(y => yearlyMapForChart[y]);
    
    // Customer Mode: Calculate Hypothetical (Without Voxel) for Loss By Year
    const hypotheticalDataPoints = [];
    if (calculations.isCustomer && calculations.voxelStartDate) {
      const multiplier = 1 / Math.max(0.01, 1 - calculations.wcReduction);
      const startYear = calculations.voxelStartDate.getFullYear();
      const startMonth = calculations.voxelStartDate.getMonth(); // 0-11
      
      labels.forEach((y, idx) => {
        const actual = dataPoints[idx];
        if (y < startYear) {
           hypotheticalDataPoints.push(null); 
        } else if (y === startYear) {
           const impactedMonths = 12 - startMonth;
           const factor = (startMonth * 1 + impactedMonths * multiplier) / 12;
           hypotheticalDataPoints.push(actual * factor);
        } else {
           hypotheticalDataPoints.push(actual * multiplier);
        }
      });
    }

    const lossByYearDatasets = [{
          label: calculations.isCustomer ? 'Actual (With Voxel)' : 'Total Incurred',
          data: dataPoints,
          borderColor: 'rgba(56, 189, 248, 1)',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          tension: 0.4,
          fill: true
    }];
    
    if (calculations.isCustomer && hypotheticalDataPoints.length) {
        lossByYearDatasets.push({
            label: 'Projected (No Voxel)',
            data: hypotheticalDataPoints,
            borderColor: 'rgba(148, 163, 184, 1)',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            borderDash: [5, 5],
            tension: 0.4,
            fill: false
        });
    }

    chartInstances.lossByYear = new Chart(el('lossByYearChart'), {
      type: 'line',
      data: {
        labels: labels.map(y => String(y)),
        datasets: lossByYearDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: calculations.isCustomer },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + fmtMoney(ctx.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => '$' + value.toLocaleString()
            }
          }
        }
      }
    });

    // Cost Comparison
    chartInstances.costComparison = new Chart(el('costComparisonChart'), {
      type: 'bar',
      data: {
        labels: ['Current', 'Improved'],
        datasets: [
          {
            label: 'Direct',
            data: [calculations.directManual, calculations.directImproved],
            backgroundColor: 'rgba(56, 189, 248, 0.8)'
          },
          {
            label: 'Indirect',
            data: [calculations.indirectManual, calculations.indirectImproved],
            backgroundColor: 'rgba(34, 197, 94, 0.8)'
          },
          {
            label: 'Observation',
            data: [calculations.costManual, calculations.costImproved],
            backgroundColor: 'rgba(251, 146, 60, 0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: {
            beginAtZero: true,
            stacked: true,
            ticks: {
              callback: (value) => '$' + value.toLocaleString()
            }
          }
        }
      }
    });

    // Projected Improvements - Show multi-year projections based on annual baselines
    const yearlyMapForProjection = {};
    const yearlyClaimCounts = {};
    data.forEach(row => {
      if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
      const y = row.date_of_loss.getFullYear();
      if (!yearlyMapForProjection[y]) {
        yearlyMapForProjection[y] = 0;
        yearlyClaimCounts[y] = 0;
      }
      yearlyMapForProjection[y] += row.total_incurred || 0;
      yearlyClaimCounts[y] += 1;
    });
    const historicalYears = Object.keys(yearlyMapForProjection).map(y => parseInt(y)).sort((a, b) => a - b);
    const latestYear = historicalYears.length > 0 ? historicalYears[historicalYears.length - 1] : new Date().getFullYear();
    
    // Calculate annual baseline from most recent year(s)
    let annualBaselineCost = calculations.totalManual; // Default to calculated annual cost
    let annualBaselineImproved = calculations.totalImproved;
    
    // Customer Mode Inflation Factor
    const inflationFactor = calculations.isCustomer ? (calculations.totalManual / calculations.totalImproved) : 1;
    
    if (historicalYears.length > 0) {
      // Use most recent year's actual incurred as baseline, or average of recent years
      let baselineIncurred = 0;
      let baselineClaims = 0;
      
      if (historicalYears.length >= 3) {
        // Average of last 3 years
        const recentYears = historicalYears.slice(-3);
        recentYears.forEach(y => {
          baselineIncurred += yearlyMapForProjection[y];
          baselineClaims += yearlyClaimCounts[y];
        });
        baselineIncurred = baselineIncurred / 3;
        baselineClaims = baselineClaims / 3;
      } else if (historicalYears.length >= 2) {
        // Average of last 2 years
        const recentYears = historicalYears.slice(-2);
        recentYears.forEach(y => {
          baselineIncurred += yearlyMapForProjection[y];
          baselineClaims += yearlyClaimCounts[y];
        });
        baselineIncurred = baselineIncurred / 2;
        baselineClaims = baselineClaims / 2;
      } else {
        // Use most recent year
        baselineIncurred = yearlyMapForProjection[latestYear];
        baselineClaims = yearlyClaimCounts[latestYear];
      }
      
      // Calculate annual baseline using same structure as calculations
      const avgCostFromData = baselineIncurred / Math.max(baselineClaims, 1);
      const injuriesFromData = Math.round(baselineClaims);
      
      const miscDirect = parseFloat(el('miscDirect').value) || 0;
      const miscIndirect = parseFloat(el('miscIndirect').value) || 0;
      const miscCostReduction = Math.max(0, Math.min(100, parseFloat(el('miscCostReduction').value) || 0)) / 100;
      const wcReduction = Math.max(0, Math.min(100, parseFloat(el('wcReduction').value) || 0)) / 100;
      const mult = Math.max(0, parseFloat(el('indirectMult').value) || 0);
      const lostTimeReduction = Math.max(0, Math.min(100, parseFloat(el('lostTimeReduction').value) || 0)) / 100;
      const retentionImprovement = Math.max(0, Math.min(100, parseFloat(el('retentionImprovement').value) || 0)) / 100;
      const includeObs = el('includeObs').checked;
      
      const sup = parseFloat(el('supCount').value) || 0;
      const shifts = parseFloat(el('shifts').value) || 0;
      const rate = parseFloat(el('rate').value) || 0;
      const minManual = Math.max(0, parseFloat(el('minObsManual').value) || 0);
      const workdays = parseFloat(el('workdays').value) || 0;
      const obsPerShiftManual = Math.max(0, parseFloat(el('obsPerShift').value) || 0);
      const obsSpeedImprovement = Math.max(1, parseFloat(el('obsSpeedImprovement').value) || 1);
      
      if (calculations.isCustomer) {
          // Customer Mode: injuriesFromData is ACTUAL (WITH VOXEL)
          const injuriesWith = injuriesFromData;
          const directWith = avgCostFromData * injuriesWith + miscDirect;
          
          const indirectImprovementFactor = 1 - (lostTimeReduction * 0.6 + retentionImprovement * 0.4);
          const indirectWith = directWith * mult * indirectImprovementFactor + miscIndirect;
          
          const costWith = sup * shifts * obsPerShiftManual * (minManual / 60) * rate * workdays;
          
          annualBaselineImproved = directWith + indirectWith + (includeObs ? costWith : 0);
          annualBaselineCost = annualBaselineImproved * inflationFactor; 
      } else {
          // Prospect Mode
          const injuriesManual = injuriesFromData;
          const injuriesImproved = Math.max(0, Math.round(injuriesManual * (1 - wcReduction)));
          const directManual = avgCostFromData * injuriesManual + miscDirect;
          const directImproved = avgCostFromData * injuriesImproved + miscDirect * (1 - miscCostReduction);
          const indirectManual = directManual * mult + miscIndirect;
          const indirectImprovementFactor = 1 - (lostTimeReduction * 0.6 + retentionImprovement * 0.4);
          const indirectImproved = directImproved * mult * indirectImprovementFactor + miscIndirect * (1 - miscCostReduction);
          const minImproved = Math.max(0.1, minManual / obsSpeedImprovement);
          const costManual = sup * shifts * obsPerShiftManual * (minManual / 60) * rate * workdays;
          const costImproved = sup * shifts * obsPerShiftManual * (minImproved / 60) * rate * workdays;
          
          annualBaselineCost = directManual + indirectManual + (includeObs ? costManual : 0);
          annualBaselineImproved = directImproved + indirectImproved + (includeObs ? costImproved : 0);
      }
    }
    
    // Project 3 years into the future using annual baseline
    const projectionYears = [];
    const currentProjections = [];
    const improvedProjections = [];
    
    for (let i = 0; i < 3; i++) {
      const year = latestYear + i + 1;
      projectionYears.push(year);
      currentProjections.push(annualBaselineCost); // High
      improvedProjections.push(annualBaselineImproved); // Low
    }
    
    const allYearsForProjection = [...historicalYears, ...projectionYears];
    const improvementFactor = annualBaselineImproved / annualBaselineCost;
    
    // Calculate historical annual costs
    // Note: We need to reconstruct full costs from the incurred data for historical years
    const historicalData = historicalYears.map(y => {
      const yearIncurred = yearlyMapForProjection[y];
      const yearClaims = yearlyClaimCounts[y];
      const yearAvgCost = yearIncurred / Math.max(yearClaims, 1);
      
      const miscDirect = parseFloat(el('miscDirect').value) || 0;
      const miscIndirect = parseFloat(el('miscIndirect').value) || 0;
      const mult = Math.max(0, parseFloat(el('indirectMult').value) || 0);
      const includeObs = el('includeObs').checked;
      
      // Obs params
      const sup = parseFloat(el('supCount').value) || 0;
      const shifts = parseFloat(el('shifts').value) || 0;
      const rate = parseFloat(el('rate').value) || 0;
      const minManual = Math.max(0, parseFloat(el('minObsManual').value) || 0);
      const workdays = parseFloat(el('workdays').value) || 0;
      const obsPerShiftManual = Math.max(0, parseFloat(el('obsPerShift').value) || 0);
      
      // Calculate full annual cost structure for this year based on its actual data
      // For Customer, this is "With Voxel" (Low) if after start date.
      // For Prospect, this is "Without Voxel" (High).
      
      // We will adjust the dataset construction logic instead of changing this base calculation
      const yearDirect = yearAvgCost * yearClaims + miscDirect;
      
      // Indirect calculation depends on mode? 
      // Actually, let's assume standard formula for base historical data
      const yearIndirect = yearDirect * mult + miscIndirect;
      
      // For obs cost, simple baseline
      const costObsBaseline = sup * shifts * obsPerShiftManual * (minManual / 60) * rate * workdays;
      
      return yearDirect + yearIndirect + (includeObs ? costObsBaseline : 0);
    });
    
    // Build Datasets
    const improvementDatasets = [];
    
    if (calculations.isCustomer) {
        const startYear = calculations.voxelStartDate ? calculations.voxelStartDate.getFullYear() : 9999;
        const startMonth = calculations.voxelStartDate ? calculations.voxelStartDate.getMonth() : 0;
        
        // Split Historical into Actual (With Voxel) and Hypothetical (Without)
        // Historical Data array holds the "Actual" calculated costs.
        // We need to inflate them for "Without Voxel" for years >= startYear.
        
        const histActual = [];
        const histHypothetical = [];
        
        historicalYears.forEach((y, idx) => {
            const val = historicalData[idx];
            if (y < startYear) {
                // Before Voxel: Actual is Manual/High. Hypothetical doesn't exist or is same.
                // Wait, if they weren't using Voxel, "Actual" is "Without Voxel".
                // "Hypothetical (No Voxel)" is same as Actual.
                histActual.push(val);
                histHypothetical.push(val);
            } else {
                // After Voxel: Actual is Improved/Low.
                // Hypothetical (No Voxel) needs inflation.
                histActual.push(val);
                
                let factor = inflationFactor;
                if (y === startYear) {
                     const impactedMonths = 12 - startMonth;
                     factor = (startMonth * 1 + impactedMonths * inflationFactor) / 12;
                }
                histHypothetical.push(val * factor);
            }
        });
        
        improvementDatasets.push({
            label: 'Actual (With Voxel)',
            data: [...histActual, null, null, null],
            borderColor: 'rgba(56, 189, 248, 1)',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            borderWidth: 2,
            fill: false
        });
        
        improvementDatasets.push({
            label: 'Hypothetical (No Voxel)',
            data: [...histHypothetical, ...currentProjections], // Connect history to projection
            borderColor: 'rgba(148, 163, 184, 1)',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false
        });
        
        // Future With Voxel (Low)
        improvementDatasets.push({
            label: 'Projected (With Voxel)',
            data: [...new Array(historicalYears.length).fill(null), ...improvedProjections],
            borderColor: 'rgba(56, 189, 248, 1)',
            borderWidth: 2,
            borderDash: [5, 5], // Dashed for future
            fill: false
        });

    } else {
        // PROSPECT MODE
        // Historical Actual is High/Manual.
        // Historical Improved is Hypothetical Low.
        const histImproved = historicalData.map(v => v * improvementFactor);
        
        improvementDatasets.push({
            label: 'Historical Actual',
            data: [...historicalData, null, null, null],
            borderColor: 'rgba(148, 163, 184, 1)',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            borderWidth: 2,
            fill: false
        });
        
        improvementDatasets.push({
            label: 'Historical (if improved)',
            data: [...histImproved, null, null, null],
            borderColor: 'rgba(34, 197, 94, 0.6)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false
        });
        
        improvementDatasets.push({
            label: 'Projected Current',
            data: [...new Array(historicalYears.length).fill(null), ...currentProjections],
            borderColor: 'rgba(251, 146, 60, 1)',
            borderWidth: 2,
            borderDash: [10, 5],
            fill: false
        });
        
        improvementDatasets.push({
            label: 'Projected Improved',
            data: [...new Array(historicalYears.length).fill(null), ...improvedProjections],
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 3,
            fill: false
        });
    }

    chartInstances.improvements = new Chart(el('improvementsChart'), {
      type: 'line',
      data: {
        labels: allYearsForProjection.map(y => String(y)),
        datasets: improvementDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.parsed.y === null) return null;
                return ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Year'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => '$' + value.toLocaleString()
            },
            title: {
              display: true,
              text: 'Total Safety Cost ($)'
            }
          }
        }
      }
    });

    // Breakdown Chart
    chartInstances.breakdown = new Chart(el('breakdownChart'), {
      type: 'bar',
      data: {
        labels: ['Direct Cost', 'Indirect Cost', 'Observation Cost'],
        datasets: [
          {
            label: 'Current',
            data: [
              calculations.directManual,
              calculations.indirectManual,
              calculations.costManual
            ],
            backgroundColor: 'rgba(148, 163, 184, 0.8)'
          },
          {
            label: 'Improved',
            data: [
              calculations.directImproved,
              calculations.indirectImproved,
              calculations.costImproved
            ],
            backgroundColor: 'rgba(34, 197, 94, 0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => '$' + value.toLocaleString()
            }
          }
        }
      }
    });

    // Site Comparison Charts (only if multiple sites in full dataset)
    const allSites = new Set();
    canonicalData.forEach(row => {
      if (row.site_name) allSites.add(row.site_name);
    });

    if (allSites.size > 1) {
      // Site comparison by total incurred
      const siteIncurredMap = {};
      const siteClaimsMap = {};
      canonicalData.forEach(row => {
        const site = row.site_name || 'Unknown';
        if (!siteIncurredMap[site]) {
          siteIncurredMap[site] = 0;
          siteClaimsMap[site] = 0;
        }
        siteIncurredMap[site] += row.total_incurred || 0;
        siteClaimsMap[site] += 1;
      });

      const sortedSites = Array.from(allSites).sort((a, b) => 
        siteIncurredMap[b] - siteIncurredMap[a]
      ).slice(0, 10); // Top 10 sites

      chartInstances.siteComparison = new Chart(el('siteComparisonChart'), {
        type: 'bar',
        data: {
          labels: sortedSites,
          datasets: [{
            label: 'Total Incurred',
            data: sortedSites.map(s => siteIncurredMap[s]),
            backgroundColor: 'rgba(56, 189, 248, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => fmtMoney(ctx.parsed.y)
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => '$' + value.toLocaleString()
              },
              title: {
                display: true,
                text: 'Total Incurred ($)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Site'
              }
            }
          }
        }
      });

      chartInstances.siteClaims = new Chart(el('siteClaimsChart'), {
        type: 'bar',
        data: {
          labels: sortedSites,
          datasets: [{
            label: 'Number of Claims',
            data: sortedSites.map(s => siteClaimsMap[s]),
            backgroundColor: 'rgba(34, 197, 94, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => \`\${ctx.parsed.y} claim(s)\`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              },
              title: {
                display: true,
                text: 'Number of Claims'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Site'
              }
            }
          }
        }
      });

      el('siteComparisonStatus').textContent = \`Comparing \${sortedSites.length} site(s). Showing top sites by total incurred.\`;
      el('siteComparisonStatus').className = 'status';
    } else {
      el('siteComparisonStatus').textContent = 'Single site or no site data available for comparison.';
      el('siteComparisonStatus').className = 'status';
    }

    // Lost Days Analysis with Voxel Projections
    const lostDaysData = data.filter(row => row.lost_days !== undefined && row.lost_days > 0);
    const lostTimeReduction = Math.max(0, Math.min(100, parseFloat(el('lostTimeReduction').value) || 0)) / 100;

    if (lostDaysData.length > 0) {
      // Lost Days by Category
      const lostDaysByCategory = {};
      lostDaysData.forEach(row => {
        const category = row.cause_of_loss || 'Uncategorized';
        if (!lostDaysByCategory[category]) {
          lostDaysByCategory[category] = { total: 0, count: 0, claims: 0 };
        }
        lostDaysByCategory[category].total += row.lost_days || 0;
        lostDaysByCategory[category].count += 1;
        lostDaysByCategory[category].claims += 1;
      });

      const sortedCategories = Object.entries(lostDaysByCategory)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10);

      chartInstances.lostDaysByCategory = new Chart(el('lostDaysByCategoryChart'), {
        type: 'bar',
        indexAxis: 'y',
        data: {
          labels: sortedCategories.map(([cat]) => cat),
          datasets: [{
            label: 'Total Lost Days',
            data: sortedCategories.map(([, data]) => data.total),
            backgroundColor: 'rgba(251, 146, 60, 0.8)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const idx = ctx.dataIndex;
                  const data = sortedCategories[idx][1];
                  return \`\${fmtInt(data.total)} days (\${data.count} claim(s), avg: \${fmtNum(data.total / data.count, 1)} days/claim)\`;
                }
              }
            }
          }
        }
      });

      // Lost Days Projection (Current vs Projected)
      const totalLostDays = lostDaysData.reduce((sum, row) => sum + (row.lost_days || 0), 0);
      const avgLostDays = totalLostDays / lostDaysData.length;
      const projectedLostDays = totalLostDays * (1 - lostTimeReduction);
      const projectedAvgLostDays = avgLostDays * (1 - lostTimeReduction);

      chartInstances.lostDaysProjection = new Chart(el('lostDaysProjectionChart'), {
        type: 'bar',
        data: {
          labels: ['Current', 'Projected (with Voxel)'],
          datasets: [{
            label: 'Total Lost Days',
            data: [totalLostDays, projectedLostDays],
            backgroundColor: ['rgba(148, 163, 184, 0.8)', 'rgba(34, 197, 94, 0.8)']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const savings = totalLostDays - projectedLostDays;
                  if (ctx.dataIndex === 1) {
                    return \`\${fmtInt(ctx.parsed.y)} days (savings: \${fmtInt(savings)} days, \${(lostTimeReduction * 100).toFixed(0)}% reduction)\`;
                  }
                  return \`\${fmtInt(ctx.parsed.y)} days\`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: Math.max(1, Math.ceil(totalLostDays / 10))
              },
              title: {
                display: true,
                text: 'Total Lost Days'
              }
            }
          }
        }
      });

      // Lost Days Trend by Year
      const lostDaysByYear = {};
      lostDaysData.forEach(row => {
        if (!row.date_of_loss || !(row.date_of_loss instanceof Date)) return;
        const year = row.date_of_loss.getFullYear();
        if (!lostDaysByYear[year]) lostDaysByYear[year] = 0;
        lostDaysByYear[year] += row.lost_days || 0;
      });

      const lostDaysYears = Object.keys(lostDaysByYear).map(y => parseInt(y)).sort((a, b) => a - b);
      const lostDaysValues = lostDaysYears.map(y => lostDaysByYear[y]);
      const projectedLostDaysValues = lostDaysValues.map(v => v * (1 - lostTimeReduction));

      chartInstances.lostDaysTrend = new Chart(el('lostDaysTrendChart'), {
        type: 'line',
        data: {
          labels: lostDaysYears.map(y => String(y)),
          datasets: [
            {
              label: 'Current Lost Days',
              data: lostDaysValues,
              borderColor: 'rgba(148, 163, 184, 1)',
              backgroundColor: 'rgba(148, 163, 184, 0.1)',
              tension: 0.4
            },
            {
              label: 'Projected Lost Days (with Voxel)',
              data: projectedLostDaysValues,
              borderColor: 'rgba(34, 197, 94, 1)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderDash: [5, 5],
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
            tooltip: {
              callbacks: {
                label: (ctx) => \`\${ctx.dataset.label}: \${fmtInt(ctx.parsed.y)} days\`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Lost Days'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Year'
              }
            }
          }
        }
      });

      // Update metrics
      el('avgLostDaysCurrent').textContent = fmtNum(avgLostDays, 1);
      el('avgLostDaysProjected').textContent = fmtNum(projectedAvgLostDays, 1);
      el('totalLostDaysCurrent').textContent = fmtInt(totalLostDays);
      el('totalLostDaysProjected').textContent = fmtInt(projectedLostDays);

      el('lostDaysStatus').textContent = 
        \`Analyzing \${lostDaysData.length} claim(s) with lost days data. Projection based on \${(lostTimeReduction * 100).toFixed(0)}% lost time reduction.\`;
      el('lostDaysStatus').className = 'status';
    } else {
      el('lostDaysStatus').textContent = 
        'No lost days data available. Map the "Lost Work Days" field in Step 2 to see this analysis.';
      el('lostDaysStatus').className = 'status error';
      el('avgLostDaysCurrent').textContent = '\u2014';
      el('avgLostDaysProjected').textContent = '\u2014';
      el('totalLostDaysCurrent').textContent = '\u2014';
      el('totalLostDaysProjected').textContent = '\u2014';
    }
  }


  // --- PowerPoint Export ---
  async function exportToPPT() {
    const btn = el('exportBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Generating...</span>';

    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };

      // Helper to add a slide with a title - Updated for Light Theme
      const addSlide = (title) => {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFFFF' }; // White background
        slide.color = '0F172A'; // Dark text
        
        // Title Bar
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: '0F172A' } });
        slide.addText(title, {
          x: 0.5, y: 0.15, w: '90%', h: 0.5,
          fontSize: 24, fontFace: 'Arial', color: 'FFFFFF', bold: true
        });
        
        // Add footer
        slide.addText('Site Loss & ROI Analysis', {
          x: 0.5, y: '92%', w: '90%', h: 0.3,
          fontSize: 10, color: '64748B'
        });
        
        return slide;
      };

      // 1. Title Slide - Updated for Light Theme
      const slide1 = pptx.addSlide();
      slide1.background = { color: 'FFFFFF' };
      // Decor element
      slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.5, fill: { color: '0F172A' } });
      
      slide1.addText('Site Loss Analysis & ROI Projection', {
        x: 1, y: '40%', w: '80%', h: 1,
        fontSize: 36, color: '0F172A', bold: true, align: 'center'
      });
      slide1.addText(\`Generated: \${new Date().toLocaleDateString()}\`, {
        x: 1, y: '55%', w: '80%', h: 0.5,
        fontSize: 14, color: '64748B', align: 'center'
      });

      // 2. Executive Summary - Updated layout
      const slide2 = addSlide('Executive Summary');
      
      // Get values
      const potentialSavings = el('deltaBlock').textContent;
      const totalCurrent = el('totalManual').textContent;
      const totalImproved = el('totalImproved').textContent;
      const wcReduction = el('wcReduction').value;
      const directCurrent = el('directCostManual').textContent;
      const indirectCurrent = el('indirectCostManual').textContent;
      const isCustomer = el('existingCustomerToggle').checked;

      // Key Findings Text
      slide2.addText('Key Findings:', { x: 0.5, y: 1.0, fontSize: 18, bold: true, color: '0F172A' });
      
      const findings = isCustomer ? [
        \`Estimated savings of \${potentialSavings} realized with Voxel technology.\`,
        \`Achieved \${wcReduction}% reduction in Workers' Compensation claims frequency relative to baseline.\`,
        \`Total safety costs maintained at \${totalImproved} vs projected \${totalCurrent} without Voxel.\`
      ] : [
        \`Potential annual savings of \${potentialSavings} identified through safety improvements.\`,
        \`Projected \${wcReduction}% reduction in Workers' Compensation claims frequency.\`,
        \`Total safety costs reduced from \${totalCurrent} to \${totalImproved}.\`
      ];
      
      slide2.addText(findings, {
        x: 0.5, y: 1.4, w: 9, h: 1.5,
        fontSize: 14, color: '334155', bullet: true, lineSpacing: 1.5
      });

      // Metrics Grid
      const metricsY = 3.2;
      slide2.addText('Cost Breakdown:', { x: 0.5, y: metricsY, fontSize: 16, bold: true, color: '0F172A' });

      const colHeaders = isCustomer ? ['Metric', 'Projected (No Voxel)', 'Actual (With Voxel)'] : ['Metric', 'Current Scenario', 'Improved Scenario'];

      const metricsData = [
        colHeaders,
        ['Direct Costs', directCurrent, el('directCostImproved').textContent],
        ['Indirect Costs', indirectCurrent, el('indirectCostImproved').textContent],
        ['Total Safety Cost', totalCurrent, totalImproved]
      ];

      slide2.addTable(metricsData, {
        x: 0.5, y: metricsY + 0.4, w: 9,
        fill: { color: 'F8FAFC' },
        color: '0F172A',
        fontSize: 12,
        border: { pt: 1, color: 'E2E8F0' },
        autoPage: false,
        colW: [3, 3, 3]
      });

      // 3. Key Findings & Insights (Auto-generated)
      const slide3 = addSlide('Detailed Insights');
      
      // Calculate top causes
      let topCauses = [];
      if (chartInstances.causeOfLoss) {
        const data = chartInstances.causeOfLoss.data;
        const labels = data.labels;
        const values = data.datasets[0].data;
        const zipped = labels.map((l, i) => ({ label: l, value: values[i] }));
        zipped.sort((a, b) => b.value - a.value);
        topCauses = zipped.slice(0, 3);
      }

      const insightText = [
        { text: 'Top Loss Categories:', options: { bold: true, fontSize: 14, breakLine: true } },
      ];
      
      if (topCauses.length > 0) {
        topCauses.forEach((c, i) => {
          insightText.push({ 
            text: \`\${i+1}. \${c.label}: \${fmtMoney(c.value)}\`, 
            options: { fontSize: 12, bullet: true } 
          });
        });
      } else {
        insightText.push({ text: 'No loss category data available.', options: { fontSize: 12, italic: true } });
      }
      
      // Lost days insight
      const lostDaysVal = el('totalLostDaysCurrent').textContent;
      if (lostDaysVal !== '\u2014') {
        insightText.push({ text: 'Lost Work Days:', options: { bold: true, fontSize: 14, breakLine: true, indent: 0 } }); // Reset indent manually if needed or just new block
        // Workaround: add separate text block for spacing
      }

      slide3.addText(insightText, { x: 0.5, y: 1.2, w: 4.5, h: 4, color: '334155' });
      
      if (lostDaysVal !== '\u2014') {
         slide3.addText([
           { text: \`Total Lost Days: \${lostDaysVal}\`, options: { bullet: true } },
           { text: \`Projected Reduction: \${el('totalLostDaysProjected').textContent}\`, options: { bullet: true } }
         ], { x: 0.5, y: 3.5, w: 4.5, h: 1.5, fontSize: 12, color: '334155' });
      }

      // Add ROI/Savings Chart image to this slide if possible, or just big savings number
      slide3.addText('Projected Annual Savings', { x: 5.5, y: 1.5, w: 4, align: 'center', fontSize: 14, color: '64748B' });
      slide3.addText(potentialSavings, { x: 5.5, y: 2.0, w: 4, align: 'center', fontSize: 36, bold: true, color: '22C55E' });


      // Helper to capture chart with light theme background handling
      const addChartSlide = (chartId, title, desc) => {
        const canvas = el(chartId);
        if (canvas) {
          const slide = addSlide(title);
          // Create a temporary canvas to fill background white (since charts might be transparent)
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const ctx = tempCanvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          ctx.drawImage(canvas, 0, 0);
          
          const imgData = tempCanvas.toDataURL('image/png');
          slide.addImage({ data: imgData, x: 0.5, y: 1.2, w: 9, h: 4.5, sizing: { type: 'contain', w: 9, h: 4.5 } });
          if (desc) {
            slide.addText(desc, { x: 0.5, y: 6, w: 9, h: 0.5, fontSize: 12, color: '64748B', italic: true });
          }
        }
      };

      // 4. Indemnity Breakdown
      addChartSlide('causeOfLossChart', 'Indemnity Breakdown by Loss Category', 'Breakdown of total incurred costs by loss category/cause.');

      // 5. Loss by Type & Year
      addChartSlide('lossByTypeChart', 'Loss by Type Year-over-Year', 'Year-over-year comparison of losses categorized by claim type or body part.');
      
      // 6. Total Incurred Trend
      addChartSlide('lossByYearChart', 'Total Incurred Trend', 'Trend of total incurred costs over time.');

      // 7. Cost Comparison
      addChartSlide('costComparisonChart', 'Current vs. Improved Costs', 'Comparison of Direct, Indirect, and Observation costs between current and improved scenarios.');

      // 8. Projected Improvements
      addChartSlide('improvementsChart', 'Projected Improvements (Multi-Year)', 'Projection of safety costs over the next 3 years.');

      // 9. Cost Breakdown
      addChartSlide('breakdownChart', 'Cost Breakdown by Category', 'Detailed breakdown of cost components.');

      // 10. Site Comparison (if valid)
      if (el('siteComparisonChart') && chartInstances.siteComparison) {
        addChartSlide('siteComparisonChart', 'Site Comparison (Total Incurred)', 'Comparison of total incurred costs across different sites.');
      }

      // 11. Lost Days Analysis
      if (el('lostDaysProjectionChart') && chartInstances.lostDaysProjection) {
        addChartSlide('lostDaysProjectionChart', 'Lost Days Projection', 'Impact of improvements on lost work days.');
        addChartSlide('lostDaysTrendChart', 'Lost Days Trend', 'Historical trend of lost work days.');
      }

      // Save the file
      await pptx.writeFile({ fileName: \`Loss_Analysis_\${new Date().toISOString().split('T')[0]}.pptx\` });
      
    } catch (err) {
      console.error(err);
      alert('Error generating PowerPoint: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  // --- Helpers for simplified assumptions ---
  function toggleAdvanced(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
  }

  function calculateObs() {
    const sup = parseFloat(document.getElementById('supCount').value) || 0;
    const shifts = parseFloat(document.getElementById('shifts').value) || 0;
    const obsPerShift = parseFloat(document.getElementById('obsPerShift').value) || 0;
    const workdays = parseFloat(document.getElementById('workdays').value) || 0;
    
    // Formula: Supervisors * Shifts * Obs/Shift * Workdays
    const total = Math.round(sup * shifts * obsPerShift * workdays);
    document.getElementById('totalAnnualObs').value = total;
    
    // Trigger recalculation if on results page
    if (document.getElementById('page3').classList.contains('active')) {
       calculateAndNavigateToResults(); 
    }
  }
  
  function applyPreset(type) {
    // Update active button state
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    // Find button by text or click event... simplified:
    const map = {
        'conservative': 0, 'balanced': 1, 'aggressive': 2
    };
    document.querySelectorAll('.btn-preset')[map[type]].classList.add('active');

    if (type === 'conservative') {
        el('wcReduction').value = 45;
        el('lostTimeReduction').value = 55;
        el('retentionImprovement').value = 10;
        el('miscCostReduction').value = 25;
        el('obsSpeedImprovement').value = "1.5";
    } else if (type === 'balanced') {
        el('wcReduction').value = 65;
        el('lostTimeReduction').value = 81;
        el('retentionImprovement').value = 18;
        el('miscCostReduction').value = 41;
        el('obsSpeedImprovement').value = "2.0";
    } else if (type === 'aggressive') {
        el('wcReduction').value = 80;
        el('lostTimeReduction').value = 90;
        el('retentionImprovement').value = 25;
        el('miscCostReduction').value = 50;
        el('obsSpeedImprovement').value = "2.5";
    }
    // Recalculate if needed
    if (document.getElementById('page3').classList.contains('active')) {
        calculateAndNavigateToResults();
    }
  }
<\/script>
</body>
</html>
`;
var worker_default = {
  async fetch(request, env, ctx) {
    return new Response(HTML_CONTENT, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
