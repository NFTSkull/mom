import { writeFileSync } from "node:fs";
import {
  buildNom035AggregateReport,
  GUIA_III_CATEGORY_ORDER,
  GUIA_III_DOMAIN_ORDER,
} from "@/lib/nom035/aggregate-report";
import { normalizeFullReportPayload } from "@/lib/nom035/report-data";
import { ensureChartFont, renderExecutiveCharts } from "@/lib/nom035/report-charts";
import { buildFullReportXlsxBuffer } from "@/lib/nom035/full-report-xlsx";
import {
  auditXlsxVisualStructure,
  writeAuditArtifacts,
} from "@/lib/nom035/xlsx-visual-audit";

async function main() {
  const fontOk = await ensureChartFont();
  console.log("FONT_LOADED=", fontOk);

  const riskKeys = ["nulo", "bajo", "medio", "alto", "muy_alto"] as const;
  const riskCounts = { nulo: 21, bajo: 25, medio: 14, alto: 12, muy_alto: 8 };
  const workers = [];
  let n = 0;
  for (const level of riskKeys) {
    for (let i = 0; i < riskCounts[level]; i++) {
      n += 1;
      const username = String(n).padStart(3, "0");
      workers.push({
        resultId: `r-${username}`,
        username,
        nombre: `T${username}`,
        puesto: null,
        departamento: null,
        status: "completed",
        startedAt: null,
        completedAt: null,
        guiaIStatus: "submitted",
        guiaIIIStatus: "submitted",
        finalScore: 50,
        finalRiskLevel: level,
        categoryScores: Object.fromEntries(
          GUIA_III_CATEGORY_ORDER.map((name) => [
            name,
            { score: 5, riskLevel: level },
          ])
        ),
        domainScores: Object.fromEntries(
          GUIA_III_DOMAIN_ORDER.map((name) => [
            name,
            { score: 5, riskLevel: level },
          ])
        ),
        guiaIRequiresClinicalAttention: false,
        guiaIRiskLabel: null,
        scoringVersion: "nom035-stps-2018-guia-i-iii-v1",
        questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
        answers: [
          {
            questionnaireCode: "GUIA_I",
            questionId: "guia_i_1",
            answerText: null,
            answerValue: n <= 2 ? "si" : "no",
          },
        ],
      });
    }
  }

  const report = normalizeFullReportPayload({
    ok: true,
    generatedAt: new Date().toISOString(),
    campaign: { nombre: "Evaluación NOM-035 2026", status: "closed" },
    counts: {
      realWorkers: 83,
      realCompleted: 80,
      realPending: 3,
      realInProgress: 0,
      realResults: 80,
      testWorkers: 1,
      testResultsStored: 1,
      testResultsIncluded: 0,
      guiaICompleted: 80,
      guiaIIICompleted: 80,
      guiaIICompleted: 0,
    },
    riskDistribution: riskCounts,
    categoryAverages: {},
    domainAverages: {},
    workers,
  })!;

  const aggregate = buildNom035AggregateReport(report, {
    companyName: "NOM035_EMPRESA_OPERATIVA",
  });
  const charts = await renderExecutiveCharts(aggregate);
  writeFileSync("/tmp/nom035-b427-out/final-prodlike.png", charts.riskDistribution);
  writeFileSync("/tmp/nom035-b427-out/cats-prodlike.png", charts.categoriesGrouped);
  writeFileSync("/tmp/nom035-b427-out/doms-prodlike.png", charts.domainsGrouped);

  const buf = await buildFullReportXlsxBuffer({ report, aggregate, charts });
  writeFileSync("/tmp/nom035-b427-out/reporte-completo-nom035-2026.xlsx", buf);
  const audit = await auditXlsxVisualStructure(buf);
  await writeAuditArtifacts(audit, "/tmp/nom035-b427-out/prodlike-audit");
  console.log(
    JSON.stringify(
      {
        mediaCount: audit.mediaCount,
        drawingCount: audit.drawingCount,
        imagesBySheet: audit.imagesBySheet,
        activeTab: audit.activeTab,
        firstSheetName: audit.firstSheetName,
        anchors: Object.fromEntries(
          audit.sheets
            .filter((s) => s.imageCount > 0)
            .map((s) => [s.sheetName, s.anchors])
        ),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
