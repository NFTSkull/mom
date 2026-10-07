/**
 * B4.27 — XLSX consolidado: dashboard chart-first, activeTab Resumen.
 */
import ExcelJS from "exceljs";
import {
  formatRiskLevelForReport,
  hasGuiaITraumaticEvent,
  type Nom035AggregateReport,
} from "@/lib/nom035/aggregate-report";
import {
  formatReportDate,
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
  embedVisibleChart,
  FULL_REPORT_SHEETS,
  paintKpiBox,
  riskFillColor,
  setLandscapePrint,
  setTextCell,
  setWorkbookActiveFirstSheet,
  styleHeaderRow,
} from "@/lib/nom035/report-excel-utils";
import {
  RISK_DISPLAY_LABEL,
  RISK_EXCEL_ARGB,
  RISK_LEVEL_ORDER,
} from "@/lib/nom035/risk-palette";
import {
  ALTO_PLUS_DEFINITION,
  describeAltoPlus,
  describeMedioPlus,
  INTERPRETATION_LINES,
  MEDIO_PLUS_DEFINITION,
  PLUS_NOT_OFFICIAL_NOTE,
  LEVEL_TABLE_TITLES,
  levelTableRows,
  type LevelTableRow,
} from "@/lib/nom035/report-interpretation";
import type { NamedLevelMatrix } from "@/lib/nom035/aggregate-report";
import { EXECUTIVE_CHART_TITLES } from "@/lib/nom035/report-charts";

export const LEVEL_TABLE_TAIL_HEADERS = [
  "Medio+ #",
  "Medio+ %",
  "Alto+ #",
  "Alto+ %",
  "Total",
] as const;

export function levelHeaders(): string[] {
  const out: string[] = [];
  for (const level of RISK_LEVEL_ORDER) {
    const label = RISK_DISPLAY_LABEL[level];
    out.push(`${label} #`, `${label} %`);
  }
  return out;
}

function levelRowValues(m: NamedLevelMatrix): number[] {
  const vals: number[] = [];
  for (const level of RISK_LEVEL_ORDER) {
    vals.push(m.levels[level].count, m.levels[level].percentage);
  }
  vals.push(
    m.medioPlus.count,
    m.medioPlus.percentage,
    m.altoPlus.count,
    m.altoPlus.percentage,
    m.total
  );
  return vals;
}

/** Tabla nivel×fila con Medio+/Alto+; devuelve la última fila escrita. */
function writeLevelTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  leadHeaders: string[],
  rows: Array<{ lead: string[]; matrix: NamedLevelMatrix }>
): number {
  const header = [...leadHeaders, ...levelHeaders(), ...LEVEL_TABLE_TAIL_HEADERS];
  sheet.getRow(startRow).values = header;
  styleHeaderRow(sheet, startRow);
  const offset = leadHeaders.length;
  RISK_LEVEL_ORDER.forEach((level, i) => {
    for (const c of [offset + 1 + i * 2, offset + 2 + i * 2]) {
      sheet.getRow(startRow).getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: RISK_EXCEL_ARGB[level] },
      };
    }
  });
  rows.forEach((r, i) => {
    const row = sheet.getRow(startRow + 1 + i);
    row.values = [...r.lead, ...levelRowValues(r.matrix)];
    row.getCell(1).font = { bold: true };
    row.alignment = { vertical: "middle", wrapText: true };
  });
  const last = startRow + rows.length;
  applyAutoFilter(sheet, header.length, last, startRow);
  return last;
}

function writeNotes(sheet: ExcelJS.Worksheet, startRow: number, lines: string[], colSpan: number): number {
  lines.forEach((line, i) => {
    const r = startRow + i;
    sheet.mergeCells(r, 1, r, colSpan);
    const cell = sheet.getCell(r, 1);
    cell.value = line;
    cell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
    cell.alignment = { wrapText: true, vertical: "top" };
    sheet.getRow(r).height = 28;
  });
  return startRow + lines.length - 1;
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

/**
 * Tabla tipo reporte (Nulo…Muy alto como «conteo (porcentaje%)», Total), sin resaltado.
 * `leadSpans` define cuántas columnas ocupa cada encabezado inicial. Devuelve la última fila.
 */
function writeTabularLevelTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  opts: {
    title: string;
    titleSpan: number;
    leadHeaders: string[];
    leadSpans: number[];
    rows: LevelTableRow[];
  }
): number {
  sheet.mergeCells(startRow, 1, startRow, opts.titleSpan);
  const title = sheet.getCell(startRow, 1);
  title.value = opts.title;
  title.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };

  const headerRow = startRow + 1;
  const columns: Array<{ header: string; span: number }> = [
    ...opts.leadHeaders.map((header, i) => ({ header, span: opts.leadSpans[i] ?? 1 })),
    ...RISK_LEVEL_ORDER.map((l) => ({ header: RISK_DISPLAY_LABEL[l], span: 1 })),
    { header: "Total", span: 1 },
  ];
  const starts: number[] = [];
  let col = 1;
  for (const c of columns) {
    starts.push(col);
    col += c.span;
  }

  const put = (row: number, i: number, value: string | number) => {
    const c0 = starts[i]!;
    const span = columns[i]!.span;
    if (span > 1) sheet.mergeCells(row, c0, row, c0 + span - 1);
    const cell = sheet.getCell(row, c0);
    cell.value = value;
    for (let c = c0; c < c0 + span; c++) sheet.getCell(row, c).border = THIN_BORDER;
    return cell;
  };

  columns.forEach((c, i) => {
    const cell = put(headerRow, i, c.header);
    cell.font = { bold: true, color: { argb: "FF0F172A" } };
    for (let k = starts[i]!; k < starts[i]! + c.span; k++) {
      sheet.getCell(headerRow, k).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
    }
  });
  sheet.getRow(headerRow).height = 22;

  const lead = opts.leadHeaders.length;
  opts.rows.forEach((row, r) => {
    const rn = headerRow + 1 + r;
    const leadValues = [row.name, row.category ?? "—"].slice(0, lead);
    leadValues.forEach((v, i) => {
      const cell = put(rn, i, v);
      cell.alignment = { vertical: "middle", wrapText: true };
      if (i === 0) cell.font = { bold: true };
    });
    row.cells.forEach((levelCell, j) => {
      const cell = put(rn, lead + j, levelCell.text);
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    put(rn, lead + RISK_LEVEL_ORDER.length, row.total).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(rn).height = 30;
  });
  return headerRow + opts.rows.length;
}

const DEFINITION_NOTES = [
  MEDIO_PLUS_DEFINITION,
  ALTO_PLUS_DEFINITION,
  PLUS_NOT_OFFICIAL_NOTE,
];

export async function buildFullReportXlsxBuffer(input: {
  report: NormalizedFullReport;
  aggregate: Nom035AggregateReport;
  charts: ReportChartImages;
}): Promise<Buffer> {
  const { report, aggregate: agg, charts } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NOM-035";
  wb.created = new Date();
  wb.description = `Versión de reporte ${agg.presentationVersion}`;
  setWorkbookActiveFirstSheet(wb);

  // —— 1. Resumen Ejecutivo (dashboard) ——
  const resumen = wb.addWorksheet(FULL_REPORT_SHEETS[0]);
  applySheetDefaults(
    resumen,
    [14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14],
    { zoomScale: 85, showGridLines: false }
  );

  resumen.mergeCells(1, 1, 1, 12);
  resumen.getCell(1, 1).value = "RESULTADOS NOM-035 2026";
  resumen.getCell(1, 1).font = { bold: true, size: 22, color: { argb: "FF0F172A" } };
  resumen.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  resumen.getRow(1).height = 32;

  resumen.mergeCells(2, 1, 2, 12);
  resumen.getCell(2, 1).value = agg.companyName;
  resumen.getCell(2, 1).font = { size: 14, color: { argb: "FF334155" } };
  resumen.getCell(2, 1).alignment = { horizontal: "center" };

  resumen.mergeCells(3, 1, 3, 12);
  resumen.getCell(3, 1).value = `GENERADO: ${formatReportDate(agg.generatedAt)} · VERSIÓN DE REPORTE: ${agg.presentationVersion}`;
  resumen.getCell(3, 1).font = { size: 10, color: { argb: "FF64748B" } };
  resumen.getCell(3, 1).alignment = { horizontal: "center" };

  paintKpiBox(resumen, 4, 1, "MODELO", agg.modelLabel, "FFDBEAFE", {
    rowSpan: 3,
    colSpan: 3,
  });
  paintKpiBox(
    resumen,
    4,
    4,
    "PERSONAL EVALUADO",
    String(agg.population.realCompleted),
    "FFDCFCE7",
    { rowSpan: 3, colSpan: 2 }
  );
  paintKpiBox(
    resumen,
    4,
    6,
    "RIESGO PREDOMINANTE",
    `${agg.predominantRisk.label}\n${agg.predominantRisk.count} de ${agg.population.realResults} (${agg.predominantRisk.percentage}%)`,
    "FFFEF08A",
    { rowSpan: 3, colSpan: 3 }
  );
  paintKpiBox(
    resumen,
    4,
    9,
    "ESTADO",
    agg.campaignStatusLabel,
    "FFF1F5F9",
    { rowSpan: 3, colSpan: 2 }
  );

  // Gráfica principal visible sin scroll excesivo (filas Excel 8–26 ≈ drawing 7–26)
  embedVisibleChart(wb, resumen, {
    buffer: charts.riskDistribution,
    title: "CALIFICACIÓN FINAL DE RIESGOS PSICOSOCIALES",
    titleRow: 8,
    titleCol: 0,
    tlCol: 0,
    tlRow: 8,
    brCol: 8,
    brRow: 26,
    rowHeightPt: 18,
  });

  paintKpiBox(
    resumen,
    8,
    10,
    "ACONTECIMIENTO TRAUMÁTICO SEVERO",
    `${agg.traumaticEvent.yes}\n${agg.traumaticEvent.percentageYes}%`,
    "FFFECACA",
    { rowSpan: 4, colSpan: 3 }
  );
  paintKpiBox(
    resumen,
    13,
    10,
    "PERSONAL QUE REQUIERE VALORACIÓN CLÍNICA",
    `${agg.clinicalAttention.yes}\n${agg.clinicalAttention.percentageYes}%`,
    "FFFED7AA",
    { rowSpan: 4, colSpan: 3 }
  );
  paintKpiBox(
    resumen,
    18,
    10,
    "RESUMEN DE AVANCE",
    `Completados: ${agg.population.realCompleted}\nPendientes: ${agg.population.realPending}\nEn progreso: ${agg.population.realInProgress}`,
    "FFE0F2FE",
    { rowSpan: 5, colSpan: 3 }
  );

  // —— Tablas por categoría y dominio (formato reporte) ——
  let techTop = writeTabularLevelTable(resumen, 28, {
    title: LEVEL_TABLE_TITLES.categories.toUpperCase(),
    titleSpan: 12,
    leadHeaders: ["Categoría"],
    leadSpans: [3],
    rows: levelTableRows(agg.categories),
  });
  techTop = writeTabularLevelTable(resumen, techTop + 2, {
    title: LEVEL_TABLE_TITLES.domains.toUpperCase(),
    titleSpan: 12,
    leadHeaders: ["Dominio", "Categoría"],
    leadSpans: [3, 2],
    rows: levelTableRows(agg.domains),
  });
  techTop += 2;

  // —— Lectura prioritaria (distribución por nivel; nunca puntaje bruto) ——
  resumen.mergeCells(techTop, 1, techTop, 12);
  resumen.getCell(techTop, 1).value = "DETALLE TÉCNICO — LECTURA PRIORITARIA";
  resumen.getCell(techTop, 1).font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
  resumen.getCell(techTop, 1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  const pDom = agg.priorityReading.domainHighestAltoPlus;
  const pCat = agg.priorityReading.categoryHighestMedioPlus;
  paintKpiBox(
    resumen,
    techTop + 1,
    1,
    "DOMINIO CON MAYOR ALTO+ (ALTO + MUY ALTO)",
    pDom
      ? `${pDom.name}\n${pDom.count}/${pDom.total}\n${pDom.percentage}%`
      : "Sin trabajadores en Alto/Muy alto",
    "FFFED7AA",
    { rowSpan: 4, colSpan: 6 }
  );
  paintKpiBox(
    resumen,
    techTop + 1,
    7,
    "CATEGORÍA CON MAYOR MEDIO+ (MEDIO + ALTO + MUY ALTO)",
    pCat
      ? `${pCat.name}\n${pCat.count}/${pCat.total}\n${pCat.percentage}%`
      : "Sin trabajadores en Medio o superior",
    "FFFEF9C3",
    { rowSpan: 4, colSpan: 6 }
  );
  const readingLines: string[] = [];
  if (pDom) readingLines.push(`${pDom.name}: ${describeAltoPlus(pDom.percentage, "dominio")}`);
  if (pCat) readingLines.push(`${pCat.name}: ${describeMedioPlus(pCat.percentage, "categoría")}`);
  readingLines.push(DEFINITION_NOTES.join(" "));
  writeNotes(resumen, techTop + 5, readingLines, 12);

  const rankHead = techTop + 5 + readingLines.length + 1;
  resumen.mergeCells(rankHead, 1, rankHead, 6);
  resumen.getCell(rankHead, 1).value = "DOMINIOS CON MAYOR PROPORCIÓN ALTO / MUY ALTO";
  resumen.getCell(rankHead, 1).font = { bold: true, size: 11 };
  resumen.mergeCells(rankHead, 7, rankHead, 12);
  resumen.getCell(rankHead, 7).value = "CATEGORÍAS CON MAYOR PROPORCIÓN MEDIO O SUPERIOR";
  resumen.getCell(rankHead, 7).font = { bold: true, size: 11 };

  const rankCols = rankHead + 1;
  resumen.mergeCells(rankCols, 1, rankCols, 4);
  resumen.getCell(rankCols, 1).value = "Dominio";
  resumen.getCell(rankCols, 5).value = "Alto+ (n de N)";
  resumen.getCell(rankCols, 6).value = "Alto+ %";
  resumen.mergeCells(rankCols, 7, rankCols, 8);
  resumen.getCell(rankCols, 7).value = "Categoría";
  resumen.getCell(rankCols, 9).value = "Medio+ (n de N)";
  resumen.getCell(rankCols, 10).value = "Medio+ %";
  resumen.getCell(rankCols, 11).value = "Alto+ (n de N)";
  resumen.getCell(rankCols, 12).value = "Alto+ %";
  styleHeaderRow(resumen, rankCols);

  if (agg.topDomainsHighRisk.length === 0) {
    resumen.mergeCells(rankCols + 1, 1, rankCols + 1, 6);
    resumen.getCell(rankCols + 1, 1).value = "Sin trabajadores en Alto/Muy alto.";
  }
  agg.topDomainsHighRisk.forEach((item, i) => {
    const r = rankCols + 1 + i;
    resumen.mergeCells(r, 1, r, 4);
    resumen.getCell(r, 1).value = `${i + 1}. ${item.name}`;
    resumen.getCell(r, 5).value = `${item.count} de ${item.total}`;
    resumen.getCell(r, 6).value = `${item.percentage}%`;
  });
  agg.categoriesPriority.forEach((item, i) => {
    const r = rankCols + 1 + i;
    resumen.mergeCells(r, 7, r, 8);
    resumen.getCell(r, 7).value = `${i + 1}. ${item.name}`;
    resumen.getCell(r, 9).value = `${item.medioPlus.count} de ${item.total}`;
    resumen.getCell(r, 10).value = `${item.medioPlus.percentage}%`;
    resumen.getCell(r, 11).value = `${item.altoPlus.count} de ${item.total}`;
    resumen.getCell(r, 12).value = `${item.altoPlus.percentage}%`;
  });
  const rankRows = Math.max(agg.topDomainsHighRisk.length, agg.categoriesPriority.length, 1);
  for (let r = rankCols + 1; r <= rankCols + rankRows; r++) {
    resumen.getRow(r).alignment = { vertical: "middle", wrapText: true };
    resumen.getRow(r).height = 30;
  }
  setLandscapePrint(resumen, `A1:L${rankCols + rankRows}`, 85);

  // —— 2. Categorías (tabla tipo reporte arriba; gráfica y matriz como detalle técnico) ——
  const categorias = wb.addWorksheet(FULL_REPORT_SHEETS[1]);
  applySheetDefaults(
    categorias,
    [36, 13, 13, 13, 13, 13, 9, 13, 9, 9, 9, 10, 10, 10, 10, 9],
    { zoomScale: 85, showGridLines: false }
  );
  categorias.mergeCells(1, 1, 2, 16);
  categorias.getCell(1, 1).value = `RESULTADOS POR CATEGORÍA\nPERSONAL EVALUADO EN CADA NIVEL (N = ${agg.population.realResults}) · CONTEO (PORCENTAJE)`;
  categorias.getCell(1, 1).font = { bold: true, size: 14 };
  categorias.getCell(1, 1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  categorias.getRow(1).height = 22;
  categorias.getRow(2).height = 22;

  const catTableLast = writeTabularLevelTable(categorias, 4, {
    title: "TABLA DE CATEGORÍAS",
    titleSpan: 7,
    leadHeaders: ["Categoría"],
    leadSpans: [1],
    rows: levelTableRows(agg.categories),
  });

  const catTech = catTableLast + 2;
  categorias.mergeCells(catTech, 1, catTech, 16);
  categorias.getCell(catTech, 1).value = `DETALLE TÉCNICO — ${EXECUTIVE_CHART_TITLES.categories}`;
  categorias.getCell(catTech, 1).font = { bold: true, size: 12 };
  embedVisibleChart(wb, categorias, {
    buffer: charts.categoriesDistribution,
    tlCol: 0,
    tlRow: catTech,
    brCol: 14,
    brRow: catTech + 18,
    rowHeightPt: 20,
  });

  const catLast = writeLevelTable(
    categorias,
    catTech + 21,
    ["Categoría"],
    agg.categories.map((c) => ({ lead: [c.name], matrix: c }))
  );
  const catNotesLast = writeNotes(categorias, catLast + 2, DEFINITION_NOTES, 16);
  setLandscapePrint(categorias, `A1:P${catNotesLast}`, 85);

  // —— 3. Dominios (tabla tipo reporte arriba; gráficas y matriz como detalle técnico) ——
  const dominios = wb.addWorksheet(FULL_REPORT_SHEETS[2]);
  applySheetDefaults(
    dominios,
    [34, 30, 13, 13, 13, 13, 13, 9, 13, 9, 9, 9, 10, 10, 10, 10, 9],
    { zoomScale: 80, showGridLines: false }
  );
  dominios.mergeCells(1, 1, 2, 17);
  dominios.getCell(1, 1).value = `RESULTADOS POR DOMINIO\nPERSONAL EVALUADO EN CADA NIVEL (N = ${agg.population.realResults}) · CONTEO (PORCENTAJE)`;
  dominios.getCell(1, 1).font = { bold: true, size: 14 };
  dominios.getCell(1, 1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  const domTableLast = writeTabularLevelTable(dominios, 4, {
    title: "TABLA DE DOMINIOS",
    titleSpan: 8,
    leadHeaders: ["Dominio", "Categoría"],
    leadSpans: [1, 1],
    rows: levelTableRows(agg.domains),
  });

  const domTech = domTableLast + 2;
  dominios.mergeCells(domTech, 1, domTech, 17);
  dominios.getCell(domTech, 1).value = "DETALLE TÉCNICO — DISTRIBUCIÓN DE RIESGO POR DOMINIO";
  dominios.getCell(domTech, 1).font = { bold: true, size: 12 };
  embedVisibleChart(wb, dominios, {
    buffer: charts.domainsDistribution,
    title: "DOMINIOS 1/2",
    titleRow: domTech + 1,
    titleCol: 0,
    tlCol: 0,
    tlRow: domTech + 1,
    brCol: 13,
    brRow: domTech + 20,
    rowHeightPt: 20,
  });
  let domChartsEnd = domTech + 20;
  if (charts.domainsDistributionB) {
    embedVisibleChart(wb, dominios, {
      buffer: charts.domainsDistributionB,
      title: "DOMINIOS 2/2",
      titleRow: domTech + 22,
      titleCol: 0,
      tlCol: 0,
      tlRow: domTech + 22,
      brCol: 13,
      brRow: domTech + 41,
      rowHeightPt: 20,
    });
    domChartsEnd = domTech + 41;
  }

  const domLast = writeLevelTable(
    dominios,
    domChartsEnd + 3,
    ["Dominio", "Categoría"],
    agg.domains.map((d) => ({ lead: [d.name, d.category ?? ""], matrix: d }))
  );
  const domNotesLast = writeNotes(dominios, domLast + 2, DEFINITION_NOTES, 17);
  setLandscapePrint(dominios, `A1:Q${domNotesLast}`, 80);

  // —— 4. Distribución Final ——
  const dist = wb.addWorksheet(FULL_REPORT_SHEETS[3]);
  applySheetDefaults(dist, [14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14], {
    zoomScale: 85,
    showGridLines: false,
  });
  setLandscapePrint(dist, "A1:L40", 85);
  dist.mergeCells(1, 1, 2, 12);
  dist.getCell(1, 1).value = "CALIFICACIÓN FINAL DE RIESGOS PSICOSOCIALES";
  dist.getCell(1, 1).font = { bold: true, size: 16 };
  dist.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };

  embedVisibleChart(wb, dist, {
    buffer: charts.riskDistribution,
    title: "No. de personas + %",
    titleRow: 3,
    titleCol: 0,
    tlCol: 0,
    tlRow: 3,
    brCol: 7,
    brRow: 22,
    rowHeightPt: 20,
  });
  embedVisibleChart(wb, dist, {
    buffer: charts.riskDistributionPct,
    title: "Porcentaje",
    titleRow: 3,
    titleCol: 8,
    tlCol: 8,
    tlRow: 3,
    brCol: 12,
    brRow: 22,
    rowHeightPt: 20,
  });

  const distTableStart = 24;
  dist.getRow(distTableStart).values = ["Nivel", "Personas", "Porcentaje %"];
  styleHeaderRow(dist, distTableStart);
  let distRows = 0;
  for (const row of agg.overallRiskDistribution) {
    const excelRow = dist.getRow(distTableStart + 1 + distRows);
    excelRow.values = [row.label, row.count, row.percentage];
    const fill = riskFillColor(row.level);
    if (fill) {
      excelRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    }
    distRows += 1;
  }
  dist.getRow(distTableStart + 1 + distRows).values = [
    "TOTAL",
    agg.population.realResults,
    agg.overallRiskDistribution.reduce((a, b) => a + b.percentage, 0),
  ];
  applyAutoFilter(dist, 3, distTableStart + distRows, distTableStart);

  // —— 5. Acontecimiento Traumático ——
  const ats = wb.addWorksheet(FULL_REPORT_SHEETS[4]);
  applySheetDefaults(ats, [22, 14, 14, 14, 14, 14, 14, 14], {
    zoomScale: 85,
    showGridLines: false,
  });
  setLandscapePrint(ats, "A1:H35", 85);
  ats.mergeCells(1, 1, 1, 8);
  ats.getCell(1, 1).value = "Acontecimiento Traumático Severo — Guía I";
  ats.getCell(1, 1).font = { bold: true, size: 16 };
  ats.getCell(1, 1).alignment = { horizontal: "center" };

  paintKpiBox(
    ats,
    3,
    1,
    "PERSONAL EVALUADO",
    String(agg.traumaticEvent.denominator),
    "FFDCFCE7",
    { rowSpan: 3, colSpan: 1 }
  );
  paintKpiBox(ats, 3, 2, "ATS SÍ", String(agg.traumaticEvent.yes), "FFFECACA", {
    rowSpan: 3,
    colSpan: 1,
  });
  paintKpiBox(
    ats,
    3,
    3,
    "ATS %",
    `${agg.traumaticEvent.percentageYes}%`,
    "FFFEE2E2",
    { rowSpan: 3, colSpan: 1 }
  );
  paintKpiBox(
    ats,
    3,
    4,
    "VALORACIÓN CLÍNICA",
    String(agg.clinicalAttention.yes),
    "FFFED7AA",
    { rowSpan: 3, colSpan: 2 }
  );
  paintKpiBox(
    ats,
    3,
    6,
    "% CLÍNICA",
    `${agg.clinicalAttention.percentageYes}%`,
    "FFFFEDD5",
    { rowSpan: 3, colSpan: 1 }
  );

  embedVisibleChart(wb, ats, {
    buffer: charts.traumaticEvent,
    tlCol: 0,
    tlRow: 6,
    brCol: 8,
    brRow: 22,
    rowHeightPt: 20,
  });

  const atsTableStart = 24;
  ats.getRow(atsTableStart).values = ["Indicador", "Sí", "No", "Porcentaje Sí"];
  styleHeaderRow(ats, atsTableStart);
  ats.getRow(atsTableStart + 1).values = [
    "Acontecimiento traumático severo reportado",
    agg.traumaticEvent.yes,
    agg.traumaticEvent.no,
    agg.traumaticEvent.percentageYes,
  ];
  ats.getRow(atsTableStart + 2).values = [
    "Criterio de valoración clínica",
    agg.clinicalAttention.yes,
    agg.clinicalAttention.no,
    agg.clinicalAttention.percentageYes,
  ];
  ats.getCell(atsTableStart + 4, 1).value =
    `Se evaluaron ${agg.traumaticEvent.denominator} trabajadores mediante Guía de Referencia I.`;
  applyAutoFilter(ats, 4, atsTableStart + 2, atsTableStart);

  // —— 6. Completados ——
  const completados = wb.addWorksheet(FULL_REPORT_SHEETS[5]);
  applySheetDefaults(completados, [10, 32, 20, 18, 12, 18, 18, 16, 10, 14], {
    freezeRow: 1,
    zoomScale: 100,
    showGridLines: true,
  });
  completados.addRow([
    "Usuario",
    "Nombre",
    "Puesto",
    "Departamento",
    "Estado",
    "Fecha inicio",
    "Fecha envío",
    "Resultado general",
    "Puntaje",
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
      formatRiskLevelForReport(w.finalRiskLevel),
      w.finalScore,
      formatRiskLevelForReport(w.finalRiskLevel),
    ]);
    setTextCell(row.getCell(1), w.username);
    const fill = riskFillColor(w.finalRiskLevel);
    if (fill) {
      row.getCell(10).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    }
  }
  applyAutoFilter(completados, 10, report.workers.length + 1);

  // —— 7. Resultados Individuales ——
  const individuales = wb.addWorksheet(FULL_REPORT_SHEETS[6]);
  const indHeaders = [
    "Usuario",
    "Nombre",
    "Puntaje final",
    "Nivel",
    "Fecha envío",
    "ATS",
    "Valoración clínica",
    ...agg.categories.map((c) => `Cat: ${c.name}`),
    ...agg.domains.map((d) => `Dom: ${d.name}`),
  ];
  applySheetDefaults(
    individuales,
    indHeaders.map((_, i) => (i < 2 ? 28 : i < 7 ? 14 : 18)),
    { freezeRow: 1, zoomScale: 100, showGridLines: true }
  );
  individuales.addRow(indHeaders);
  styleHeaderRow(individuales);
  for (const w of report.workers) {
    const vals: Array<string | number | null> = [
      w.username,
      w.nombre,
      w.finalScore,
      formatRiskLevelForReport(w.finalRiskLevel),
      formatReportDate(w.completedAt),
      hasGuiaITraumaticEvent(w.answers) ? "Sí" : "No",
      w.guiaIRequiresClinicalAttention ? "Sí" : "No",
    ];
    for (const cat of agg.categories) {
      const entry = w.categoryScores[cat.name];
      vals.push(
        entry
          ? `${entry.score} (${formatRiskLevelForReport(entry.riskLevel)})`
          : "—"
      );
    }
    for (const dom of agg.domains) {
      const entry = w.domainScores[dom.name];
      vals.push(
        entry
          ? `${entry.score} (${formatRiskLevelForReport(entry.riskLevel)})`
          : "—"
      );
    }
    const row = individuales.addRow(vals);
    setTextCell(row.getCell(1), w.username);
  }
  applyAutoFilter(individuales, indHeaders.length, report.workers.length + 1);

  // —— 8. Guía I ——
  const guiaI = wb.addWorksheet(FULL_REPORT_SHEETS[7]);
  applySheetDefaults(guiaI, [10, 32, 10, 60, 24, 28], {
    freezeRow: 1,
    zoomScale: 100,
    showGridLines: true,
  });
  guiaI.addRow([
    "Usuario",
    "Nombre",
    "Número pregunta",
    "Pregunta",
    "Respuesta",
    "Diagnóstico/resultado aplicable",
  ]);
  styleHeaderRow(guiaI);
  let guiaIRowCount = 1;
  for (const w of report.workers) {
    for (const a of orderedGuiaIAnswerRows(w.answers)) {
      let diag = "—";
      if (a.questionId === "guia_i_1") {
        diag = hasGuiaITraumaticEvent([a])
          ? "Acontecimiento traumático: Sí"
          : "Acontecimiento traumático: No";
      } else if (
        w.guiaIRequiresClinicalAttention != null &&
        a.questionId.startsWith("guia_i_")
      ) {
        diag =
          w.guiaIRequiresClinicalAttention === true
            ? "Valoración clínica: Sí"
            : "Valoración clínica: No";
      }
      const row = guiaI.addRow([
        w.username,
        w.nombre,
        guiaIQuestionNumber(a.questionId),
        guiaIQuestionText(a.questionId),
        formatAnswerDisplay(a),
        diag,
      ]);
      setTextCell(row.getCell(1), w.username);
      row.getCell(4).alignment = { wrapText: true };
      guiaIRowCount += 1;
    }
  }
  applyAutoFilter(guiaI, 6, guiaIRowCount);

  // —— 9. Guía III ——
  const guiaIII = wb.addWorksheet(FULL_REPORT_SHEETS[8]);
  applySheetDefaults(guiaIII, [10, 32, 10, 60, 24, 12, 14], {
    freezeRow: 1,
    zoomScale: 100,
    showGridLines: true,
  });
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
        a.status === "no_aplicable" ? "No aplicable" : formatAnswerDisplay(a),
        a.status === "no_aplicable" ? "No aplicable" : (a.answerValue ?? ""),
        a.status === "no_aplicable" ? "No aplicable" : "Respondida",
      ]);
      setTextCell(row.getCell(1), w.username);
      row.getCell(4).alignment = { wrapText: true };
      guiaIIIRowCount += 1;
    }
  }
  applyAutoFilter(guiaIII, 7, guiaIIIRowCount);

  // —— 10. Datos para Gráficas ——
  const datos = wb.addWorksheet(FULL_REPORT_SHEETS[9]);
  applySheetDefaults(datos, [28, 36, 14, 14], {
    freezeRow: 1,
    zoomScale: 100,
    showGridLines: true,
  });
  datos.addRow(["Sección", "Etiqueta", "Campo", "Valor"]);
  styleHeaderRow(datos);
  const push = (
    section: string,
    label: string,
    field: string,
    value: string | number
  ) => {
    datos.addRow([section, label, field, value]);
  };
  for (const row of agg.overallRiskDistribution) {
    push("A. Distribución final", row.shortLabel, "count", row.count);
    push("A. Distribución final", row.shortLabel, "percentage", row.percentage);
  }
  const pushMatrix = (section: string, m: NamedLevelMatrix) => {
    for (const level of RISK_LEVEL_ORDER) {
      push(section, m.name, `${level}_count`, m.levels[level].count);
      push(section, m.name, `${level}_pct`, m.levels[level].percentage);
    }
    push(section, m.name, "medio_plus_count", m.medioPlus.count);
    push(section, m.name, "medio_plus_pct", m.medioPlus.percentage);
    push(section, m.name, "alto_plus_count", m.altoPlus.count);
    push(section, m.name, "alto_plus_pct", m.altoPlus.percentage);
    push(section, m.name, "total", m.total);
  };
  for (const cat of agg.categories) pushMatrix("B. Categorías × nivel", cat);
  for (const dom of agg.domains) pushMatrix("C. Dominios × nivel", dom);
  push("D. ATS", "Sí", "count", agg.traumaticEvent.yes);
  push("D. ATS", "No", "count", agg.traumaticEvent.no);
  push("D. ATS", "Sí", "percentage", agg.traumaticEvent.percentageYes);
  push("E. Valoración clínica", "Sí", "count", agg.clinicalAttention.yes);
  push("E. Valoración clínica", "No", "count", agg.clinicalAttention.no);
  push("E. Valoración clínica", "Sí", "percentage", agg.clinicalAttention.percentageYes);
  push("F. Avance", "Completados", "count", agg.population.realCompleted);
  push("F. Avance", "Pendientes", "count", agg.population.realPending);
  push("F. Avance", "En progreso", "count", agg.population.realInProgress);
  agg.topDomainsHighRisk.forEach((item, i) => {
    push("G. Top dominios Alto+", `${i + 1}. ${item.name}`, "alto_plus_count", item.count);
    push("G. Top dominios Alto+", `${i + 1}. ${item.name}`, "alto_plus_pct", item.percentage);
  });
  agg.topCategoriesMediumPlus.forEach((item, i) => {
    push("H. Top categorías Medio+", `${i + 1}. ${item.name}`, "medio_plus_count", item.count);
    push("H. Top categorías Medio+", `${i + 1}. ${item.name}`, "medio_plus_pct", item.percentage);
  });
  applyAutoFilter(datos, 4, datos.rowCount);
  try {
    datos.state = "hidden";
  } catch {
    /* optional */
  }

  // —— 11. Metodología ——
  const metodo = wb.addWorksheet(FULL_REPORT_SHEETS[10]);
  applySheetDefaults(metodo, [28, 72], { freezeRow: 1, zoomScale: 100, showGridLines: true });
  const metodoRows: Array<[string, string]> = [
    ["NORMA", "NOM-035-STPS-2018"],
    ["MODELO APLICADO", "Guía de Referencia I + Guía de Referencia III"],
    ["MODELO (etiqueta)", agg.modelLabel],
    ["POBLACIÓN", String(agg.population.realWorkers)],
    ["RESPUESTAS COMPLETAS", String(agg.population.realCompleted)],
    ["RESULTADOS INCLUIDOS", String(agg.population.realResults)],
    ["TEST EXCLUIDOS (almacenados)", String(agg.population.testResultsStored)],
    ["TEST INCLUIDOS EN MÉTRICAS", String(agg.population.testResultsIncluded)],
    ["FECHA DE GENERACIÓN", formatReportDate(agg.generatedAt)],
    ["VERSIÓN DE REPORTE", agg.presentationVersion],
    ["SCORING VERSION", agg.scoringVersion ?? "—"],
    ["QUESTIONNAIRE VERSION", agg.questionnaireVersion ?? "—"],
    ["EMPRESA", agg.companyName],
    ["CAMPAÑA", agg.campaignName],
    ["ESTADO CAMPAÑA", agg.campaignStatusLabel],
    ["", ""],
    ["Nulo", agg.levelDefinitions.nulo],
    ["Bajo", agg.levelDefinitions.bajo],
    ["Medio", agg.levelDefinitions.medio],
    ["Alto", agg.levelDefinitions.alto],
    ["Muy alto", agg.levelDefinitions.muy_alto],
  ];
  metodo.addRow(["Campo", "Valor"]);
  styleHeaderRow(metodo);
  for (const [k, v] of metodoRows) {
    const row = metodo.addRow([k, v]);
    row.getCell(2).alignment = { wrapText: true };
  }

  metodo.addRow(["", ""]);
  const howTo = metodo.addRow(["CÓMO INTERPRETAR", ""]);
  howTo.font = { bold: true, size: 12 };
  howTo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  INTERPRETATION_LINES.forEach((line, i) => {
    const row = metodo.addRow([i === 0 ? "Lectura agregada" : "", line]);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.height = 44;
  });
  const example = [...agg.domains].sort(
    (a, b) => b.medioPlus.percentage - a.medioPlus.percentage
  )[0];
  if (example && example.medioPlus.count > 0) {
    const row = metodo.addRow([
      "Ejemplo de redacción",
      `${example.name}: ${describeMedioPlus(example.medioPlus.percentage, "dominio")}`,
    ]);
    row.getCell(2).alignment = { wrapText: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export { FULL_REPORT_SHEETS };
