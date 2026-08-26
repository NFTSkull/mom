/**
 * B4.24 — XLSX individual por trabajador completed.
 */
import ExcelJS from "exceljs";
import {
  formatReportDate,
  guideStatusLabel,
  riskLevelLabel,
  type ReportWorkerRow,
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
  INDIVIDUAL_REPORT_SHEETS,
  riskFillColor,
  setTextCell,
  styleHeaderRow,
} from "@/lib/nom035/report-excel-utils";

export async function buildIndividualReportXlsxBuffer(input: {
  worker: ReportWorkerRow;
  campaignName: string;
  campaignStatus: string;
  generatedAt: string;
  charts: Pick<ReportChartImages, "individualCategories" | "individualDomains">;
}): Promise<Buffer> {
  const { worker, charts } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NOM-035";
  wb.created = new Date();

  const resumen = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[0]);
  applySheetDefaults(resumen, [32, 40]);
  resumen.addRow(["Reporte individual NOM-035 2026"]);
  resumen.getCell(1, 1).font = { bold: true, size: 14 };
  const rows: Array<[string, string | number | null]> = [
    ["Nombre", worker.nombre],
    ["Usuario", worker.username],
    ["Puesto", worker.puesto ?? "—"],
    ["Departamento", worker.departamento ?? "—"],
    ["Campaña", input.campaignName],
    ["Estado campaña", input.campaignStatus],
    ["Estado assignment", worker.status],
    ["Fecha inicio", formatReportDate(worker.startedAt)],
    ["Fecha envío", formatReportDate(worker.completedAt)],
    ["Guía I", guideStatusLabel(worker.guiaIStatus)],
    ["Guía III", guideStatusLabel(worker.guiaIIIStatus)],
    ["Puntaje", worker.finalScore],
    ["Nivel de riesgo", riskLevelLabel(worker.finalRiskLevel)],
    ["Fecha generación", formatReportDate(input.generatedAt)],
  ];
  for (const [k, v] of rows) {
    const row = resumen.addRow([k, v ?? "—"]);
    if (k === "Usuario") setTextCell(row.getCell(2), worker.username);
    if (k === "Nivel de riesgo") {
      const fill = riskFillColor(worker.finalRiskLevel);
      if (fill) row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
  }

  const guiaI = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[1]);
  applySheetDefaults(guiaI, [10, 60, 24, 12]);
  guiaI.addRow(["Número", "Pregunta", "Respuesta", "Valor"]);
  styleHeaderRow(guiaI);
  const guiaIRows = orderedGuiaIAnswerRows(worker.answers);
  for (const a of guiaIRows) {
    const row = guiaI.addRow([
      guiaIQuestionNumber(a.questionId),
      guiaIQuestionText(a.questionId),
      formatAnswerDisplay(a),
      a.answerValue ?? "",
    ]);
    row.getCell(2).alignment = { wrapText: true };
  }
  applyAutoFilter(guiaI, 4, guiaIRows.length + 1);

  const guiaIII = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[2]);
  applySheetDefaults(guiaIII, [10, 60, 24, 12, 14]);
  guiaIII.addRow(["Número", "Pregunta", "Respuesta", "Valor", "Estado"]);
  styleHeaderRow(guiaIII);
  const guiaIIIRows = orderedGuiaIIIAnswerRows(worker.answers);
  for (const a of guiaIIIRows) {
    const row = guiaIII.addRow([
      guiaIIIQuestionNumber(a.questionId) || "—",
      guiaIIIQuestionText(a.questionId),
      formatAnswerDisplay(a),
      a.answerValue ?? "",
      a.status === "no_aplicable" ? "No aplicable" : "Respondida",
    ]);
    row.getCell(2).alignment = { wrapText: true };
  }
  applyAutoFilter(guiaIII, 5, guiaIIIRows.length + 1);

  const categorias = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[3]);
  applySheetDefaults(categorias, [36, 12, 18]);
  categorias.addRow(["Categoría", "Puntaje", "Nivel/Riesgo"]);
  styleHeaderRow(categorias);
  for (const [name, entry] of Object.entries(worker.categoryScores)) {
    const row = categorias.addRow([name, entry.score, riskLevelLabel(entry.riskLevel)]);
    const fill = riskFillColor(entry.riskLevel);
    if (fill) row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }
  applyAutoFilter(categorias, 3, Object.keys(worker.categoryScores).length + 1);

  const dominios = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[4]);
  applySheetDefaults(dominios, [36, 12, 18]);
  dominios.addRow(["Dominio", "Puntaje", "Nivel/Riesgo"]);
  styleHeaderRow(dominios);
  for (const [name, entry] of Object.entries(worker.domainScores)) {
    const row = dominios.addRow([name, entry.score, riskLevelLabel(entry.riskLevel)]);
    const fill = riskFillColor(entry.riskLevel);
    if (fill) row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }
  applyAutoFilter(dominios, 3, Object.keys(worker.domainScores).length + 1);

  const graficas = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[5]);
  applySheetDefaults(graficas, [28, 16]);
  graficas.addRow(["Tipo", "Etiqueta", "Valor"]);
  styleHeaderRow(graficas);
  const tableRows: Array<[string, string, number]> = [
    ...Object.entries(worker.categoryScores).map(
      ([k, v]) => ["Categoría", k, v.score] as [string, string, number]
    ),
    ...Object.entries(worker.domainScores).map(
      ([k, v]) => ["Dominio", k, v.score] as [string, string, number]
    ),
  ];
  for (const r of tableRows) graficas.addRow(r);
  applyAutoFilter(graficas, 3, tableRows.length + 1);

  const images = [];
  if (charts.individualCategories) {
    images.push({
      buffer: charts.individualCategories,
      title: "Gráfica: categorías",
      row: tableRows.length + 3,
    });
  }
  if (charts.individualDomains) {
    images.push({
      buffer: charts.individualDomains,
      title: "Gráfica: dominios",
      row: tableRows.length + 26,
    });
  }
  if (images.length) await embedChartImages(wb, graficas, images);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export { INDIVIDUAL_REPORT_SHEETS };
