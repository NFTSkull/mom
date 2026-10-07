import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import {
  buildNom035AggregateReport,
  type NamedLevelMatrix,
  type Nom035AggregateReport,
} from "../aggregate-report";
import { buildFullReportXlsxBuffer } from "../full-report-xlsx";
import { pngHasVisibleInk, renderExecutiveCharts } from "../report-charts";
import {
  LEVEL_UPPER_LABEL,
  levelSummaryRows,
  predominantLevelOf,
  simpleDashboardPanels,
} from "../report-interpretation";
import { RISK_LEVEL_ORDER } from "../risk-palette";
import { auditXlsxVisualStructure } from "../xlsx-visual-audit";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import { AdminExecutiveSummaryPanel } from "@/components/admin/executive-summary-panel";
import { buildB429ProductionLikeReport } from "./fixtures/b429-production-matrix";

const JORNADA = "Jornada de trabajo";

function aggregate(report = buildB429ProductionLikeReport()): Nom035AggregateReport {
  return buildNom035AggregateReport(report, { companyName: "Empresa Demo" });
}

/** Lo que Admin → Resultados renderiza sobre la tabla de trabajadores. */
function renderResultsDashboard(agg: Nom035AggregateReport): string {
  return renderToStaticMarkup(
    createElement("div", null, [
      createElement(AdminExecutiveSummaryPanel, { key: "s", aggregate: agg }),
      createElement(AdminReportChartsPanel, { key: "c", aggregate: agg }),
    ])
  );
}

function rowHtml(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  expect(start, testId).toBeGreaterThan(-1);
  const rest = html.slice(start);
  return rest.slice(0, rest.indexOf("</li>"));
}

function rowValue(html: string, testId: string): string {
  const m = rowHtml(html, testId).match(/data-testid="simple-bar-value"[^>]*>([^<]*)</);
  return m?.[1] ?? "";
}

function find(rows: NamedLevelMatrix[], name: string): NamedLevelMatrix {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(name);
  return row;
}

async function workbook(agg: Nom035AggregateReport) {
  const charts = await renderExecutiveCharts(agg);
  const buf = await buildFullReportXlsxBuffer({
    report: buildB429ProductionLikeReport(),
    aggregate: agg,
    charts,
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return { wb, buf, charts };
}

function sheetRows(sheet: ExcelJS.Worksheet): string[][] {
  const out: string[][] = [];
  sheet.eachRow((row) => {
    out.push(
      (row.values as unknown[])
        .slice(1)
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => String(v))
    );
  });
  return out;
}

describe("B4.29.3 tablero ejecutivo simple (estilo original, lógica por nivel)", () => {
  it("1. layout 2×2 con cuatro paneles en orden", () => {
    const html = renderResultsDashboard(aggregate());
    expect(html).toMatch(/<section class="grid gap-3 lg:grid-cols-2" data-testid="admin-report-charts">/);
    const ids = [...html.matchAll(/data-testid="(chart-(?:risk|completion|categories|domains))"/g)].map(
      (m) => m[1]
    );
    expect(ids).toEqual(["chart-risk", "chart-completion", "chart-categories", "chart-domains"]);
  });

  it("2–5. títulos de los cuatro paneles", () => {
    const html = renderResultsDashboard(aggregate());
    for (const title of [
      "Distribución por nivel de riesgo",
      "Avance de evaluación",
      "Resumen por categoría",
      "Resumen por dominio",
    ]) {
      expect(html).toContain(`>${title}</h3>`);
    }
  });

  it("6–7. sin «Promedio por dominio» ni «Promedio por categoría»", () => {
    const html = renderResultsDashboard(aggregate());
    expect(html).not.toMatch(/Promedio por (dominio|categor[ií]a)/i);
    for (const file of [
      "src/components/admin/report-charts-panel.tsx",
      "src/components/admin/executive-summary-panel.tsx",
      "src/app/admin/resultados/page.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/Promedio por/i);
    }
  });

  it("8–9. sin Medio+ ni Alto+ en la pantalla principal", () => {
    const html = renderResultsDashboard(aggregate());
    expect(html).not.toContain("Medio+");
    expect(html).not.toContain("Alto+");
    const page = readFileSync("src/app/admin/resultados/page.tsx", "utf8");
    expect(page).not.toMatch(/AdminDistributionTables|Medio\+|Alto\+/);
  });

  it("10–11. sin badge naranja ni texto «Nivel predominante: …»", () => {
    const html = renderResultsDashboard(aggregate());
    expect(html).not.toContain("predominant-level-badge");
    expect(html).not.toMatch(/Nivel predominante:/);
    expect(html).not.toMatch(/background-color/);
    expect(html).not.toMatch(/#ea580c|orange/i);
    for (const file of [
      "src/lib/nom035/report-interpretation.ts",
      "src/lib/nom035/report-charts.ts",
      "src/components/admin/report-charts-panel.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/predominantLevelBadge|PREDOMINANT_LEVEL_DOMAINS|badge/);
    }
  });

  it("12–14. Jornada muestra exactamente «ALTO», sin 2.86 ni BAJO, barra al 75%", () => {
    const html = renderResultsDashboard(aggregate());
    const id = "chart-domains-row-jornada-de-trabajo";
    expect(rowValue(html, id)).toBe("ALTO");
    const row = rowHtml(html, id);
    expect(row).toContain('data-level="alto"');
    expect(row).toContain("width:75%");
    expect(row).not.toContain("2.86");
    expect(row).not.toContain("BAJO");
    expect(html).not.toContain("2.86");
    expect(html).not.toContain("21.74");
  });

  it("15. el nivel de cada fila sale de predominantLevelOf (sin casos especiales)", () => {
    const agg = aggregate();
    const html = renderResultsDashboard(agg);
    const slug = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    for (const [rows, prefix] of [
      [agg.categories, "chart-categories"],
      [agg.domains, "chart-domains"],
    ] as const) {
      for (const r of rows) {
        const top = predominantLevelOf(r.levels)!;
        expect(rowValue(html, `${prefix}-row-${slug(r.name)}`), r.name).toBe(LEVEL_UPPER_LABEL[top.level]);
      }
    }
    expect(predominantLevelOf(find(agg.domains, JORNADA).levels)).toEqual({ level: "alto", count: 24 });
    // Empate Bajo/Medio 23/23: regla existente → nivel menor.
    expect(rowValue(html, "chart-domains-row-carga-de-trabajo")).toBe("BAJO");
    expect(rowValue(html, "chart-categories-row-factores-propios-de-la-actividad")).toBe("MEDIO");

    // Si cambian los conteos persistidos, cambia lo mostrado (no hay texto fijo).
    const altered = structuredClone(agg);
    const j = find(altered.domains, JORNADA);
    j.levels.alto.count = 5;
    j.levels.muy_alto.count = 29;
    expect(rowValue(renderResultsDashboard(altered), "chart-domains-row-jornada-de-trabajo")).toBe(
      "MUY ALTO"
    );
  });

  it("16. ningún nivel mostrado depende de puntajes brutos", () => {
    const report = buildB429ProductionLikeReport();
    const before = simpleDashboardPanels(aggregate(report));
    for (const w of report.workers) {
      for (const k of Object.keys(w.domainScores)) {
        w.domainScores[k] = { ...w.domainScores[k]!, score: w.domainScores[k]!.score * 10 };
      }
      for (const k of Object.keys(w.categoryScores)) {
        w.categoryScores[k] = { ...w.categoryScores[k]!, score: w.categoryScores[k]!.score * 10 };
      }
    }
    expect(simpleDashboardPanels(aggregate(report))).toEqual(before);
    for (const file of [
      "src/components/admin/report-charts-panel.tsx",
      "src/lib/nom035/report-interpretation.ts",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\.score\b|avgScore|domainAverages|categoryAverages/);
    }
  });

  it("17. conteos reales intactos y visibles", () => {
    const agg = aggregate();
    expect(RISK_LEVEL_ORDER.map((l) => find(agg.domains, JORNADA).levels[l].count)).toEqual([14, 10, 22, 24, 10]);
    expect(agg.overallRiskDistribution.map((r) => r.count)).toEqual([21, 25, 14, 12, 8]);
    const html = renderResultsDashboard(agg);
    const risk: Array<[string, string]> = [
      ["nulo-despreciable", "21"], ["bajo", "25"], ["medio", "14"], ["alto", "12"], ["muy-alto", "8"],
    ];
    for (const [s, v] of risk) expect(rowValue(html, `chart-risk-row-${s}`)).toBe(v);
    expect(rowValue(html, "chart-completion-row-completados")).toBe("80");
    expect(rowValue(html, "chart-completion-row-pendientes")).toBe("3");
    expect(rowValue(html, "chart-completion-row-en-progreso")).toBe("0");
    expect(levelSummaryRows(agg.domains)).toHaveLength(10);
    expect(levelSummaryRows(agg.categories)).toHaveLength(5);
  });

  it("18. Excel Resumen: tablero simple y «Jornada de trabajo» = ALTO", async () => {
    const { wb, buf, charts } = await workbook(aggregate());
    const resumen = wb.getWorksheet("Resumen Ejecutivo")!;
    const rows = sheetRows(resumen);
    expect(rows.some((r) => r[0] === "RESUMEN EJECUTIVO")).toBe(true);
    expect(rows.some((r) => r.includes("RESUMEN POR CATEGORÍA") && r.includes("RESUMEN POR DOMINIO"))).toBe(true);
    let jornadaLevel: unknown = null;
    resumen.eachRow((row) => {
      if (row.getCell(7).value === JORNADA) jornadaLevel = row.getCell(11).value;
    });
    expect(jornadaLevel).toBe("ALTO");
    const text = JSON.stringify(resumen.getSheetValues());
    expect(text).not.toMatch(/2\.86|21\.74|Nivel predominante:/);
    expect(charts.simpleDashboard).toBeDefined();
    expect(await pngHasVisibleInk(charts.simpleDashboard!)).toBe(true);
    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.imagesBySheet["Resumen Ejecutivo"]).toBe(2);
    const metodo = JSON.stringify(wb.getWorksheet("Metodología")!.getSheetValues());
    expect(metodo).toMatch(/no son directamente comparables entre sí/);
    expect(metodo).toMatch(/nivel predominante: el nivel con más trabajadores/);
  });

  it("19. Excel detallado conserva matrices completas por nivel", async () => {
    const { wb } = await workbook(aggregate());
    const dom = sheetRows(wb.getWorksheet("Dominios")!).find((r) => r[0] === JORNADA);
    expect(dom).toEqual([
      JORNADA, "Organización del tiempo de trabajo",
      "14", "17.5", "10", "12.5", "22", "27.5", "24", "30", "10", "12.5", "56", "70", "34", "42.5", "80",
    ]);
    const cat = sheetRows(wb.getWorksheet("Categorías")!).find(
      (r) => r[0] === "Factores propios de la actividad"
    );
    expect(cat?.slice(1)).toEqual(
      ["4", "5", "20", "25", "33", "41.25", "20", "25", "3", "3.75", "56", "70", "23", "28.75", "80"]
    );
  });

  it("20. datos de prueba excluidos", () => {
    const agg = aggregate();
    expect(agg.population.testResultsIncluded).toBe(0);
    expect(agg.testContribution.rows).toBe(0);
    expect(agg.population.realResults).toBe(80);
  });
});
