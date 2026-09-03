import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  buildNom035AggregateReport,
  GUIA_III_CATEGORY_ORDER,
  GUIA_III_DOMAIN_ORDER,
} from "../aggregate-report";
import {
  normalizeFullReportPayload,
  type ReportWorkerRow,
} from "../report-data";
import { buildFullReportXlsxBuffer, FULL_REPORT_SHEETS } from "../full-report-xlsx";
import {
  buildIndividualReportXlsxBuffer,
  INDIVIDUAL_REPORT_SHEETS,
} from "../individual-report-xlsx";
import {
  ensureChartFont,
  pngHasVisibleInk,
  renderExecutiveCharts,
  renderIndividualCharts,
  wrapChartLabel,
} from "../report-charts";
import {
  auditXlsxVisualStructure,
  writeAuditArtifacts,
} from "../xlsx-visual-audit";
import { isLikelyXlsx } from "../avance-excel-xlsx";
import type { RiskLevelNom035 } from "@/types/nom035";

function fullScores(level: RiskLevelNom035 = "bajo") {
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
    ],
    ...overrides,
  };
}

function sampleReport() {
  const workers = [
    sampleWorker({
      username: "001",
      finalRiskLevel: "bajo",
      ...fullScores("bajo"),
    }),
    sampleWorker({
      username: "083",
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
  ];
  return normalizeFullReportPayload({
    ok: true,
    generatedAt: "2026-09-02T20:00:00.000Z",
    campaign: { nombre: "Evaluación NOM-035 2026", status: "closed" },
    counts: {
      realWorkers: 83,
      realCompleted: 2,
      realPending: 81,
      realInProgress: 0,
      realResults: 2,
      testWorkers: 1,
      testResultsStored: 1,
      testResultsIncluded: 0,
      guiaICompleted: 2,
      guiaIIICompleted: 2,
      guiaIICompleted: 0,
    },
    riskDistribution: { nulo: 0, bajo: 1, medio: 0, alto: 1, muy_alto: 0 },
    categoryAverages: {},
    domainAverages: {},
    workers,
  })!;
}

describe("B4.27 gráficas visibles en XLSX", () => {
  it("wrapChartLabel no trunca con ellipsis", () => {
    const lines = wrapChartLabel("Organización del tiempo de trabajo", 16, 3);
    expect(lines.join(" ")).toContain("Organización");
    expect(lines.join(" ")).toContain("trabajo");
    expect(lines.join("")).not.toContain("…");
    expect(lines.join("")).not.toContain("...");
  });

  it("1-2. Resumen Ejecutivo primera hoja y activeTab=0", async () => {
    const report = sampleReport();
    const aggregate = buildNom035AggregateReport(report, {
      companyName: "Empresa Demo",
    });
    const charts = await renderExecutiveCharts(aggregate);
    const buf = await buildFullReportXlsxBuffer({ report, aggregate, charts });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets[0]?.name).toBe(FULL_REPORT_SHEETS[0]);
    expect(wb.views?.[0]?.activeTab ?? 0).toBe(0);
  });

  it("3-7. charts anchors antes que tablas + ink visible", async () => {
    await ensureChartFont();
    const report = sampleReport();
    const aggregate = buildNom035AggregateReport(report, {
      companyName: "Empresa Demo",
    });
    const charts = await renderExecutiveCharts(aggregate);
    expect(await pngHasVisibleInk(charts.riskDistribution)).toBe(true);
    expect(await pngHasVisibleInk(charts.categoriesGrouped)).toBe(true);
    expect(await pngHasVisibleInk(charts.domainsGrouped)).toBe(true);

    const buf = await buildFullReportXlsxBuffer({ report, aggregate, charts });
    expect(isLikelyXlsx(buf)).toBe(true);
    const audit = await auditXlsxVisualStructure(buf);

    expect(audit.firstSheetName).toBe("Resumen Ejecutivo");
    expect(audit.activeTab).toBe(0);
    expect(audit.mediaCount).toBeGreaterThanOrEqual(5);
    expect(audit.drawingCount).toBeGreaterThanOrEqual(4);
    expect(audit.imagesBySheet["Resumen Ejecutivo"] ?? 0).toBeGreaterThanOrEqual(1);
    expect(audit.imagesBySheet["Categorías"] ?? 0).toBeGreaterThanOrEqual(1);
    expect(audit.imagesBySheet["Dominios"] ?? 0).toBeGreaterThanOrEqual(1);
    expect(audit.imagesBySheet["Distribución Final"] ?? 0).toBeGreaterThanOrEqual(1);
    expect(audit.imagesBySheet["Acontecimiento Traumático"] ?? 0).toBeGreaterThanOrEqual(1);

    const resumen = audit.sheets.find((s) => s.sheetName === "Resumen Ejecutivo");
    expect(resumen?.anchors[0]?.fromRow).toBeLessThan(15);

    const cats = audit.sheets.find((s) => s.sheetName === "Categorías");
    expect(cats?.anchors[0]?.fromRow).toBeLessThan(10);

    const doms = audit.sheets.find((s) => s.sheetName === "Dominios");
    expect(doms?.anchors[0]?.fromRow).toBeLessThan(10);

    const dist = audit.sheets.find((s) => s.sheetName === "Distribución Final");
    expect(dist?.anchors[0]?.fromRow).toBeLessThan(10);

    expect(audit.visibleInkFlags.every(Boolean)).toBe(true);

    const outDir = join("/tmp", "nom035-b427-out");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "reporte-completo-nom035-2026.xlsx"), buf);
    await writeAuditArtifacts(audit, outDir);
  });

  it("8-9. labels de categoría/dominio completos en PNG chart code path", () => {
    const src = [
      wrapChartLabel("Factores propios de la actividad").join("\n"),
      wrapChartLabel("Insuficiente sentido de pertenencia e inestabilidad").join(
        "\n"
      ),
    ].join("|");
    expect(src).not.toMatch(/…|\.\.\./);
    expect(src).toContain("Factores");
    expect(src).toContain("pertenencia");
  });

  it("10-13. media/drawings/png válidos", async () => {
    const report = sampleReport();
    const aggregate = buildNom035AggregateReport(report);
    const charts = await renderExecutiveCharts(aggregate);
    const buf = await buildFullReportXlsxBuffer({ report, aggregate, charts });
    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.mediaCount).toBe(audit.pngBuffers.length);
    expect(audit.drawingCount).toBeGreaterThan(0);
    for (const sheet of ["Resumen Ejecutivo", "Categorías", "Dominios"]) {
      const s = audit.sheets.find((x) => x.sheetName === sheet);
      expect(s?.drawingPath).toBeTruthy();
      expect(s?.mediaTargets.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("17. test excluded", () => {
    const agg = buildNom035AggregateReport(sampleReport());
    expect(agg.population.testResultsIncluded).toBe(0);
    expect(agg.testContribution.rows).toBe(0);
  });

  it("19. individual summary charts visibles", async () => {
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
      generatedAt: "2026-09-02T20:00:00.000Z",
      charts,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets[0]?.name).toBe(INDIVIDUAL_REPORT_SHEETS[0]);
    const audit = await auditXlsxVisualStructure(buf);
    expect(audit.imagesBySheet["Resumen Individual"] ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("20. visual smoke PASS flags", async () => {
    const report = sampleReport();
    const aggregate = buildNom035AggregateReport(report);
    const charts = await renderExecutiveCharts(aggregate);
    const buf = await buildFullReportXlsxBuffer({ report, aggregate, charts });
    const audit = await auditXlsxVisualStructure(buf);
    const VISIBLE_CHART_SUMMARY = (audit.imagesBySheet["Resumen Ejecutivo"] ?? 0) > 0;
    const VISIBLE_CHART_CATEGORIES = (audit.imagesBySheet["Categorías"] ?? 0) > 0;
    const VISIBLE_CHART_DOMAINS = (audit.imagesBySheet["Dominios"] ?? 0) > 0;
    const VISIBLE_CHART_FINAL = (audit.imagesBySheet["Distribución Final"] ?? 0) > 0;
    expect(VISIBLE_CHART_SUMMARY).toBe(true);
    expect(VISIBLE_CHART_CATEGORIES).toBe(true);
    expect(VISIBLE_CHART_DOMAINS).toBe(true);
    expect(VISIBLE_CHART_FINAL).toBe(true);
    expect(audit.visibleInkFlags.filter(Boolean).length).toBeGreaterThanOrEqual(4);
  });

  it("report-charts no usa slice truncante destructivo", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/nom035/report-charts.ts", "utf8");
    expect(src).not.toMatch(/slice\(0,\s*12\)/);
    expect(src).not.toMatch(/slice\(0,\s*20\)…/);
    expect(src).toMatch(/wrapChartLabel/);
  });
});
