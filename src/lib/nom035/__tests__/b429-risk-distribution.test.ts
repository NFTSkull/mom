import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import {
  assertAggregateMath,
  buildNom035AggregateReport,
  computeLevelPlus,
  hasGuiaITraumaticEvent,
  levelMatrixInconsistency,
  type NamedLevelMatrix,
  type Nom035AggregateReport,
} from "../aggregate-report";
import { buildFullReportXlsxBuffer } from "../full-report-xlsx";
import { renderExecutiveCharts } from "../report-charts";
import { auditXlsxVisualStructure } from "../xlsx-visual-audit";
import {
  describeAltoPlus,
  describeMedioPlus,
  levelSegmentShares,
  NOM035_REPORT_PRESENTATION_VERSION,
} from "../report-interpretation";
import { RISK_LEVEL_ORDER } from "../risk-palette";
import {
  GUIA_III_DOMAIN_THRESHOLDS,
  GUIA_III_CATEGORY_THRESHOLDS,
} from "@/data/nom035/guia-iii-manifest";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import {
  AdminDistributionTables,
  AdminExecutiveSummaryPanel,
} from "@/components/admin/executive-summary-panel";
import {
  B429_CATEGORIES,
  B429_DOMAINS,
  B429_RAW_DOMAIN_AVERAGES,
  B429_REAL_RESULTS,
  buildB429ProductionLikeReport,
} from "./fixtures/b429-production-matrix";

const JORNADA = "Jornada de trabajo";
const ORG_TIEMPO = "Organización del tiempo de trabajo";

function aggregate(): Nom035AggregateReport {
  return buildNom035AggregateReport(buildB429ProductionLikeReport(), {
    companyName: "Empresa Demo",
  });
}

function find(rows: NamedLevelMatrix[], name: string): NamedLevelMatrix {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(`fila ${name} no encontrada`);
  return row;
}

function counts(row: NamedLevelMatrix): number[] {
  return RISK_LEVEL_ORDER.map((l) => row.levels[l].count);
}

function renderDashboard(agg: Nom035AggregateReport): string {
  return renderToStaticMarkup(
    createElement("div", null, [
      createElement(AdminExecutiveSummaryPanel, { key: "s", aggregate: agg }),
      createElement(AdminReportChartsPanel, { key: "c", aggregate: agg }),
      createElement(AdminDistributionTables, { key: "t", aggregate: agg }),
    ])
  );
}

async function buildWorkbook(agg: Nom035AggregateReport) {
  const report = buildB429ProductionLikeReport();
  const charts = await renderExecutiveCharts(agg);
  const buf = await buildFullReportXlsxBuffer({ report, aggregate: agg, charts });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return { buf, wb, charts };
}

function rowValues(sheet: ExcelJS.Worksheet, firstCell: string): unknown[] {
  let found: unknown[] = [];
  sheet.eachRow((row) => {
    if (String(row.getCell(1).value) === firstCell) {
      found = (row.values as unknown[]).slice(1);
    }
  });
  return found;
}

const sheetText = (sheet: ExcelJS.Worksheet | undefined) =>
  JSON.stringify(sheet?.getSheetValues() ?? []);

describe("B4.29 distribución por nivel como fuente principal de interpretación", () => {
  it("1. dashboard nuevo sin título visible «Promedio por categoría»", () => {
    const html = renderDashboard(aggregate());
    expect(html).not.toMatch(/Promedio por categor[ií]a/i);
    expect(html).toMatch(/Distribución de riesgo por categoría/);
  });

  it("2. dashboard nuevo sin título visible «Promedio por dominio»", () => {
    const html = renderDashboard(aggregate());
    expect(html).not.toMatch(/Promedio por dominio/i);
    expect(html).toMatch(/Distribución de riesgo por dominio/);
    for (const file of [
      "src/components/admin/report-charts-panel.tsx",
      "src/components/admin/executive-summary-panel.tsx",
      "src/app/admin/resultados/page.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/Promedio por (categor[ií]a|dominio)/i);
    }
  });

  it("3. cada categoría suma REAL_RESULTS", () => {
    const agg = aggregate();
    expect(agg.population.realResults).toBe(B429_REAL_RESULTS);
    for (const cat of agg.categories) {
      expect(counts(cat).reduce((a, b) => a + b, 0)).toBe(agg.population.realResults);
      expect(cat.total).toBe(agg.population.realResults);
    }
  });

  it("4. cada dominio suma REAL_RESULTS", () => {
    const agg = aggregate();
    for (const dom of agg.domains) {
      expect(counts(dom).reduce((a, b) => a + b, 0)).toBe(agg.population.realResults);
      expect(dom.total).toBe(agg.population.realResults);
    }
  });

  it("5. porcentajes por fila suman ~100", () => {
    const agg = aggregate();
    for (const row of [...agg.categories, ...agg.domains]) {
      const sum = RISK_LEVEL_ORDER.reduce((a, l) => a + row.levels[l].percentage, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.2);
      expect(levelMatrixInconsistency(row, agg.population.realResults)).toBeNull();
    }
    expect(assertAggregateMath(agg)).toEqual({ ok: true });
  });

  it("6. Medio+ = medio + alto + muy_alto", () => {
    const agg = aggregate();
    for (const row of [...agg.categories, ...agg.domains]) {
      const l = row.levels;
      expect(row.medioPlus.count).toBe(l.medio.count + l.alto.count + l.muy_alto.count);
    }
  });

  it("7. Alto+ = alto + muy_alto", () => {
    const agg = aggregate();
    for (const row of [...agg.categories, ...agg.domains]) {
      expect(row.altoPlus.count).toBe(row.levels.alto.count + row.levels.muy_alto.count);
    }
    const bad = { ...find(agg.domains, JORNADA), altoPlus: { count: 1, percentage: 1 } };
    expect(levelMatrixInconsistency(bad, 80)).toMatch(/Alto\+/);
  });

  it("8. control Jornada de trabajo (regresión productiva)", () => {
    const jornada = find(aggregate().domains, JORNADA);
    expect(counts(jornada)).toEqual([14, 10, 22, 24, 10]);
    expect(jornada.total).toBe(80);
    expect(jornada.medioPlus).toEqual({ count: 56, percentage: 70 });
    expect(jornada.altoPlus).toEqual({ count: 34, percentage: 42.5 });
    expect(RISK_LEVEL_ORDER.map((l) => jornada.levels[l].percentage)).toEqual([
      17.5, 12.5, 27.5, 30, 12.5,
    ]);
    expect(computeLevelPlus(jornada.levels, 80)).toEqual({
      medioPlus: { count: 56, percentage: 70 },
      altoPlus: { count: 34, percentage: 42.5 },
    });
  });

  it("8b. avgScore 2.86 NO determina la longitud relativa en el dashboard", () => {
    const report = buildB429ProductionLikeReport();
    const avg = (name: string) =>
      report.workers.reduce((a, w) => a + w.domainScores[name]!.score, 0) /
      report.workers.length;
    expect(Math.round(avg(JORNADA) * 100) / 100).toBe(B429_RAW_DOMAIN_AVERAGES[JORNADA]);
    expect(Math.round(avg("Carga de trabajo") * 100) / 100).toBe(
      B429_RAW_DOMAIN_AVERAGES["Carga de trabajo"]
    );

    const agg = buildNom035AggregateReport(report);
    const jornada = find(agg.domains, JORNADA);
    const shares = levelSegmentShares(jornada.levels, jornada.total);
    expect(shares).toEqual({ nulo: 14 / 80, bajo: 10 / 80, medio: 22 / 80, alto: 24 / 80, muy_alto: 10 / 80 });

    // Puntajes brutos multiplicados ×10: la distribución y el ranking no cambian.
    for (const w of report.workers) {
      w.domainScores[JORNADA] = { ...w.domainScores[JORNADA]!, score: w.domainScores[JORNADA]!.score * 10 };
    }
    const agg2 = buildNom035AggregateReport(report);
    expect(find(agg2.domains, JORNADA)).toEqual(jornada);

    // Jornada (promedio bruto 2.86) encabeza Alto+ por encima de Carga (21.74).
    expect(agg.topDomainsHighRisk[0]).toMatchObject({
      name: JORNADA,
      count: 34,
      total: 80,
      percentage: 42.5,
    });
    const html = renderDashboard(agg);
    expect(html).not.toContain("2.86");
    expect(html).not.toContain("21.74");
    expect(readFileSync("src/components/admin/report-charts-panel.tsx", "utf8")).not.toMatch(
      /\.score\b|domainAverages|categoryAverages/
    );
  });

  it("9. categoría Organización del tiempo separada del dominio Jornada", () => {
    const agg = aggregate();
    const cat = find(agg.categories, ORG_TIEMPO);
    expect(counts(cat)).toEqual([26, 13, 21, 18, 2]);
    expect(cat.medioPlus).toEqual({ count: 41, percentage: 51.25 });
    expect(cat.altoPlus).toEqual({ count: 20, percentage: 25 });
    expect(agg.categories.map((c) => c.name)).not.toContain(JORNADA);
    expect(agg.domains.map((d) => d.name)).not.toContain(ORG_TIEMPO);
    expect(find(agg.domains, JORNADA).category).toBe(ORG_TIEMPO);
    expect(counts(find(agg.domains, JORNADA))).not.toEqual(counts(cat));
    const html = renderDashboard(agg);
    expect(html).toContain('data-testid="chart-category-distribution"');
    expect(html).toContain('data-testid="chart-domain-distribution"');
  });

  it("10. test excluido de métricas", () => {
    const agg = aggregate();
    expect(agg.population.testResultsIncluded).toBe(0);
    expect(agg.testContribution.rows).toBe(0);
  });

  it("11. ATS intacto (Guía I)", () => {
    const report = buildB429ProductionLikeReport();
    const agg = buildNom035AggregateReport(report);
    expect(agg.traumaticEvent.yes).toBe(2);
    expect(agg.traumaticEvent.yes + agg.traumaticEvent.no).toBe(agg.traumaticEvent.denominator);
    expect(hasGuiaITraumaticEvent(report.workers[0]!.answers)).toBe(true);
  });

  it("12. valoración clínica intacta (Guía I)", () => {
    const agg = aggregate();
    expect(agg.clinicalAttention.yes).toBe(1);
    expect(agg.clinicalAttention.yes + agg.clinicalAttention.no).toBe(
      agg.clinicalAttention.denominator
    );
  });

  it("13. Excel no contiene gráficas/títulos legacy de promedios", async () => {
    const agg = aggregate();
    const { wb, charts } = await buildWorkbook(agg);
    const all = wb.worksheets.map((s) => sheetText(s)).join("|");
    expect(all).not.toMatch(/Promedio por (categor[ií]a|dominio)/i);
    expect(Object.keys(charts)).not.toContain("categoryAverages");
    expect(Object.keys(charts)).not.toContain("domainAverages");
    const src = readFileSync("src/lib/nom035/report-charts.ts", "utf8");
    expect(src).not.toMatch(/Promedio por/);
    expect(src).not.toMatch(/renderAggregateCharts/);
  });

  it("14. Excel contiene distribución por categoría (gráfica + tabla Medio+/Alto+)", async () => {
    const agg = aggregate();
    const { buf, wb } = await buildWorkbook(agg);
    const sheet = wb.getWorksheet("Categorías")!;
    expect(sheetText(sheet)).toMatch(/DISTRIBUCIÓN DE RIESGO POR CATEGORÍA/);
    const header = rowValues(sheet, "Categoría");
    expect(header).toEqual([
      "Categoría",
      "Nulo #", "Nulo %", "Bajo #", "Bajo %", "Medio #", "Medio %",
      "Alto #", "Alto %", "Muy alto #", "Muy alto %",
      "Medio+ #", "Medio+ %", "Alto+ #", "Alto+ %", "Total",
    ]);
    expect(rowValues(sheet, "Factores propios de la actividad")).toEqual([
      "Factores propios de la actividad",
      4, 5, 20, 25, 33, 41.25, 20, 25, 3, 3.75, 56, 70, 23, 28.75, 80,
    ]);
    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.imagesBySheet["Categorías"] ?? 0).toBeGreaterThanOrEqual(1);
    const cats = audit.sheets.find((s) => s.sheetName === "Categorías");
    expect(cats?.anchors[0]?.fromRow).toBeLessThan(10);
  });

  it("15. Excel contiene distribución por dominio (gráficas 1/2 y 2/2 + tabla)", async () => {
    const agg = aggregate();
    const { buf, wb } = await buildWorkbook(agg);
    const sheet = wb.getWorksheet("Dominios")!;
    expect(rowValues(sheet, "Dominio").slice(0, 2)).toEqual(["Dominio", "Categoría"]);
    expect(rowValues(sheet, JORNADA)).toEqual([
      JORNADA, ORG_TIEMPO,
      14, 17.5, 10, 12.5, 22, 27.5, 24, 30, 10, 12.5, 56, 70, 34, 42.5, 80,
    ]);
    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.imagesBySheet["Dominios"] ?? 0).toBeGreaterThanOrEqual(2);
    expect(audit.visibleInkFlags.every(Boolean)).toBe(true);

    const resumen = sheetText(wb.getWorksheet("Resumen Ejecutivo"));
    expect(resumen).toMatch(/LECTURA PRIORITARIA/);
    expect(resumen).toMatch(/DOMINIO CON MAYOR ALTO\+/);
    expect(resumen).toContain("Jornada de trabajo\\n34/80\\n42.5%");
    expect(resumen).toContain("Factores propios de la actividad\\n56/80\\n70%");
    expect(resumen).toMatch(/DOMINIOS CON MAYOR PROPORCIÓN ALTO \/ MUY ALTO/);
    expect(resumen).toMatch(/CATEGORÍAS CON MAYOR PROPORCIÓN MEDIO O SUPERIOR/);
    expect(resumen).toMatch(new RegExp(`VERSIÓN DE REPORTE: ${NOM035_REPORT_PRESENTATION_VERSION}`));
    expect(resumen).toMatch(/GENERADO: /);
    expect(resumen).not.toMatch(/2\.86|21\.74/);

    const metodo = sheetText(wb.getWorksheet("Metodología"));
    expect(metodo).toMatch(/CÓMO INTERPRETAR/);
    expect(metodo).toMatch(/no son directamente comparables entre sí/);
    expect(metodo).toMatch(/Medio\+ representa trabajadores clasificados en Medio, Alto o Muy alto/);
    expect(metodo).toMatch(/Alto\+ representa trabajadores clasificados en Alto o Muy alto/);
    expect(metodo).toMatch(/No representan nuevos niveles oficiales de la NOM-035/);
    expect(metodo).toMatch(/70% del personal se encuentra en nivel Medio, Alto o Muy alto en este dominio/);
  });

  it("16. UI usa el agregado ejecutivo como fuente", () => {
    const page = readFileSync("src/app/admin/resultados/page.tsx", "utf8");
    expect(page).toMatch(/reportsExecutive/);
    expect(page).not.toMatch(/reportsSummary/);
    expect(page).not.toMatch(/categoryAverages|domainAverages/);
    expect(page).toMatch(/<AdminReportChartsPanel aggregate=\{executive\}/);
    const reportes = readFileSync("src/app/admin/reportes/page.tsx", "utf8");
    expect(reportes).toMatch(/topDomainsHighRisk/);
    expect(reportes).not.toMatch(/domainAverages \?\? \{\}\)\s*\n?\s*\.sort/);
    expect(reportes).toMatch(/RAW_AVERAGE_WARNING/);
  });

  it("17. scoring/thresholds sin modificar", () => {
    expect(GUIA_III_DOMAIN_THRESHOLDS[JORNADA]).toEqual({ bajoMin: 1, medioMin: 2, altoMin: 4, muyAltoMin: 6 });
    expect(GUIA_III_DOMAIN_THRESHOLDS["Carga de trabajo"]).toEqual({
      bajoMin: 15, medioMin: 21, altoMin: 27, muyAltoMin: 37,
    });
    expect(Object.keys(GUIA_III_CATEGORY_THRESHOLDS)).toEqual(Object.keys(B429_CATEGORIES));
    expect(Object.keys(GUIA_III_DOMAIN_THRESHOLDS)).toEqual(Object.keys(B429_DOMAINS));
    for (const file of [
      "src/lib/nom035/aggregate-report.ts",
      "src/lib/nom035/report-charts.ts",
      "src/lib/nom035/full-report-xlsx.ts",
      "src/lib/nom035/report-interpretation.ts",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/scoring-engine|calculate.*Score\(/);
    }
  });

  it("18-20. answers/results/workers sin modificar (código read-only, sin migración)", () => {
    const mutation = /\.(insert|update|upsert|delete)\(|\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table)\b/i;
    for (const file of [
      "src/lib/nom035/aggregate-report.ts",
      "src/lib/nom035/report-charts.ts",
      "src/lib/nom035/full-report-xlsx.ts",
      "src/lib/nom035/report-interpretation.ts",
      "src/components/admin/report-charts-panel.tsx",
      "src/components/admin/executive-summary-panel.tsx",
      "scripts/b429-audit-distributions.ts",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(mutation);
    }
    expect(readFileSync("scripts/b429-audit-distributions.ts", "utf8")).toMatch(
      /begin transaction read only/
    );
    const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    expect(migrations.at(-1)).toBe("015_result_sort.sql");
  });

  it("redacción descriptiva: nunca «X% de riesgo»", () => {
    expect(describeMedioPlus(70, "dominio")).toBe(
      "70% del personal se encuentra en nivel Medio, Alto o Muy alto en este dominio."
    );
    expect(describeAltoPlus(42.5, "dominio")).toBe(
      "42.5% del personal se encuentra en nivel Alto o Muy alto en este dominio."
    );
    const agg = aggregate();
    const blob = JSON.stringify(agg) + renderDashboard(agg);
    expect(blob).not.toMatch(/\d+(\.\d+)?% de riesgo/i);
    expect(blob).not.toMatch(/46\.04/);
    expect(agg.predominantRisk.metricKind).toBe("predominant_risk");
  });

  it("lectura prioritaria y rankings ordenados por porcentaje", () => {
    const agg = aggregate();
    expect(agg.priorityReading.domainHighestAltoPlus).toMatchObject({
      name: JORNADA, count: 34, total: 80, percentage: 42.5,
    });
    expect(agg.priorityReading.categoryHighestMedioPlus).toMatchObject({
      name: "Factores propios de la actividad", count: 56, total: 80, percentage: 70,
    });
    const factores = agg.categoriesPriority[0]!;
    expect(factores.name).toBe("Factores propios de la actividad");
    expect(factores.medioPlus).toEqual({ count: 56, percentage: 70 });
    expect(factores.altoPlus).toEqual({ count: 23, percentage: 28.75 });
    const pcts = agg.topDomainsHighRisk.map((d) => d.percentage);
    expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
    expect(agg.presentationVersion).toBe("B4.29");
  });

  it("UI muestra Medio+/Alto+ de Jornada y nota de interpretación", () => {
    const html = renderDashboard(aggregate());
    expect(html).toMatch(/Medio\+:<\/span> 56 \/ 80 · <!-- -->70%|Medio\+:<\/span> 56 \/ 80 · 70%/);
    expect(html).toContain("A. Distribución general de riesgo");
    expect(html).toContain("B. Avance de evaluación");
    expect(html).toContain("C. Distribución de riesgo por categoría");
    expect(html).toContain("D. Distribución de riesgo por dominio");
    expect(html).toContain(
      "Los dominios se interpretan por la distribución de trabajadores en cada nivel de riesgo; los puntajes brutos de dominios distintos no se comparan directamente."
    );
    expect(html).toContain("34 de 80 · 42.5% Alto/Muy alto");
  });

  it("reporte individual muestra nivel junto al puntaje en gráficas", () => {
    const src = readFileSync("src/lib/nom035/server/individual-report-service.ts", "utf8");
    expect(src).toMatch(/withLevel\(k, v\.riskLevel\)/);
    expect(src).toMatch(/riskChartHex\(v\.riskLevel\)/);
  });
});
