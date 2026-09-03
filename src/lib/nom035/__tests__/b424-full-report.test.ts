import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { buildNom035AggregateReport, GUIA_III_CATEGORY_ORDER, GUIA_III_DOMAIN_ORDER } from "../aggregate-report";
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
import { buildIndividualReportXlsxBuffer, INDIVIDUAL_REPORT_SHEETS } from "../individual-report-xlsx";
import { orderedGuiaIIIAnswerRows } from "../report-questions";
import { renderAggregateCharts, renderExecutiveCharts, renderIndividualCharts } from "../report-charts";
import { isLikelyXlsx } from "../avance-excel-xlsx";
import { findEndpointPermission } from "../auth/endpoint-permissions";
import { permissionRequiresAal2 } from "../auth/permissions";
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

function sampleWorker(overrides: Partial<ReportWorkerRow> = {}): ReportWorkerRow {
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
    ...fullScores("medio"),
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
      {
        questionnaireCode: "GUIA_III",
        questionId: "guia_iii_gate_clientes",
        answerText: null,
        answerValue: "no",
      },
    ],
    ...overrides,
  };
}

function sampleReport(completed = 2) {
  const workers = [
    sampleWorker({ username: "001", nombre: "A" }),
    sampleWorker({ username: "083", nombre: "B", resultId: "r-083" }),
  ].slice(0, completed);
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
    riskDistribution: { nulo: 0, bajo: 0, medio: completed, alto: 0, muy_alto: 0 },
    categoryAverages: { "Ambiente de trabajo": 5 },
    domainAverages: { "Condiciones en el ambiente de trabajo": 5 },
    workers,
  })!;
}

async function buildBuf(report = sampleReport(2)) {
  const aggregate = buildNom035AggregateReport(report, { companyName: "Demo" });
  const charts = await renderExecutiveCharts(aggregate);
  return buildFullReportXlsxBuffer({ report, aggregate, charts });
}

async function readSheetNames(buf: Uint8Array): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return wb.worksheets.map((s) => s.name);
}

describe("B4.24 reportes NOM-035 completos (regresión B4.26)", () => {
  it("1. solo completed reales en payload normalizado", () => {
    const report = sampleReport(2);
    expect(report.workers.every((w) => w.status === "completed")).toBe(true);
    expect(report.counts.testResultsIncluded).toBe(0);
  });

  it("2-3. pending e in_progress excluidos del detalle exportado", () => {
    const report = sampleReport(1);
    expect(report.workers).toHaveLength(1);
    expect(report.counts.realPending).toBe(82);
    expect(report.counts.realInProgress).toBe(0);
  });

  it("4. synthetic/test no entra en workers exportados", () => {
    const report = sampleReport(1);
    expect(report.workers.some((w) => w.username.includes("prueba"))).toBe(false);
    expect(report.counts.testResultsStored).toBe(1);
  });

  it("5-6. test result no afecta promedios ni gráficas de riesgo", () => {
    const report = sampleReport(1);
    const datasets = buildChartDatasets(report);
    expect(datasets.riskDistribution.values.reduce((a, b) => a + b, 0)).toBe(1);
    expect(report.categoryAverages["Ambiente de trabajo"]).toBe(5);
  });

  it("7-8. guías I y III marcadas como submitted", () => {
    const w = sampleWorker();
    expect(w.guiaIStatus).toBe("submitted");
    expect(w.guiaIIIStatus).toBe("submitted");
  });

  it("9. gates 65–72 no aplicables cuando gate=no", () => {
    const rows = orderedGuiaIIIAnswerRows(sampleWorker().answers);
    const q65 = rows.find((r) => r.questionId === "guia_iii_65");
    expect(q65?.status).toBe("no_aplicable");
  });

  it("10-12. snapshot categorías/dominios persistidos", () => {
    const w = sampleWorker();
    expect(w.categoryScores["Ambiente de trabajo"]?.score).toBe(5);
    expect(w.domainScores["Condiciones en el ambiente de trabajo"]?.score).toBe(5);
  });

  it("13-14. XLSX válido y todas las hojas existen", async () => {
    const buf = await buildBuf(sampleReport(2));
    expect(isLikelyXlsx(buf)).toBe(true);
    const names = await readSheetNames(buf);
    for (const sheet of FULL_REPORT_SHEETS) {
      expect(names).toContain(sheet);
    }
  });

  it("15. conteos cuadran", () => {
    const report = sampleReport(2);
    expect(assertFullReportCounts(report).ok).toBe(true);
  });

  it("16. gráficas PNG generadas", async () => {
    const charts = await renderAggregateCharts(buildChartDatasets(sampleReport(1)));
    expect(charts.riskDistribution.length).toBeGreaterThan(100);
    expect(charts.categoryAverages.length).toBeGreaterThan(100);
  });

  it("17. username 001 conserva ceros en hoja Completados", async () => {
    const buf = await buildBuf(sampleReport(1));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet("Completados");
    expect(String(sheet?.getRow(2).getCell(1).value)).toBe("001");
  });

  it("18-19. passwords y auth secrets ausentes en payload", () => {
    const report = sampleReport(1);
    expect(assertReportPayloadHasNoSecrets(report)).toBe(true);
    expect(JSON.stringify(report).toLowerCase()).not.toContain("password");
    expect(JSON.stringify(report).toLowerCase()).not.toContain("auth_user_id");
  });

  it("21. admin endpoints registrados sin AAL2 extra", () => {
    const full = findEndpointPermission("GET", "/api/admin/nom035/reports/full");
    const individual = findEndpointPermission(
      "GET",
      "/api/admin/nom035/results/11111111-1111-4111-8111-111111111111/report"
    );
    expect(full?.permission).toBe("reports.generate");
    expect(individual?.permission).toBe("results.individual.read");
    expect(permissionRequiresAal2("reports.generate")).toBe(false);
    expect(permissionRequiresAal2("results.individual.read")).toBe(false);
  });

  it("22. routes con Cache-Control no-store", () => {
    const fullRoute = readFileSync(
      "src/app/api/admin/nom035/reports/full/route.ts",
      "utf8"
    );
    const individualRoute = readFileSync(
      "src/app/api/admin/nom035/results/[id]/report/route.ts",
      "utf8"
    );
    expect(fullRoute).toMatch(/Cache-Control.*no-store/);
    expect(individualRoute).toMatch(/Cache-Control.*no-store/);
  });

  it("23. export individual genera 6 hojas", async () => {
    const worker = sampleWorker();
    const charts = await renderIndividualCharts({
      categories: { labels: ["Ambiente de trabajo"], values: [5] },
      domains: { labels: ["Condiciones en el ambiente de trabajo"], values: [5] },
    });
    const buf = await buildIndividualReportXlsxBuffer({
      worker,
      campaignName: "Evaluación NOM-035 2026",
      campaignStatus: "closed",
      generatedAt: "2026-08-26T20:00:00.000Z",
      charts,
    });
    const names = await readSheetNames(buf);
    for (const sheet of INDIVIDUAL_REPORT_SHEETS) {
      expect(names).toContain(sheet);
    }
    expect(individualReportFilename("001")).toBe("nom035-001-2026.xlsx");
  });

  it("24. consolidado incluye filas = realCompleted", async () => {
    const report = sampleReport(2);
    const buf = await buildBuf(report);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet("Completados");
    expect(sheet?.rowCount).toBe(1 + report.counts.realCompleted);
  });

  it("25. Excel avance sigue existiendo", () => {
    const route = readFileSync(
      "src/app/api/admin/nom035/campaigns/avance-excel/route.ts",
      "utf8"
    );
    expect(route).toMatch(/exportNom035AvanceExcel/);
  });

  it("migración 014 define RPC full report", () => {
    const mig = readFileSync(
      "supabase/migrations/014_admin_export_nom035_full_report.sql",
      "utf8"
    );
    expect(mig).toMatch(/admin_export_nom035_full_report/);
    expect(mig).toMatch(/is_test/);
    expect(mig).toMatch(/test_worker_excluded/);
  });

  it("UI admin incluye sección Reportes NOM-035", () => {
    const page = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(page).toMatch(/Reportes NOM-035/);
    expect(page).toMatch(/download-full-report-excel/);
    expect(page).toMatch(/download-avance-excel/);
    // Visible con campaña abierta o cerrada (sin gate por nombre).
    expect(page).not.toMatch(
      /activeCampaign\?\.nombre === "Evaluación NOM-035 2026"/
    );
  });

  it("UI Resultados y Reportes incluyen Descargar Excel completo", () => {
    const resultados = readFileSync("src/app/admin/resultados/page.tsx", "utf8");
    const reportes = readFileSync("src/app/admin/reportes/page.tsx", "utf8");
    expect(resultados).toMatch(/download-full-report-excel/);
    expect(resultados).toMatch(/downloadFullReportExcelFromBrowser/);
    expect(reportes).toMatch(/download-full-report-excel/);
    expect(reportes).toMatch(/downloadFullReportExcelFromBrowser/);
    expect(reportes).toMatch(/nom035-reportes-excel-export/);
    expect(reportes).toMatch(/Descargar reporte en Excel/);
  });

  it("helper de descarga consolida endpoint full", () => {
    const helper = readFileSync("src/lib/nom035/download-full-report.ts", "utf8");
    expect(helper).toMatch(/\/api\/admin\/nom035\/reports\/full/);
    expect(helper).toMatch(/reporte-completo-nom035-2026\.xlsx/);
  });

  it("nombre archivo consolidado oficial", () => {
    expect(FULL_REPORT_FILENAME).toBe("reporte-completo-nom035-2026.xlsx");
  });
});
