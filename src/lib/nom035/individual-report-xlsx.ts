/**
 * B4.26 — XLSX individual NOM-035 (Resumen Individual + guías + gráficas).
 */
import ExcelJS from "exceljs";
import {
  formatRiskLevelForReport,
  hasGuiaITraumaticEvent,
  NOM035_REPORT_MODEL_LABEL,
} from "@/lib/nom035/aggregate-report";
import {
  formatReportDate,
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
  paintKpiBox,
  riskFillColor,
  setTextCell,
  styleHeaderRow,
} from "@/lib/nom035/report-excel-utils";
import { riskChartHex } from "@/lib/nom035/risk-palette";

export async function buildIndividualReportXlsxBuffer(input: {
  worker: ReportWorkerRow;
  campaignName: string;
  campaignStatus: string;
  companyName?: string;
  generatedAt: string;
  charts: Pick<ReportChartImages, "individualCategories" | "individualDomains">;
}): Promise<Buffer> {
  const { worker, charts } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NOM-035";
  wb.created = new Date();

  const ats = hasGuiaITraumaticEvent(worker.answers);
  const clinica = worker.guiaIRequiresClinicalAttention === true;

  const resumen = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[0]);
  applySheetDefaults(resumen, [28, 40, 22, 22], 0);
  resumen.mergeCells(1, 1, 1, 4);
  resumen.getCell(1, 1).value = "RESULTADOS NOM-035 2026 — INDIVIDUAL";
  resumen.getCell(1, 1).font = { bold: true, size: 16 };
  resumen.getCell(1, 1).alignment = { horizontal: "center" };
  if (input.companyName) {
    resumen.mergeCells(2, 1, 2, 4);
    resumen.getCell(2, 1).value = input.companyName;
    resumen.getCell(2, 1).alignment = { horizontal: "center" };
  }

  const info: Array<[string, string | number | null]> = [
    ["NOMBRE", worker.nombre],
    ["USUARIO", worker.username],
    ["PUESTO", worker.puesto ?? "—"],
    ["DEPARTAMENTO", worker.departamento ?? "—"],
    ["FECHA DE ENVÍO", formatReportDate(worker.completedAt)],
    ["MODELO", NOM035_REPORT_MODEL_LABEL],
    ["CAMPAÑA", input.campaignName],
    ["ESTADO CAMPAÑA", input.campaignStatus],
  ];
  let rowIdx = 4;
  for (const [k, v] of info) {
    resumen.getCell(rowIdx, 1).value = k;
    resumen.getCell(rowIdx, 1).font = { bold: true, color: { argb: "FF64748B" } };
    const cell = resumen.getCell(rowIdx, 2);
    if (k === "USUARIO") setTextCell(cell, String(v ?? ""));
    else cell.value = v ?? "—";
    rowIdx += 1;
  }

  paintKpiBox(
    resumen,
    4,
    3,
    "RESULTADO FINAL",
    formatRiskLevelForReport(worker.finalRiskLevel),
    riskFillColor(worker.finalRiskLevel) ?? "FFE2E8F0"
  );
  paintKpiBox(
    resumen,
    6,
    3,
    "PUNTAJE",
    String(worker.finalScore ?? "—"),
    "FFDBEAFE"
  );
  paintKpiBox(
    resumen,
    8,
    3,
    "NIVEL DE RIESGO",
    formatRiskLevelForReport(worker.finalRiskLevel),
    riskFillColor(worker.finalRiskLevel) ?? "FFE2E8F0"
  );
  paintKpiBox(
    resumen,
    10,
    3,
    "ACONTECIMIENTO TRAUMÁTICO",
    ats ? "Sí" : "No",
    ats ? "FFFECACA" : "FFDCFCE7"
  );
  paintKpiBox(
    resumen,
    12,
    3,
    "VALORACIÓN CLÍNICA",
    clinica ? "Sí" : "No",
    clinica ? "FFFED7AA" : "FFDCFCE7"
  );

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
      a.status === "no_aplicable" ? "No aplicable" : formatAnswerDisplay(a),
      a.status === "no_aplicable" ? "No aplicable" : (a.answerValue ?? ""),
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
    const row = categorias.addRow([
      name,
      entry.score,
      formatRiskLevelForReport(entry.riskLevel),
    ]);
    const fill = riskFillColor(entry.riskLevel);
    if (fill) {
      row.getCell(3).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    }
  }
  applyAutoFilter(categorias, 3, Object.keys(worker.categoryScores).length + 1);

  const dominios = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[4]);
  applySheetDefaults(dominios, [36, 12, 18]);
  dominios.addRow(["Dominio", "Puntaje", "Nivel/Riesgo"]);
  styleHeaderRow(dominios);
  for (const [name, entry] of Object.entries(worker.domainScores)) {
    const row = dominios.addRow([
      name,
      entry.score,
      formatRiskLevelForReport(entry.riskLevel),
    ]);
    const fill = riskFillColor(entry.riskLevel);
    if (fill) {
      row.getCell(3).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    }
  }
  applyAutoFilter(dominios, 3, Object.keys(worker.domainScores).length + 1);

  const graficas = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[5]);
  applySheetDefaults(graficas, [28, 16]);
  graficas.addRow(["Tipo", "Etiqueta", "Valor", "Nivel"]);
  styleHeaderRow(graficas);
  const tableRows: Array<[string, string, number, string]> = [
    ...Object.entries(worker.categoryScores).map(
      ([k, v]) =>
        [
          "Categoría",
          k,
          v.score,
          formatRiskLevelForReport(v.riskLevel),
        ] as [string, string, number, string]
    ),
    ...Object.entries(worker.domainScores).map(
      ([k, v]) =>
        [
          "Dominio",
          k,
          v.score,
          formatRiskLevelForReport(v.riskLevel),
        ] as [string, string, number, string]
    ),
  ];
  for (const r of tableRows) graficas.addRow(r);
  applyAutoFilter(graficas, 4, tableRows.length + 1);

  const images = [];
  if (charts.individualCategories) {
    images.push({
      buffer: charts.individualCategories,
      title: "Gráfica: categorías",
      row: tableRows.length + 3,
      width: 780,
      height: 360,
    });
  }
  if (charts.individualDomains) {
    images.push({
      buffer: charts.individualDomains,
      title: "Gráfica: dominios",
      row: tableRows.length + 26,
      width: 900,
      height: 400,
    });
  }
  if (images.length) await embedChartImages(wb, graficas, images);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export { INDIVIDUAL_REPORT_SHEETS };

/** Helper para colores individuales alineados a paleta. */
export function individualScoreColors(
  entries: Array<{ riskLevel: string }>
): string[] {
  return entries.map((e) => riskChartHex(e.riskLevel));
}
