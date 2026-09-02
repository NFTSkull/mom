import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import {
  assertAggregateMath,
  aggregateContainsGuiaIILabel,
  buildNom035AggregateReport,
  GUIA_III_CATEGORY_ORDER,
  GUIA_III_DOMAIN_ORDER,
  hasGuiaITraumaticEvent,
  NOM035_REPORT_MODEL_LABEL,
} from "../aggregate-report";
import {
  assertFullReportCounts,
  assertReportPayloadHasNoSecrets,
  buildChartDatasets,
  FULL_REPORT_FILENAME,
  individualReportFilename,
  normalizeFullReportPayload,
  type ReportWorkerRow,
} from "../report-data";
import { buildFullReportXlsxBuffer, FULL_REPORT_SHEETS } from "../full-report-xlsx";
import {
  buildIndividualReportXlsxBuffer,
  INDIVIDUAL_REPORT_SHEETS,
} from "../individual-report-xlsx";
import { isLikelyPng, renderExecutiveCharts, renderIndividualCharts } from "../report-charts";
import { isLikelyXlsx } from "../avance-excel-xlsx";
import { findEndpointPermission } from "../auth/endpoint-permissions";
import { RISK_CHART_HEX, RISK_EXCEL_ARGB } from "../risk-palette";
import type { RiskLevelNom035 } from "@/types/nom035";

function fullScores(level: RiskLevelNom035 = "bajo"): {
  categoryScores: ReportWorkerRow["categoryScores"];
  domainScores: ReportWorkerRow["domainScores"];
} {
  const categoryScores: ReportWorkerRow["categoryScores"] = {};
  for (const name of GUIA_III_CATEGORY_ORDER) {
    categoryScores[name] = { score: 5, riskLevel: level };
  }
  const domainScores: ReportWorkerRow["domainScores"] = {};
  for (const name of GUIA_III_DOMAIN_ORDER) {
    domainScores[name] = { score: 5, riskLevel: level };
  }
  return { categoryScores, domainScores };
}

function sampleWorker(
  overrides: Partial<ReportWorkerRow> = {}
): ReportWorkerRow {
  const scores = fullScores("medio");
  return {
    resultId: "r-001",
    username: "001",
    nombre: "Trabajador Uno",
    puesto: "Operador",
    departamento: "Planta",
    status: "completed",
    startedAt: "2026-08-01T10:00:00.000Z",
    completedAt: "2026-08-02T12:00:00.000Z",
    guiaIStatus: "submitted",
    guiaIIIStatus: "submitted",
    finalScore: 77.5,
    finalRiskLevel: "medio",
    ...scores,
    guiaIRequiresClinicalAttention: false,
    guiaIRiskLabel: "sin_alerta",
    scoringVersion: "nom035-stps-2018-guia-i-iii-v1",
    questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
    answers: [
      {
        questionnaireCode: "GUIA_I",
        questionId: "guia_i_1",
        answerText: null,
        answerValue: "no",
      },
      {
        questionnaireCode: "GUIA_III",
        questionId: "guia_iii_1",
        answerText: null,
        answerValue: "nunca",
      },
    ],
    ...overrides,
  };
}

function sampleReport(completed = 2) {
  const workers = [
    sampleWorker({
      username: "001",
      nombre: "A",
      finalRiskLevel: "bajo",
      ...fullScores("bajo"),
    }),
    sampleWorker({
      username: "083",
      nombre: "B",
      resultId: "r-083",
      finalRiskLevel: "alto",
      ...fullScores("alto"),
      answers: [
        {
          questionnaireCode: "GUIA_I",
          questionId: "guia_i_1",
          answerText: null,
          answerValue: "si",
        },
      ],
      guiaIRequiresClinicalAttention: true,
    }),
  ].slice(0, completed);

  const riskDistribution = {
    nulo: 0,
    bajo: workers.filter((w) => w.finalRiskLevel === "bajo").length,
    medio: workers.filter((w) => w.finalRiskLevel === "medio").length,
    alto: workers.filter((w) => w.finalRiskLevel === "alto").length,
    muy_alto: workers.filter((w) => w.finalRiskLevel === "muy_alto").length,
  };

  return normalizeFullReportPayload({
    ok: true,
    generatedAt: "2026-08-26T20:00:00.000Z",
    campaign: { nombre: "Evaluación NOM-035 2026", status: "closed" },
    counts: {
      realWorkers: 83,
      realCompleted: completed,
      realPending: 83 - completed,
      realInProgress: 0,
      realResults: completed,
      testWorkers: 1,
      testResultsStored: 1,
      testResultsIncluded: 0,
      guiaICompleted: completed,
      guiaIIICompleted: completed,
      guiaIICompleted: 0,
    },
    riskDistribution,
    categoryAverages: { "Ambiente de trabajo": 5 },
    domainAverages: { "Condiciones en el ambiente de trabajo": 5 },
    workers,
  })!;
}

async function readSheetNames(buf: Uint8Array): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return wb.worksheets.map((s) => s.name);
}

describe("B4.26 rediseño ejecutivo NOM-035", () => {
  it("1. modelo muestra Guía I + III", () => {
    const agg = buildNom035AggregateReport(sampleReport(2), {
      companyName: "Empresa Demo",
    });
    expect(agg.modelLabel).toBe(NOM035_REPORT_MODEL_LABEL);
    expect(agg.model).toBe("GUIA_I_Y_III");
  });

  it("2. nunca muestra Guía II en reporte real", async () => {
    const report = sampleReport(2);
    const agg = buildNom035AggregateReport(report, { companyName: "X" });
    const charts = await renderExecutiveCharts(agg);
    const buf = await buildFullReportXlsxBuffer({ report, aggregate: agg, charts });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const blob = JSON.stringify(
      wb.worksheets.map((s) => ({
        name: s.name,
        values: s.getSheetValues(),
      }))
    );
    expect(aggregateContainsGuiaIILabel(blob)).toBe(false);
    expect(blob.toLowerCase()).not.toMatch(/gu[ií]a ii(?!i)/);
  });

  it("3. personal evaluado = REAL_COMPLETED", () => {
    const agg = buildNom035AggregateReport(sampleReport(2));
    expect(agg.population.realCompleted).toBe(2);
  });

  it("4. test excluded", () => {
    const agg = buildNom035AggregateReport(sampleReport(2));
    expect(agg.population.testResultsIncluded).toBe(0);
    expect(agg.testContribution.rows).toBe(0);
  });

  it("5-6. final risk counts/percentages", () => {
    const agg = buildNom035AggregateReport(sampleReport(2));
    const sum = agg.overallRiskDistribution.reduce((a, b) => a + b.count, 0);
    const pct = agg.overallRiskDistribution.reduce((a, b) => a + b.percentage, 0);
    expect(sum).toBe(agg.population.realResults);
    expect(Math.abs(pct - 100)).toBeLessThan(0.2);
  });

  it("7-8. cada categoría/dominio suma REAL_RESULTS", () => {
    const agg = buildNom035AggregateReport(sampleReport(2));
    for (const cat of agg.categories) {
      expect(cat.total).toBe(agg.population.realResults);
    }
    for (const dom of agg.domains) {
      expect(dom.total).toBe(agg.population.realResults);
    }
    expect(assertAggregateMath(agg).ok).toBe(true);
  });

  it("9-10. ATS y clinical attention", () => {
    const agg = buildNom035AggregateReport(sampleReport(2));
    expect(agg.traumaticEvent.yes + agg.traumaticEvent.no).toBe(
      agg.traumaticEvent.denominator
    );
    expect(agg.clinicalAttention.yes).toBe(1);
    expect(agg.traumaticEvent.yes).toBe(1);
    expect(
      hasGuiaITraumaticEvent(sampleReport(2).workers[1]!.answers)
    ).toBe(true);
  });

  it("11-12. top domains/categories ordenados", () => {
    const report = sampleReport(2);
    // Fuerza concentración en un dominio
    report.workers[0]!.domainScores["Carga de trabajo"] = {
      score: 40,
      riskLevel: "muy_alto",
    };
    report.workers[1]!.domainScores["Carga de trabajo"] = {
      score: 40,
      riskLevel: "alto",
    };
    report.workers[0]!.categoryScores["Factores propios de la actividad"] = {
      score: 50,
      riskLevel: "medio",
    };
    report.workers[1]!.categoryScores["Factores propios de la actividad"] = {
      score: 50,
      riskLevel: "alto",
    };
    const agg = buildNom035AggregateReport(report);
    expect(agg.topDomainsHighRisk[0]?.name).toBe("Carga de trabajo");
    expect(agg.topDomainsHighRisk[0]?.count).toBe(2);
    expect(agg.topCategoriesMediumPlus[0]?.name).toBe(
      "Factores propios de la actividad"
    );
  });

  it("13. no inventa aggregate risk percentage", () => {
    const agg = buildNom035AggregateReport(sampleReport(2));
    expect(agg.predominantRisk.metricKind).toBe("predominant_risk");
    expect(JSON.stringify(agg)).not.toMatch(/46\.04/);
    expect(JSON.stringify(agg)).not.toMatch(/"% de riesgo"/i);
  });

  it("14. snapshot sigue fuente primaria", () => {
    const report = sampleReport(1);
    expect(report.workers[0]!.categoryScores["Ambiente de trabajo"]?.score).toBe(5);
    expect(assertFullReportCounts(report).ok).toBe(true);
  });

  it("15. Guía III labels del manifest", () => {
    const agg = buildNom035AggregateReport(sampleReport(1));
    expect(agg.categories.map((c) => c.name)).toEqual(GUIA_III_CATEGORY_ORDER);
    expect(agg.domains.map((d) => d.name)).toEqual(GUIA_III_DOMAIN_ORDER);
    expect(agg.categories).toHaveLength(5);
    expect(agg.domains).toHaveLength(10);
  });

  it("16-21. Excel hojas clave", async () => {
    const report = sampleReport(2);
    const agg = buildNom035AggregateReport(report, { companyName: "Empresa Demo" });
    const charts = await renderExecutiveCharts(agg);
    const buf = await buildFullReportXlsxBuffer({ report, aggregate: agg, charts });
    expect(isLikelyXlsx(buf)).toBe(true);
    const names = await readSheetNames(buf);
    for (const sheet of FULL_REPORT_SHEETS) {
      expect(names).toContain(sheet);
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const ejecutivo = wb.getWorksheet("Resumen Ejecutivo");
    expect(String(ejecutivo?.getCell(1, 1).value)).toMatch(/RESULTADOS NOM-035 2026/);
    expect(String(ejecutivo?.getCell(2, 1).value)).toBe("Empresa Demo");
    expect(wb.getWorksheet("Categorías")).toBeTruthy();
    expect(wb.getWorksheet("Dominios")).toBeTruthy();
    expect(wb.getWorksheet("Acontecimiento Traumático")).toBeTruthy();
    expect(wb.getWorksheet("Datos para Gráficas")).toBeTruthy();
    expect(wb.getWorksheet("Metodología")).toBeTruthy();
    const metodo = wb.getWorksheet("Metodología");
    const metodoText = JSON.stringify(metodo?.getSheetValues() ?? []);
    expect(metodoText).toMatch(/Guía de Referencia I/);
    expect(metodoText).toMatch(/Guía de Referencia III/);
  });

  it("22. individual correcto", async () => {
    const worker = sampleWorker();
    const charts = await renderIndividualCharts({
      categories: {
        labels: Object.keys(worker.categoryScores),
        values: Object.values(worker.categoryScores).map((v) => v.score),
      },
      domains: {
        labels: Object.keys(worker.domainScores),
        values: Object.values(worker.domainScores).map((v) => v.score),
      },
    });
    const buf = await buildIndividualReportXlsxBuffer({
      worker,
      campaignName: "Evaluación NOM-035 2026",
      campaignStatus: "closed",
      companyName: "Empresa Demo",
      generatedAt: "2026-08-26T20:00:00.000Z",
      charts,
    });
    const names = await readSheetNames(buf);
    for (const sheet of INDIVIDUAL_REPORT_SHEETS) {
      expect(names).toContain(sheet);
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const resumen = wb.getWorksheet("Resumen Individual");
    expect(JSON.stringify(resumen?.getSheetValues() ?? [])).toMatch(
      /GUÍA I Y III/
    );
  });

  it("23-25. test rows / password / secrets = 0", () => {
    const report = sampleReport(2);
    const agg = buildNom035AggregateReport(report);
    expect(agg.testContribution.rows).toBe(0);
    expect(assertReportPayloadHasNoSecrets({ report, agg })).toBe(true);
    expect(JSON.stringify({ report, agg }).toLowerCase()).not.toContain("password");
    expect(JSON.stringify({ report, agg }).toLowerCase()).not.toContain(
      "auth_user_id"
    );
  });

  it("26-27. XLSX válido e imágenes PNG", async () => {
    const report = sampleReport(1);
    const agg = buildNom035AggregateReport(report);
    const charts = await renderExecutiveCharts(agg);
    expect(isLikelyPng(charts.riskDistribution)).toBe(true);
    expect(isLikelyPng(charts.categoriesGrouped)).toBe(true);
    expect(isLikelyPng(charts.domainsGrouped)).toBe(true);
    const buf = await buildFullReportXlsxBuffer({ report, aggregate: agg, charts });
    expect(isLikelyXlsx(buf)).toBe(true);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.model.media?.length ?? 0).toBeGreaterThan(0);
  });

  it("28. no APIs externas en charts", () => {
    const src = readFileSync("src/lib/nom035/report-charts.ts", "utf8");
    expect(src).not.toMatch(/https?:\/\//);
    expect(src).toMatch(/pureimage/);
  });

  it("29-30. admin auth endpoint + worker no mapeado", () => {
    const exec = findEndpointPermission(
      "GET",
      "/api/admin/nom035/reports/executive"
    );
    const full = findEndpointPermission("GET", "/api/admin/nom035/reports/full");
    expect(exec?.permission).toBe("reports.generate");
    expect(full?.permission).toBe("reports.generate");
    const workerRoutes = readFileSync(
      "src/lib/nom035/auth/endpoint-permissions.ts",
      "utf8"
    );
    expect(workerRoutes).not.toMatch(
      /trabajador.*reports\/executive|reports\/executive.*trabajador/
    );
  });

  it("paleta centralizada única", () => {
    expect(RISK_CHART_HEX.nulo).toMatch(/^#/);
    expect(RISK_EXCEL_ARGB.muy_alto).toMatch(/^FF/);
    const utils = readFileSync("src/lib/nom035/report-excel-utils.ts", "utf8");
    expect(utils).toMatch(/riskExcelArgb/);
  });

  it("buildChartDatasets compat + filename", () => {
    const report = sampleReport(1);
    const ds = buildChartDatasets(report);
    expect(ds.riskDistribution.values.reduce((a, b) => a + b, 0)).toBe(1);
    expect(FULL_REPORT_FILENAME).toBe("reporte-completo-nom035-2026.xlsx");
    expect(individualReportFilename("001")).toBe("nom035-001-2026.xlsx");
  });

  it("UI resultados incluye resumen ejecutivo", () => {
    const page = readFileSync("src/app/admin/resultados/page.tsx", "utf8");
    expect(page).toMatch(/AdminExecutiveSummaryPanel/);
    expect(page).toMatch(/reportsExecutive/);
  });
});
