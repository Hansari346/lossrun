/**
 * PowerPoint file generation from results data.
 *
 * Extracted from monolith's exportToPPT() (lines 3062–3274).
 * ZERO DOM access — all data arrives via function parameters.
 *
 * PptxGenJS is a CDN global (declared in src/types/globals.d.ts).
 */

import type { CalculationResults } from "../types";
import { fmtMoney } from "./formatting";

// ---------------------------------------------------------------------------
// Color constants (exact values from monolith light theme)
// ---------------------------------------------------------------------------

const COLORS = {
  dark: "0F172A",
  white: "FFFFFF",
  text: "334155",
  muted: "64748B",
  accent: "22C55E",
  tableBg: "F8FAFC",
  tableBorder: "E2E8F0",
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate and download a PowerPoint deck from results.
 *
 * @param results - Complete calculation results
 * @param chartImages - Map of chart ID → base64 data URL from canvas.toDataURL()
 * @param isExistingCustomer - Affects slide content/labels
 */
export async function exportToPPT(
  results: CalculationResults,
  chartImages: Record<string, string>,
  isExistingCustomer: boolean,
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };

  // Helper: add a slide with a title bar and footer
  const addSlide = (title: string) => {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.white };
    slide.color = COLORS.dark;

    // Title bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: "100%",
      h: 0.8,
      fill: { color: COLORS.dark },
    });
    slide.addText(title, {
      x: 0.5,
      y: 0.15,
      w: "90%",
      h: 0.5,
      fontSize: 24,
      fontFace: "Arial",
      color: COLORS.white,
      bold: true,
    });

    // Footer
    slide.addText("Site Loss & ROI Analysis", {
      x: 0.5,
      y: "92%",
      w: "90%",
      h: 0.3,
      fontSize: 10,
      color: COLORS.muted,
    });

    return slide;
  };

  // Helper: add a chart image slide
  const addChartSlide = (
    chartId: string,
    title: string,
    desc?: string,
  ) => {
    const imgData = chartImages[chartId];
    if (!imgData) return;

    const slide = addSlide(title);
    slide.addImage({
      data: imgData,
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 4.5,
      sizing: { type: "contain", w: 9, h: 4.5 },
    });
    if (desc) {
      slide.addText(desc, {
        x: 0.5,
        y: 6,
        w: 9,
        h: 0.5,
        fontSize: 12,
        color: COLORS.muted,
        italic: true,
      });
    }
  };

  // ------------------------------------------------------------------
  // 1. Title Slide
  // ------------------------------------------------------------------
  const slide1 = pptx.addSlide();
  slide1.background = { color: COLORS.white };
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 1.5,
    fill: { color: COLORS.dark },
  });
  slide1.addText("Site Loss Analysis & ROI Projection", {
    x: 1,
    y: "40%",
    w: "80%",
    h: 1,
    fontSize: 36,
    color: COLORS.dark,
    bold: true,
    align: "center",
  });
  slide1.addText(`Generated: ${new Date().toLocaleDateString()}`, {
    x: 1,
    y: "55%",
    w: "80%",
    h: 0.5,
    fontSize: 14,
    color: COLORS.muted,
    align: "center",
  });

  // ------------------------------------------------------------------
  // 2. Executive Summary
  // ------------------------------------------------------------------
  const slide2 = addSlide("Executive Summary");

  const potentialSavings = fmtMoney(results.annualSavings);
  const totalCurrent = fmtMoney(results.totalManual);
  const totalImproved = fmtMoney(results.totalImproved);
  const wcReductionPct = Math.round(results.wcReduction * 100);
  const directCurrent = fmtMoney(results.directManual);
  const directImproved = fmtMoney(results.directImproved);
  const indirectCurrent = fmtMoney(results.indirectManual);
  const indirectImproved = fmtMoney(results.indirectImproved);

  // Key findings
  slide2.addText("Key Findings:", {
    x: 0.5,
    y: 1.0,
    fontSize: 18,
    bold: true,
    color: COLORS.dark,
  });

  const findings = isExistingCustomer
    ? [
        `Estimated savings of ${potentialSavings} realized with Voxel technology.`,
        `Achieved ${wcReductionPct}% reduction in Workers' Compensation claims frequency relative to baseline.`,
        `Total safety costs maintained at ${totalImproved} vs projected ${totalCurrent} without Voxel.`,
      ]
    : [
        `Potential annual savings of ${potentialSavings} identified through safety improvements.`,
        `Projected ${wcReductionPct}% reduction in Workers' Compensation claims frequency.`,
        `Total safety costs reduced from ${totalCurrent} to ${totalImproved}.`,
      ];

  slide2.addText(findings, {
    x: 0.5,
    y: 1.4,
    w: 9,
    h: 1.5,
    fontSize: 14,
    color: COLORS.text,
    bullet: true,
    lineSpacing: 1.5,
  });

  // Metrics grid
  const metricsY = 3.2;
  slide2.addText("Cost Breakdown:", {
    x: 0.5,
    y: metricsY,
    fontSize: 16,
    bold: true,
    color: COLORS.dark,
  });

  const colHeaders = isExistingCustomer
    ? ["Metric", "Projected (No Voxel)", "Actual (With Voxel)"]
    : ["Metric", "Current Scenario", "Improved Scenario"];

  const metricsData = [
    colHeaders,
    ["Direct Costs", directCurrent, directImproved],
    ["Indirect Costs", indirectCurrent, indirectImproved],
    ["Total Safety Cost", totalCurrent, totalImproved],
  ];

  slide2.addTable(metricsData, {
    x: 0.5,
    y: metricsY + 0.4,
    w: 9,
    fill: { color: COLORS.tableBg },
    color: COLORS.dark,
    fontSize: 12,
    border: { pt: 1, color: COLORS.tableBorder },
    autoPage: false,
    colW: [3, 3, 3],
  });

  // ------------------------------------------------------------------
  // 3. Detailed Insights
  // ------------------------------------------------------------------
  const slide3 = addSlide("Detailed Insights");

  // Top causes from causeBreakdown
  const topCauses = results.causeBreakdown
    .filter((c) => c.name !== "Unspecified")
    .slice(0, 3);

  const insightText: any[] = [
    {
      text: "Top Loss Categories:",
      options: { bold: true, fontSize: 14, breakLine: true },
    },
  ];

  if (topCauses.length > 0) {
    topCauses.forEach((c, i) => {
      insightText.push({
        text: `${i + 1}. ${c.name}: ${fmtMoney(c.incurred)}`,
        options: { fontSize: 12, bullet: true },
      });
    });
  } else {
    insightText.push({
      text: "No loss category data available.",
      options: { fontSize: 12, italic: true },
    });
  }

  slide3.addText(insightText, {
    x: 0.5,
    y: 1.2,
    w: 4.5,
    h: 4,
    color: COLORS.text,
  });

  // Projected savings callout
  slide3.addText("Projected Annual Savings", {
    x: 5.5,
    y: 1.5,
    w: 4,
    align: "center",
    fontSize: 14,
    color: COLORS.muted,
  });
  slide3.addText(potentialSavings, {
    x: 5.5,
    y: 2.0,
    w: 4,
    align: "center",
    fontSize: 36,
    bold: true,
    color: COLORS.accent,
  });

  // ------------------------------------------------------------------
  // 4–11. Chart slides
  // ------------------------------------------------------------------
  addChartSlide(
    "causeOfLossChart",
    "Indemnity Breakdown by Loss Category",
    "Breakdown of total incurred costs by loss category/cause.",
  );

  addChartSlide(
    "lossByTypeChart",
    "Loss by Type Year-over-Year",
    "Year-over-year comparison of losses categorized by claim type or body part.",
  );

  addChartSlide(
    "lossByYearChart",
    "Total Incurred Trend",
    "Trend of total incurred costs over time.",
  );

  addChartSlide(
    "costComparisonChart",
    "Current vs. Improved Costs",
    "Comparison of Direct, Indirect, and Observation costs between current and improved scenarios.",
  );

  addChartSlide(
    "improvementsChart",
    "Projected Improvements (Multi-Year)",
    "Projection of safety costs over the next 3 years.",
  );

  addChartSlide(
    "breakdownChart",
    "Cost Breakdown by Category",
    "Detailed breakdown of cost components.",
  );

  // Site comparison (only if chart image exists)
  addChartSlide(
    "siteComparisonChart",
    "Site Comparison (Total Incurred)",
    "Comparison of total incurred costs across different sites.",
  );

  // Lost days (only if chart images exist)
  addChartSlide(
    "lostDaysProjectionChart",
    "Lost Days Projection",
    "Impact of improvements on lost work days.",
  );
  addChartSlide(
    "lostDaysTrendChart",
    "Lost Days Trend",
    "Historical trend of lost work days.",
  );

  // ------------------------------------------------------------------
  // Save the file
  // ------------------------------------------------------------------
  await pptx.writeFile({
    fileName: `Loss_Analysis_${new Date().toISOString().split("T")[0]}.pptx`,
  });
}
