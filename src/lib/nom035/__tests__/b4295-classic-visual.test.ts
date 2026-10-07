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
import { renderExecutiveCharts } from "../report-charts";
import { INTERPRETATION_LINES, levelTableRows } from "../report-interpretation";
import { auditXlsxVisualStructure } from "../xlsx-visual-audit";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import { AdminExecutiveSummaryPanel } from "@/components/admin/executive-summary-panel";
import {
  B429_RAW_DOMAIN_AVERAGES,
  buildB429ProductionLikeReport,
} from "./fixtures/b429-production-matrix";

const JORNADA = "Jornada de trabajo";
const JORNADA_CELLS = ["14 (17.5%)", "10 (12.5%)", "22 (27.5%)", "24 (30%)", "10 (12.5%)"];
const CATEGORY_AVERAGES = { "Ambiente de trabajo": 3.1, "Factores propios de la actividad": 30.4 };

function aggregate(): Nom035AggregateReport {
  return buildNom035AggregateReport(buildB429ProductionLikeReport(), { companyName: "Empresa Demo" });
}

function chartsPanel(agg: Nom035AggregateReport): string {
  return renderToStaticMarkup(
    createElement(AdminReportChartsPanel, {
      riskLevels: Object.fromEntries(agg.overallRiskDistribution.map((r) => [r.level, r.count])),
      categoryAverages: CATEGORY_AVERAGES,
      domainAverages: { ...B429_RAW_DOMAIN_AVERAGES },
      completion: { completed: 80, pending: 3, inProgress: 0 },
    })
  );
}

function fullPage(agg: Nom035AggregateReport): string {
  return renderToStaticMarkup(createElement(AdminExecutiveSummaryPanel, { aggregate: agg })) + chartsPanel(agg);
}

function listItem(html: string, label: string): string {
  const at = html.indexOf(`title="${label}"`);
  expect(at, label).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<li", at);
  return html.slice(start, html.indexOf("</li>", at) + 5);
}

function find(rows: NamedLevelMatrix[], name: string): NamedLevelMatrix {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(name);
  return row;
}

async function workbook(agg: Nom035AggregateReport) {
  const charts = await renderExecutiveCharts(agg);
  const buf = await buildFullReportXlsxBuffer({ report: buildB429ProductionLikeReport(), aggregate: agg, charts });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return { wb, buf };
}

function excelRow(sheet: ExcelJS.Worksheet, nameCol: number, name: string, firstLevelCol: number) {
  let found: ExcelJS.Row | null = null;
  sheet.eachRow((row) => {
    if (!found && row.getCell(nameCol).value === name) found = row;
  });
  expect(found, `${sheet.name}: ${name}`).not.toBeNull();
  const row = found as unknown as ExcelJS.Row;
  return Array.from({ length: 7 }, (_, i) => row.getCell(firstLevelCol + i));
}

describe("B4.29.5 presentación visual clásica (monocromática, sin marca en Jornada)", () => {
  it("1. cuatro paneles en el orden anterior", () => {
    const html = chartsPanel(aggregate());
    const titles = [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
    expect(titles).toEqual([
      "Distribución por nivel de riesgo",
      "Avance de evaluación",
      "Promedio por categoría",
      "Promedio por dominio",
    ]);
    const ids = ["chart-risk", "chart-completion", "chart-categories", "chart-domains"].map((id) =>
      html.indexOf(`data-testid="${id}"`)
    );
    expect(ids.every((i) => i > -1)).toBe(true);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it("2. barras monocromáticas: solo gris oscuro sobre gris claro, sin colores por nivel", () => {
    const html = chartsPanel(aggregate());
    const bars = [...html.matchAll(/class="h-2 rounded ([^"]+)"/g)].map((m) => m[1]);
    expect(bars.length).toBeGreaterThan(0);
    expect(new Set(bars)).toEqual(new Set(["bg-slate-100", "bg-slate-700"]));
    expect(html).not.toMatch(/background-color|#[0-9a-f]{6}/i);
    expect(html).not.toMatch(/\b(bg|text|border)-(amber|rose|red|emerald|green|sky|blue|yellow|orange)-/);
    const src = readFileSync("src/components/admin/report-charts-panel.tsx", "utf8");
    expect(src).not.toMatch(/RISK_CHART_HEX|backgroundColor|amber|predominant/i);
  });

  it("3. Jornada de trabajo se muestra como una barra más, sin marca especial", () => {
    const html = chartsPanel(aggregate());
    const jornada = listItem(html, JORNADA);
    const carga = listItem(html, "Carga de trabajo");
    expect(jornada).toContain(">2.86<");
    const shape = (li: string) =>
      li.replace(/title="[^"]*"|>[^<]*</g, "").replace(/style="[^"]*"/g, "");
    expect(shape(jornada)).toBe(shape(carga));
  });

  it("4. sin etiqueta «ALTO», sin columna «Predominante» y sin badge de nivel en la vista", () => {
    const html = fullPage(aggregate());
    expect(html).not.toMatch(/>ALTO<|>MUY ALTO<|>BAJO<|>MEDIO<|>NULO</);
    expect(html).not.toContain(">Predominante<");
    expect(html).not.toMatch(/Nivel predominante|data-predominant|predominant-level/);
    expect(html).not.toContain('data-testid="executive-domains-table"');
    expect(html).not.toContain('data-testid="executive-categories-table"');
  });

  it("5. Resultados usa el resumen clásico para las gráficas y el agregado solo para KPIs", () => {
    const page = readFileSync("src/app/admin/resultados/page.tsx", "utf8");
    expect(page).toMatch(/adminApi\.reportsSummary\(/);
    expect(page).toMatch(/adminApi\.reportsExecutive\(/);
    expect(page).toMatch(/<AdminExecutiveSummaryPanel aggregate=\{executive\}/);
    expect(page).toMatch(/domainAverages=\{reportSummary\.domainAverages\}/);
    expect(page).toMatch(/categoryAverages=\{reportSummary\.categoryAverages\}/);
  });

  it("6. Excel: tablas sin columna «Predominante» y sin relleno amarillo", async () => {
    const { wb } = await workbook(aggregate());
    for (const sheet of wb.worksheets) {
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          expect(cell.value, `${sheet.name}!${cell.address}`).not.toBe("Predominante");
          const argb = (cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;
          expect(argb, `${sheet.name}!${cell.address}`).not.toBe("FFFEF3C7");
        })
      );
    }
    const resumen = wb.getWorksheet("Resumen Ejecutivo")!;
    expect(excelRow(resumen, 1, JORNADA, 6).map((c) => c.value)).toEqual([...JORNADA_CELLS, 80, null]);
    const dominios = wb.getWorksheet("Dominios")!;
    const jornada = excelRow(dominios, 1, JORNADA, 3);
    expect(jornada.map((c) => c.value)).toEqual([...JORNADA_CELLS, 80, null]);
    expect(jornada.slice(0, 5).map((c) => Boolean(c.font?.bold))).toEqual([false, false, false, false, false]);
  });

  it("7. Excel: sin «ALTO» ni «Nivel predominante:» y Metodología sin regla de Predominante", async () => {
    const { wb, buf } = await workbook(aggregate());
    const all = wb.worksheets.map((s) => JSON.stringify(s.getSheetValues())).join("|");
    expect(all).not.toMatch(/Nivel predominante:|«Predominante»/);
    for (const name of ["Resumen Ejecutivo", "Categorías", "Dominios"]) {
      expect(JSON.stringify(wb.getWorksheet(name)!.getSheetValues()), name).not.toMatch(/"(NULO|BAJO|MEDIO|ALTO|MUY ALTO)"/);
    }
    expect(INTERPRETATION_LINES.join(" ")).not.toMatch(/Predominante|celda resaltada/);
    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.imagesBySheet["Resumen Ejecutivo"]).toBe(1);
    expect(audit.imagesBySheet["Categorías"]).toBe(1);
    expect(audit.imagesBySheet["Dominios"]).toBe(2);
  });

  it("8. filas de tabla solo con conteo (porcentaje) y total", () => {
    const [row] = levelTableRows([find(aggregate().domains, JORNADA)]);
    expect(row).toEqual({
      name: JORNADA,
      category: "Organización del tiempo de trabajo",
      cells: ["nulo", "bajo", "medio", "alto", "muy_alto"].map((level, i) => ({ level, text: JORNADA_CELLS[i] })),
      total: 80,
    });
  });

  it("9. datos sin modificar: conteos reales, test excluido, código de solo lectura", () => {
    const agg = aggregate();
    expect(agg.population.realResults).toBe(80);
    expect(agg.population.testResultsIncluded).toBe(0);
    expect(agg.overallRiskDistribution.map((r) => r.count)).toEqual([21, 25, 14, 12, 8]);
    const j = find(agg.domains, JORNADA);
    expect(["nulo", "bajo", "medio", "alto", "muy_alto"].map((l) => j.levels[l as "nulo"].count)).toEqual([
      14, 10, 22, 24, 10,
    ]);
    const mutation = /\.(insert|update|upsert|delete)\(|\b(insert\s+into|update\s+public\.|delete\s+from)\b/i;
    for (const file of [
      "src/components/admin/report-charts-panel.tsx",
      "src/lib/nom035/report-interpretation.ts",
      "src/lib/nom035/full-report-xlsx.ts",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(mutation);
    }
  });
});
