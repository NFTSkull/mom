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
import { LEVEL_UPPER_LABEL, levelTableRows, predominantLevelOf } from "../report-interpretation";
import { auditXlsxVisualStructure } from "../xlsx-visual-audit";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import { AdminExecutiveSummaryPanel } from "@/components/admin/executive-summary-panel";
import { buildB429ProductionLikeReport } from "./fixtures/b429-production-matrix";

const JORNADA = "Jornada de trabajo";
const JORNADA_CELLS = ["14 (17.5%)", "10 (12.5%)", "22 (27.5%)", "24 (30%)", "10 (12.5%)"];

function aggregate(report = buildB429ProductionLikeReport()): Nom035AggregateReport {
  return buildNom035AggregateReport(report, { companyName: "Empresa Demo" });
}

function renderResults(agg: Nom035AggregateReport): string {
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
  return rest.slice(0, rest.indexOf("</tr>"));
}

function cellTexts(row: string): string[] {
  return [...row.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]!);
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
  return { wb, buf };
}

/** Primera fila cuya celda `nameCol` es `name`: celdas Nulo…Predominante desde `firstLevelCol`. */
function excelTableRow(sheet: ExcelJS.Worksheet, nameCol: number, name: string, firstLevelCol: number) {
  let found: ExcelJS.Row | null = null;
  sheet.eachRow((row) => {
    if (!found && row.getCell(nameCol).value === name) found = row;
  });
  expect(found, `${sheet.name}: ${name}`).not.toBeNull();
  const row = found as unknown as ExcelJS.Row;
  return Array.from({ length: 7 }, (_, i) => row.getCell(firstLevelCol + i));
}

describe("B4.29.4 reporte tabular (conteo y porcentaje) con nivel predominante", () => {
  it("1–2. se renderizan las tablas de categorías y dominios con sus columnas", () => {
    const html = renderResults(aggregate());
    expect(html).toContain('data-testid="executive-categories-table"');
    expect(html).toContain('data-testid="executive-domains-table"');
    const heads = (testId: string) => {
      const t = html.slice(html.indexOf(`data-testid="${testId}"`));
      return [...t.slice(0, t.indexOf("</thead>")).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
    };
    expect(heads("executive-categories-table")).toEqual([
      "Categoría", "Nulo", "Bajo", "Medio", "Alto", "Muy alto", "Total", "Predominante",
    ]);
    expect(heads("executive-domains-table")).toEqual([
      "Dominio", "Categoría", "Nulo", "Bajo", "Medio", "Alto", "Muy alto", "Total", "Predominante",
    ]);
    expect(cellTexts(rowHtml(html, "executive-categories-table-row-ambiente-de-trabajo"))).toEqual([
      "Ambiente de trabajo", "48 (60%)", "23 (28.75%)", "7 (8.75%)", "2 (2.5%)", "0 (0%)", "80", "NULO",
    ]);
  });

  it("orden de pantalla: A distribución, B avance, C categorías, D dominios", () => {
    const html = renderResults(aggregate());
    const order = [
      'data-testid="chart-risk"',
      'data-testid="chart-completion"',
      'data-testid="executive-categories-table"',
      'data-testid="executive-domains-table"',
    ].map((m) => html.indexOf(m));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain(">Distribución por nivel de riesgo</h3>");
    expect(html).toContain(">Avance de evaluación</h3>");
  });

  it("3–4. fila Jornada de trabajo con conteos, porcentajes y total", () => {
    const html = renderResults(aggregate());
    const row = rowHtml(html, "executive-domains-table-row-jornada-de-trabajo");
    expect(cellTexts(row)).toEqual([
      JORNADA, "Organización del tiempo de trabajo", ...JORNADA_CELLS, "80", "ALTO",
    ]);
  });

  it("5. Jornada se interpreta como ALTO: celda Alto resaltada y columna Predominante", () => {
    const html = renderResults(aggregate());
    const row = rowHtml(html, "executive-domains-table-row-jornada-de-trabajo");
    const highlighted = [...row.matchAll(/<td data-level="([a-z_]+)" data-predominant="true"[^>]*>([^<]*)</g)];
    expect(highlighted.map((m) => [m[1], m[2]])).toEqual([["alto", "24 (30%)"]]);
    expect(row).toMatch(/bg-amber-100[^>]*>24 \(30%\)</);
    expect(row).toMatch(/data-testid="predominant-level" data-level="alto">ALTO</);
  });

  it("6–7. Jornada no aparece como BAJO ni como 2.86; sin promedios en la vista principal", () => {
    const html = renderResults(aggregate());
    const row = rowHtml(html, "executive-domains-table-row-jornada-de-trabajo");
    expect(row).not.toMatch(/>BAJO</);
    expect(row).not.toContain("2.86");
    expect(html).not.toContain("2.86");
    expect(html).not.toContain("21.74");
    expect(html).not.toMatch(/Promedio por (dominio|categor[ií]a)/i);
    expect(html).not.toMatch(/Medio\+|Alto\+/);
    for (const file of [
      "src/components/admin/report-charts-panel.tsx",
      "src/lib/nom035/report-interpretation.ts",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\.score\b|avgScore|domainAverages|categoryAverages/);
    }
  });

  it("regla: predominante = predominantLevelOf en todas las filas (empate → nivel menor)", () => {
    const agg = aggregate();
    for (const row of levelTableRows([...agg.categories, ...agg.domains])) {
      const src = find([...agg.categories, ...agg.domains], row.name);
      const top = predominantLevelOf(src.levels)!;
      expect(row.predominant?.label, row.name).toBe(LEVEL_UPPER_LABEL[top.level]);
      expect(row.cells.filter((c) => c.predominant).map((c) => c.level)).toEqual([top.level]);
    }
    expect(levelTableRows([find(agg.domains, "Carga de trabajo")])[0]!.predominant?.label).toBe("BAJO");

    const altered = structuredClone(agg);
    const j = find(altered.domains, JORNADA);
    j.levels.alto.count = 5;
    j.levels.muy_alto.count = 29;
    expect(levelTableRows([j])[0]!.predominant?.label).toBe("MUY ALTO");

    const report = buildB429ProductionLikeReport();
    const before = levelTableRows(aggregate(report).domains);
    for (const w of report.workers) {
      for (const k of Object.keys(w.domainScores)) {
        w.domainScores[k] = { ...w.domainScores[k]!, score: w.domainScores[k]!.score * 10 };
      }
    }
    expect(levelTableRows(aggregate(report).domains)).toEqual(before);
  });

  it("8–9. Excel: tablas en Resumen, Categorías y Dominios; Jornada = ALTO resaltado", async () => {
    const { wb, buf } = await workbook(aggregate());
    const PRED_FILL = "FFFEF3C7";
    const checkJornada = (cells: ExcelJS.Cell[]) => {
      expect(cells.map((c) => c.value)).toEqual([...JORNADA_CELLS, 80, "ALTO"]);
      const filled = cells
        .slice(0, 5)
        .map((c) => (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb === PRED_FILL);
      expect(filled).toEqual([false, false, false, true, false]);
      expect(cells[3]!.font?.bold).toBe(true);
      expect(cells[6]!.font?.bold).toBe(true);
    };

    const resumen = wb.getWorksheet("Resumen Ejecutivo")!;
    const resumenText = JSON.stringify(resumen.getSheetValues());
    expect(resumenText).toContain("RESULTADOS POR CATEGORÍA");
    expect(resumenText).toContain("RESULTADOS POR DOMINIO");
    checkJornada(excelTableRow(resumen, 1, JORNADA, 6));
    expect(excelTableRow(resumen, 1, "Ambiente de trabajo", 4).map((c) => c.value)).toEqual([
      "48 (60%)", "23 (28.75%)", "7 (8.75%)", "2 (2.5%)", "0 (0%)", 80, "NULO",
    ]);
    expect(resumenText).not.toMatch(/2\.86|21\.74|Nivel predominante:/);

    const dominios = wb.getWorksheet("Dominios")!;
    expect(dominios.getCell(1, 1).value).toMatch(/^RESULTADOS POR DOMINIO/);
    checkJornada(excelTableRow(dominios, 1, JORNADA, 3));

    const categorias = wb.getWorksheet("Categorías")!;
    expect(categorias.getCell(1, 1).value).toMatch(/^RESULTADOS POR CATEGORÍA/);
    const factores = excelTableRow(categorias, 1, "Factores propios de la actividad", 2);
    expect(factores.map((c) => c.value)).toEqual([
      "4 (5%)", "20 (25%)", "33 (41.25%)", "20 (25%)", "3 (3.75%)", 80, "MEDIO",
    ]);

    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.imagesBySheet["Resumen Ejecutivo"]).toBe(1);
    expect(audit.imagesBySheet["Categorías"]).toBe(1);
    expect(audit.imagesBySheet["Dominios"]).toBe(2);
    const metodo = JSON.stringify(wb.getWorksheet("Metodología")!.getSheetValues());
    expect(metodo).toMatch(/no son directamente comparables entre sí/);
    expect(metodo).toMatch(/columna «Predominante»/);
  });

  it("10. datos sin modificar: conteos reales, test excluido, código de solo lectura", () => {
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
