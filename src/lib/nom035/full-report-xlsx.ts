/**
 * B4.24 — XLSX consolidado NOM-035 (8 hojas).
 */
import ExcelJS from "exceljs";
import {
  aggregateCategoryRows,
  aggregateDomainRows,
  buildChartDatasets,
  formatReportDate,
  guideStatusLabel,
  riskLevelLabel,
  type NormalizedFullReport,
} from "@/lib/nom035/report-data";
import type { ReportChartImages } from "@/lib/nom035/report-charts";
import {
  formatAnswerDisplay,
  guiaIQuestionNumber,
  guiaIQuestionText,
  guiaIIIQuestionNumber,
  guiaIIIQuestionText,
  orderedGuiaIAnswerRows,
  orderedGuiaIIIAnswerRows,
} from "@/lib/nom035/report-questions";
import {
  applyAutoFilter,
  applySheetDefaults,
  embedChartImages,
  FULL_REPORT_SHEETS,
  riskFillColor,
  setTextCell,
  styleHeaderRow,
} from "@/lib/nom035/report-excel-utils";

export async function buildFullReportXlsxBuffer(input: {
  report: NormalizedFullReport;
  charts: ReportChartImages;
}): Promise<Buffer> {
  const { report, charts } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NOM-035";
  wb.created = new Date();

  const resumen = wb.addWorksheet(FULL_REPORT_SHEETS[0]);
  applySheetDefaults(resumen, [36, 28]);
  resumen.addRow(["Reporte completo NOM-035 2026"]);
  resumen.getCell(1, 1).font = { bold: true, size: 14 };
  const pct =
    report.counts.realWorkers > 0
      ? ((report.counts.realCompleted / report.counts.realWorkers) * 100).toFixed(2)
      : "0";
  const summaryRows: Array<[string, string | number]> = [
    ["Campaña", report.campaignName],
    ["Estado campaña", report.campaignStatus],
    ["Fecha de generación", formatReportDate(report.generatedAt)],
    ["Trabajadores reales", report.counts.realWorkers],
    ["Completados", report.counts.realCompleted],
    ["Pendientes", report.counts.realPending],
    ["En progreso", report.counts.realInProgress],
    ["Porcentaje completado", `${pct}%`],
    ["Guía I completadas", report.counts.guiaICompleted],
    ["Guía III completadas", report.counts.guiaIIICompleted],
    ["Guía II", report.counts.guiaIICompleted],
    ["Resultados incluidos", report.counts.realResults],
    ["Resultados test excluidos", report.counts.testResultsStored],
    ["", ""],
    ["Nivel de riesgo", "Cantidad"],
    ["Nulo/despreciable", report.riskDistribution.nulo],
    ["Bajo", report.riskDistribution.bajo],
    ["Medio", report.riskDistribution.medio],
    ["Alto", report.riskDistribution.alto],
    ["Muy alto", report.riskDistribution.muy_alto],
  ];
  for (const [k, v] of summaryRows) {
    resumen.addRow([k, v]);
  }

  const completados = wb.addWorksheet(FULL_REPORT_SHEETS[1]);
  applySheetDefaults(completados, [10, 32, 20, 18, 12, 18, 18, 8, 8, 16, 14, 18]);
  completados.addRow([
    "Usuario",
    "Nombre",
    "Puesto",
    "Departamento",
    "Estado",
    "Fecha inicio",
    "Fecha envío",
    "Guía I",
    "Guía III",
    "Resultado general",
    "Puntaje general",
    "Nivel de riesgo",
  ]);
  styleHeaderRow(completados);
  for (const w of report.workers) {
    const row = completados.addRow([
      w.username,
      w.nombre,
      w.puesto ?? "—",
      w.departamento ?? "—",
      w.status,
      formatReportDate(w.startedAt),
      formatReportDate(w.completedAt),
      guideStatusLabel(w.guiaIStatus),
      guideStatusLabel(w.guiaIIIStatus),
      riskLevelLabel(w.finalRiskLevel),
      w.finalScore,
      riskLevelLabel(w.finalRiskLevel),
    ]);
    setTextCell(row.getCell(1), w.username);
    const fill = riskFillColor(w.finalRiskLevel);
    if (fill) row.getCell(12).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }
  applyAutoFilter(completados, 12, report.workers.length + 1);

  const individuales = wb.addWorksheet(FULL_REPORT_SHEETS[2]);
  applySheetDefaults(individuales, [10, 32, 14, 18, 40, 40]);
  individuales.addRow([
    "Usuario",
    "Nombre",
    "Score total",
    "Nivel de riesgo",
    "Categorías (JSON)",
    "Dominios (JSON)",
  ]);
  styleHeaderRow(individuales);
  for (const w of report.workers) {
    const row = individuales.addRow([
      w.username,
      w.nombre,
      w.finalScore,
      riskLevelLabel(w.finalRiskLevel),
      JSON.stringify(w.categoryScores),
      JSON.stringify(w.domainScores),
    ]);
    setTextCell(row.getCell(1), w.username);
  }
  applyAutoFilter(individuales, 6, report.workers.length + 1);

  const categorias = wb.addWorksheet(FULL_REPORT_SHEETS[3]);
  applySheetDefaults(categorias, [10, 32, 36, 12, 18]);
  categorias.addRow(["Usuario", "Nombre", "Categoría", "Puntaje", "Nivel/Riesgo"]);
  styleHeaderRow(categorias);
  const catRows = aggregateCategoryRows(report.workers);
  for (const r of catRows) {
    const row = categorias.addRow([r.username, r.nombre, r.categoria, r.puntaje, r.nivel]);
    setTextCell(row.getCell(1), r.username);
  }
  applyAutoFilter(categorias, 5, catRows.length + 1);

  const dominios = wb.addWorksheet(FULL_REPORT_SHEETS[4]);
  applySheetDefaults(dominios, [10, 32, 28, 36, 12, 18]);
  dominios.addRow(["Usuario", "Nombre", "Categoría", "Dominio", "Puntaje", "Nivel/Riesgo"]);
  styleHeaderRow(dominios);
  const domRows = aggregateDomainRows(report.workers);
  for (const r of domRows) {
    const row = dominios.addRow([r.username, r.nombre, r.categoria, r.dominio, r.puntaje, r.nivel]);
    setTextCell(row.getCell(1), r.username);
  }
  applyAutoFilter(dominios, 6, domRows.length + 1);

  const guiaI = wb.addWorksheet(FULL_REPORT_SHEETS[5]);
  applySheetDefaults(guiaI, [10, 32, 10, 60, 24, 12]);
  guiaI.addRow(["Usuario", "Nombre", "Número pregunta", "Pregunta", "Respuesta", "Valor"]);
  styleHeaderRow(guiaI);
  let guiaIRowCount = 1;
  for (const w of report.workers) {
    for (const a of orderedGuiaIAnswerRows(w.answers)) {
      const row = guiaI.addRow([
        w.username,
        w.nombre,
        guiaIQuestionNumber(a.questionId),
        guiaIQuestionText(a.questionId),
        formatAnswerDisplay(a),
        a.answerValue ?? "",
      ]);
      setTextCell(row.getCell(1), w.username);
      row.getCell(4).alignment = { wrapText: true };
      guiaIRowCount += 1;
    }
  }
  applyAutoFilter(guiaI, 6, guiaIRowCount);

  const guiaIII = wb.addWorksheet(FULL_REPORT_SHEETS[6]);
  applySheetDefaults(guiaIII, [10, 32, 10, 60, 24, 12, 14]);
  guiaIII.addRow([
    "Usuario",
    "Nombre",
    "Número pregunta",
    "Pregunta",
    "Respuesta",
    "Valor",
    "Estado",
  ]);
  styleHeaderRow(guiaIII);
  let guiaIIIRowCount = 1;
  for (const w of report.workers) {
    for (const a of orderedGuiaIIIAnswerRows(w.answers)) {
      const row = guiaIII.addRow([
        w.username,
        w.nombre,
        guiaIIIQuestionNumber(a.questionId) || "—",
        guiaIIIQuestionText(a.questionId),
        formatAnswerDisplay(a),
        a.answerValue ?? "",
        a.status === "no_aplicable" ? "No aplicable" : "Respondida",
      ]);
      setTextCell(row.getCell(1), w.username);
      row.getCell(4).alignment = { wrapText: true };
      guiaIIIRowCount += 1;
    }
  }
  applyAutoFilter(guiaIII, 7, guiaIIIRowCount);

  const graficas = wb.addWorksheet(FULL_REPORT_SHEETS[7]);
  applySheetDefaults(graficas, [28, 16]);
  const datasets = buildChartDatasets(report);
  graficas.addRow(["Dataset", "Etiqueta", "Valor"]);
  styleHeaderRow(graficas);
  const tableRows: Array<[string, string, number]> = [
    ...datasets.riskDistribution.labels.map((label, i) => [
      "Riesgo",
      label,
      datasets.riskDistribution.values[i] ?? 0,
    ] as [string, string, number]),
    ...datasets.categoryAverages.labels.map((label, i) => [
      "Categoría",
      label,
      datasets.categoryAverages.values[i] ?? 0,
    ] as [string, string, number]),
    ...datasets.domainAverages.labels.map((label, i) => [
      "Dominio",
      label,
      datasets.domainAverages.values[i] ?? 0,
    ] as [string, string, number]),
    ...datasets.completionStatus.labels.map((label, i) => [
      "Avance",
      label,
      datasets.completionStatus.values[i] ?? 0,
    ] as [string, string, number]),
  ];
  for (const r of tableRows) graficas.addRow(r);
  applyAutoFilter(graficas, 3, tableRows.length + 1);

  await embedChartImages(wb, graficas, [
    { buffer: charts.riskDistribution, title: "Gráfica: distribución de riesgo", row: tableRows.length + 3 },
    { buffer: charts.categoryAverages, title: "Gráfica: promedio por categoría", row: tableRows.length + 26 },
    { buffer: charts.domainAverages, title: "Gráfica: promedio por dominio", row: tableRows.length + 49 },
    { buffer: charts.completionStatus, title: "Gráfica: avance de evaluación", row: tableRows.length + 72 },
  ]);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export { FULL_REPORT_SHEETS };
