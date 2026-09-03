/**
 * B4.27 — XLSX individual: Resumen con gráficas visibles arriba.
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
  embedVisibleChart,
  INDIVIDUAL_REPORT_SHEETS,
  paintKpiBox,
  riskFillColor,
  setLandscapePrint,
  setTextCell,
  setWorkbookActiveFirstSheet,
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
  setWorkbookActiveFirstSheet(wb);

  const ats = hasGuiaITraumaticEvent(worker.answers);
  const clinica = worker.guiaIRequiresClinicalAttention === true;

  const resumen = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[0]);
  applySheetDefaults(resumen, [18, 22, 16, 16, 16, 16, 16, 16], {
    zoomScale: 85,
    showGridLines: false,
  });
  setLandscapePrint(resumen, "A1:H55", 85);

  resumen.mergeCells(1, 1, 1, 8);
  resumen.getCell(1, 1).value = "RESULTADOS NOM-035 2026 — INDIVIDUAL";
  resumen.getCell(1, 1).font = { bold: true, size: 18 };
  resumen.getCell(1, 1).alignment = { horizontal: "center" };
  if (input.companyName) {
    resumen.mergeCells(2, 1, 2, 8);
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
    4,
    "PUNTAJE",
    String(worker.finalScore ?? "—"),
    "FFDBEAFE",
    { rowSpan: 2, colSpan: 2 }
  );
  paintKpiBox(
    resumen,
    4,
    6,
    "NIVEL DE RIESGO",
    formatRiskLevelForReport(worker.finalRiskLevel),
    riskFillColor(worker.finalRiskLevel) ?? "FFE2E8F0",
    { rowSpan: 2, colSpan: 2 }
  );
  paintKpiBox(resumen, 7, 4, "ACONTECIMIENTO TRAUMÁTICO", ats ? "Sí" : "No", ats ? "FFFECACA" : "FFDCFCE7", {
    rowSpan: 2,
    colSpan: 2,
  });
  paintKpiBox(
    resumen,
    7,
    6,
    "VALORACIÓN CLÍNICA",
    clinica ? "Sí" : "No",
    clinica ? "FFFED7AA" : "FFDCFCE7",
    { rowSpan: 2, colSpan: 2 }
  );

  if (charts.individualCategories) {
    embedVisibleChart(wb, resumen, {
      buffer: charts.individualCategories,
      title: "GRÁFICA DE CATEGORÍAS",
      titleRow: 11,
      titleCol: 0,
      tlCol: 0,
      tlRow: 11,
      brCol: 8,
      brRow: 28,
      rowHeightPt: 18,
    });
  }
  if (charts.individualDomains) {
    embedVisibleChart(wb, resumen, {
      buffer: charts.individualDomains,
      title: "GRÁFICA DE DOMINIOS",
      titleRow: 30,
      titleCol: 0,
      tlCol: 0,
      tlRow: 30,
      brCol: 8,
      brRow: 48,
      rowHeightPt: 18,
    });
  }

  const guiaI = wb.addWorksheet(INDIVIDUAL_REPORT_SHEETS[1]);
  applySheetDefaults(guiaI, [10, 60, 24, 12], { freezeRow: 1, zoomScale: 100, showGridLines: true });
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
  applySheetDefaults(guiaIII, [10, 60, 24, 12, 14], {
    freezeRow: 1,
    zoomScale: 100,
    showGridLines: true,
  });
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
  applySheetDefaults(categorias, [36, 12, 18], { freezeRow: 1, zoomScale: 100, showGridLines: true });
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
  applySheetDefaults(dominios, [36, 12, 18], { freezeRow: 1, zoomScale: 100, showGridLines: true });
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
  applySheetDefaults(graficas, [28, 16, 12, 14], {
    freezeRow: 1,
    zoomScale: 100,
    showGridLines: true,
  });
  graficas.addRow(["Tipo", "Etiqueta", "Valor", "Nivel"]);
  styleHeaderRow(graficas);
  const tableRows: Array<[string, string, number, string]> = [
    ...Object.entries(worker.categoryScores).map(
      ([k, v]) =>
        ["Categoría", k, v.score, formatRiskLevelForReport(v.riskLevel)] as [
          string,
          string,
          number,
          string,
        ]
    ),
    ...Object.entries(worker.domainScores).map(
      ([k, v]) =>
        ["Dominio", k, v.score, formatRiskLevelForReport(v.riskLevel)] as [
          string,
          string,
          number,
          string,
        ]
    ),
  ];
  for (const r of tableRows) graficas.addRow(r);
  applyAutoFilter(graficas, 4, tableRows.length + 1);
  if (charts.individualCategories) {
    embedVisibleChart(wb, graficas, {
      buffer: charts.individualCategories,
      title: "Categorías",
      titleRow: tableRows.length + 3,
      tlCol: 0,
      tlRow: tableRows.length + 3,
      brCol: 8,
      brRow: tableRows.length + 20,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export { INDIVIDUAL_REPORT_SHEETS };

export function individualScoreColors(
  entries: Array<{ riskLevel: string }>
): string[] {
  return entries.map((e) => riskChartHex(e.riskLevel));
}
