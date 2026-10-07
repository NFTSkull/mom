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
import * as interpretation from "../report-interpretation";
import { auditXlsxVisualStructure } from "../xlsx-visual-audit";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import { AdminExecutiveSummaryPanel } from "@/components/admin/executive-summary-panel";
import { B429_DOMAINS, buildB429ProductionLikeReport } from "./fixtures/b429-production-matrix";

const JORNADA = "Jornada de trabajo";
const LEVEL_WORDS = /\b(NULO|BAJO|MEDIO|ALTO|MUY ALTO)\b/;

function aggregate(report = buildB429ProductionLikeReport()): Nom035AggregateReport {
  return buildNom035AggregateReport(report, { companyName: "Empresa Demo" });
}

function page(agg: Nom035AggregateReport): string {
  return renderToStaticMarkup(
    createElement("div", null, [
      createElement(AdminExecutiveSummaryPanel, { key: "s", aggregate: agg }),
      createElement(AdminReportChartsPanel, { key: "c", aggregate: agg }),
    ])
  );
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function chartRow(html: string, panel: string, name: string): string {
  const marker = `data-testid="${panel}-row-${slug(name)}"`;
  const start = html.indexOf(marker);
  expect(start, name).toBeGreaterThan(-1);
  const rest = html.slice(start);
  return rest.slice(0, rest.indexOf("</li>"));
}

function shareText(row: string): string {
  return [...row.matchAll(/<span data-level="[a-z_]+">(?:<!-- -->)?([^<]*)(?:<!-- -->)?([^<]*)<\/span>/g)]
    .map((m) => `${m[1]}${m[2]}`)
    .join("");
}

function find(rows: NamedLevelMatrix[], name: string): NamedLevelMatrix {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(name);
  return row;
}

describe("B4.29.6 dominios y categorías muestran Medio / Alto / Muy alto sin etiqueta única", () => {
  it("1. ningún dominio ni categoría se marca con un nivel único (NULO, BAJO, …)", () => {
    const html = page(aggregate());
    for (const panel of ["chart-domains", "chart-categories"]) {
      const start = html.indexOf(`data-testid="${panel}"`);
      const block = html.slice(start, html.indexOf("<details", start));
      expect(block, panel).not.toMatch(LEVEL_WORDS);
      expect(block, panel).not.toMatch(/predominante/i);
    }
    expect(html).not.toMatch(/Nivel predominante|>Predominante<|data-predominant/);
  });

  it("2–3. Jornada sin badge ALTO y sin 2.86", () => {
    const html = page(aggregate());
    const row = chartRow(html, "chart-domains", JORNADA);
    expect(row).not.toMatch(LEVEL_WORDS);
    expect(html).not.toContain("2.86");
    expect(html).not.toContain("21.74");
    expect(html).not.toMatch(/Promedio por (dominio|categor[ií]a)/i);
  });

  it("4. Jornada muestra Medio 27.5%, Alto 30% y Muy alto 12.5%", () => {
    const row = chartRow(page(aggregate()), "chart-domains", JORNADA);
    expect(shareText(row)).toBe("Medio: 27.5% · Alto: 30% · Muy alto: 12.5%");
    expect([...row.matchAll(/width:(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]))).toEqual([27.5, 30, 12.5]);
  });

  it("5. Liderazgo muestra Medio 10%, Alto 6.25% y Muy alto 13.75%", () => {
    const row = chartRow(page(aggregate()), "chart-domains", "Liderazgo");
    expect(shareText(row)).toBe("Medio: 10% · Alto: 6.25% · Muy alto: 13.75%");
  });

  it("6. todos los dominios y categorías muestran sus tres porcentajes desde levels", () => {
    const agg = aggregate();
    const html = page(agg);
    expect(agg.domains.map((d) => d.name)).toEqual(Object.keys(B429_DOMAINS));
    for (const [panel, rows] of [
      ["chart-domains", agg.domains],
      ["chart-categories", agg.categories],
    ] as const) {
      for (const r of rows) {
        const expected = `Medio: ${r.levels.medio.percentage}% · Alto: ${r.levels.alto.percentage}% · Muy alto: ${r.levels.muy_alto.percentage}%`;
        expect(shareText(chartRow(html, panel, r.name)), r.name).toBe(expected);
      }
    }
  });

  it("7. la tabla completa conserva Nulo, Bajo, Medio, Alto, Muy alto y Total", () => {
    const html = page(aggregate());
    const start = html.indexOf('data-testid="chart-domains-table"');
    const heads = [...html.slice(start, html.indexOf("</thead>", start)).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(
      (m) => m[1]
    );
    expect(heads).toEqual(["Dominio", "Nulo", "Bajo", "Medio", "Alto", "Muy alto", "Total"]);
    const row = html.slice(html.indexOf('data-testid="chart-domains-table-row-jornada-de-trabajo"'));
    const cells = [...row.slice(0, row.indexOf("</tr>")).matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(cells).toEqual([JORNADA, "14 (17.5%)", "10 (12.5%)", "22 (27.5%)", "24 (30%)", "10 (12.5%)", "80"]);
  });

  it("regla: sin predominantLevelOf, sin promedios brutos y Nulo no se destaca", () => {
    expect("predominantLevelOf" in interpretation).toBe(false);
    for (const file of ["src/components/admin/report-charts-panel.tsx", "src/lib/nom035/report-interpretation.ts"]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/predominantLevelOf|\.score\b|avgScore|domainAverages|categoryAverages/);
    }
    const html = page(aggregate());
    const row = chartRow(html, "chart-domains", "Relaciones en el trabajo");
    expect(row).not.toMatch(/data-level="(nulo|bajo)"/);

    const report = buildB429ProductionLikeReport();
    const before = interpretation.riskShareRows(aggregate(report).domains);
    for (const w of report.workers) {
      for (const k of Object.keys(w.domainScores)) {
        w.domainScores[k] = { ...w.domainScores[k]!, score: w.domainScores[k]!.score * 10 };
      }
    }
    expect(interpretation.riskShareRows(aggregate(report).domains)).toEqual(before);
  });

  it("Excel: tablas completas sin «Predominante», sin resaltado y sin nivel único por fila", async () => {
    const agg = aggregate();
    const charts = await renderExecutiveCharts(agg);
    const buf = await buildFullReportXlsxBuffer({ report: buildB429ProductionLikeReport(), aggregate: agg, charts });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    for (const sheet of wb.worksheets) {
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          expect(cell.value, `${sheet.name}!${cell.address}`).not.toBe("Predominante");
          expect((cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb).not.toBe("FFFEF3C7");
        })
      );
    }
    for (const name of ["Resumen Ejecutivo", "Categorías", "Dominios"]) {
      expect(JSON.stringify(wb.getWorksheet(name)!.getSheetValues()), name).not.toMatch(
        /"(NULO|BAJO|MEDIO|ALTO|MUY ALTO)"|Nivel predominante:|2\.86/
      );
    }
    let jornada: ExcelJS.Row | null = null;
    wb.getWorksheet("Dominios")!.eachRow((row) => {
      if (!jornada && row.getCell(1).value === JORNADA) jornada = row;
    });
    const j = jornada as unknown as ExcelJS.Row;
    expect(Array.from({ length: 6 }, (_, i) => j.getCell(3 + i).value)).toEqual([
      "14 (17.5%)", "10 (12.5%)", "22 (27.5%)", "24 (30%)", "10 (12.5%)", 80,
    ]);
    expect(interpretation.INTERPRETATION_LINES.join(" ")).not.toMatch(/Predominante|celda resaltada/);
    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.imagesBySheet["Dominios"]).toBe(2);
  });

  it("8. datos sin modificar: 80 resultados, test excluido, código de solo lectura", () => {
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
