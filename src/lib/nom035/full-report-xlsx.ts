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
import { RISK_LEVEL_ORDER } from "@/lib/nom035/risk-palette";

function levelHeaders(): string[] {
  const out: string[] = [];
  for (const level of RISK_LEVEL_ORDER) {
    const label =
      level === "nulo"
        ? "Nulo"
        : level === "bajo"
          ? "Bajo"
          : level === "medio"
            ? "Medio"
            : level === "alto"
              ? "Alto"
              : "Muy Alto";
    out.push(`${label} #`, `${label} %`);
  }
  return out;
}

export async function buildFullReportXlsxBuffer(input: {
  report: NormalizedFullReport;
  aggregate: Nom035AggregateReport;
  charts: ReportChartImages;
}): Promise<Buffer> {
  const { report, aggregate: agg, charts } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NOM-035";
  wb.created = new Date();
  setWorkbookActiveFirstSheet(wb);

  // —— 1. Resumen Ejecutivo (dashboard) ——
  const resumen = wb.addWorksheet(FULL_REPORT_SHEETS[0]);
  applySheetDefaults(
    resumen,
    [14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14],
    { zoomScale: 85, showGridLines: false }
  );
  setLandscapePrint(resumen, "A1:L40", 85);

  resumen.mergeCells(1, 1, 1, 12);
  resumen.getCell(1, 1).value = "RESULTADOS NOM-035 2026";
  resumen.getCell(1, 1).font = { bold: true, size: 22, color: { argb: "FF0F172A" } };
  resumen.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  resumen.getRow(1).height = 32;

  resumen.mergeCells(2, 1, 2, 12);
  resumen.getCell(2, 1).value = agg.companyName;
  resumen.getCell(2, 1).font = { size: 14, color: { argb: "FF334155" } };
  resumen.getCell(2, 1).alignment = { horizontal: "center" };

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

  resumen.getCell(28, 1).value =
    "DOMINIOS CON MAYOR CONCENTRACIÓN DE RIESGO ALTO / MUY ALTO";
  resumen.getCell(28, 1).font = { bold: true, size: 11 };
  resumen.mergeCells(28, 1, 28, 6);
  const tipRow = 29;
  if (agg.topDomainsHighRisk.length === 0) {
    resumen.getCell(tipRow, 1).value = "Sin concentraciones Alto/Muy alto.";
  } else {
    agg.topDomainsHighRisk.forEach((item, i) => {
      resumen.getCell(tipRow + i, 1).value =
        `${i + 1}. ${item.name} — ${item.count} (${item.percentage}%)`;
      resumen.mergeCells(tipRow + i, 1, tipRow + i, 6);
    });
  }

  resumen.getCell(28, 7).value =
    "CATEGORÍAS CON MAYOR CONCENTRACIÓN DE RIESGO MEDIO / ALTO / MUY ALTO";
  resumen.getCell(28, 7).font = { bold: true, size: 11 };
  resumen.mergeCells(28, 7, 28, 12);
  agg.topCategoriesMediumPlus.forEach((item, i) => {
    resumen.getCell(29 + i, 7).value =
      `${i + 1}. ${item.name} — ${item.count} (${item.percentage}%)`;
    resumen.mergeCells(29 + i, 7, 29 + i, 12);
  });

  // —— 2. Categorías (gráfica arriba) ——
  const categorias = wb.addWorksheet(FULL_REPORT_SHEETS[1]);
  applySheetDefaults(
    categorias,
    [36, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12],
    { zoomScale: 85, showGridLines: false }
  );
  setLandscapePrint(categorias, "A1:L45", 85);
  categorias.mergeCells(1, 1, 2, 12);
  categorias.getCell(1, 1).value =
    "CALIFICACIÓN DE CATEGORÍAS DE RIESGOS PSICOSOCIALES\nPOR TOTAL DE PERSONAL EVALUADO";
  categorias.getCell(1, 1).font = { bold: true, size: 14 };
  categorias.getCell(1, 1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  categorias.getRow(1).height = 22;
  categorias.getRow(2).height = 22;

  embedVisibleChart(wb, categorias, {
    buffer: charts.categoriesGrouped,
    tlCol: 0,
    tlRow: 3,
    brCol: 12,
    brRow: 24,
    rowHeightPt: 20,
  });

  const catHeader = ["Categoría", ...levelHeaders(), "Total"];
  const catTableStart = 27;
  categorias.getRow(catTableStart).values = catHeader;
  styleHeaderRow(categorias, catTableStart);
  let catDataRows = 0;
  for (const cat of agg.categories) {
    const rowVals: Array<string | number> = [cat.name];
    for (const level of RISK_LEVEL_ORDER) {
      rowVals.push(cat.levels[level].count, cat.levels[level].percentage);
    }
    rowVals.push(cat.total);
    categorias.getRow(catTableStart + 1 + catDataRows).values = rowVals;
    catDataRows += 1;
  }
  applyAutoFilter(categorias, catHeader.length, catTableStart + catDataRows, catTableStart);

  // —— 3. Dominios (gráficas arriba) ——
  const dominios = wb.addWorksheet(FULL_REPORT_SHEETS[2]);
  applySheetDefaults(
    dominios,
    [34, 28, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
    { zoomScale: 80, showGridLines: false }
  );
  setLandscapePrint(dominios, "A1:M70", 80);
  dominios.mergeCells(1, 1, 2, 13);
  dominios.getCell(1, 1).value =
    "CALIFICACIÓN DE DOMINIOS DE RIESGOS PSICOSOCIALES\nPOR TOTAL DE PERSONAL EVALUADO";
  dominios.getCell(1, 1).font = { bold: true, size: 14 };
  dominios.getCell(1, 1).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  embedVisibleChart(wb, dominios, {
    buffer: charts.domainsGrouped,
    title: "DOMINIOS 1/2",
    titleRow: 3,
    titleCol: 0,
    tlCol: 0,
    tlRow: 3,
    brCol: 13,
    brRow: 24,
    rowHeightPt: 20,
  });
  if (charts.domainsGroupedB) {
    embedVisibleChart(wb, dominios, {
      buffer: charts.domainsGroupedB,
      title: "DOMINIOS 2/2",
      titleRow: 26,
      titleCol: 0,
      tlCol: 0,
      tlRow: 26,
      brCol: 13,
      brRow: 47,
      rowHeightPt: 20,
    });
  }

  const domHeader = ["Dominio", "Categoría", ...levelHeaders(), "Total"];
  const domTableStart = 50;
  dominios.getRow(domTableStart).values = domHeader;
  styleHeaderRow(dominios, domTableStart);
  let domDataRows = 0;
  for (const dom of agg.domains) {
    const rowVals: Array<string | number> = [dom.name, dom.category ?? ""];
    for (const level of RISK_LEVEL_ORDER) {
      rowVals.push(dom.levels[level].count, dom.levels[level].percentage);
    }
    rowVals.push(dom.total);
    dominios.getRow(domTableStart + 1 + domDataRows).values = rowVals;
    domDataRows += 1;
  }
  applyAutoFilter(dominios, domHeader.length, domTableStart + domDataRows, domTableStart);

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
  for (const cat of agg.categories) {
    for (const level of RISK_LEVEL_ORDER) {
      push("B. Categorías × nivel", cat.name, `${level}_count`, cat.levels[level].count);
      push("B. Categorías × nivel", cat.name, `${level}_pct`, cat.levels[level].percentage);
    }
  }
  for (const dom of agg.domains) {
    for (const level of RISK_LEVEL_ORDER) {
      push("C. Dominios × nivel", dom.name, `${level}_count`, dom.levels[level].count);
      push("C. Dominios × nivel", dom.name, `${level}_pct`, dom.levels[level].percentage);
    }
  }
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
    push("G. Top dominios", `${i + 1}. ${item.name}`, "count", item.count);
    push("G. Top dominios", `${i + 1}. ${item.name}`, "percentage", item.percentage);
  });
  agg.topCategoriesMediumPlus.forEach((item, i) => {
    push("H. Top categorías", `${i + 1}. ${item.name}`, "count", item.count);
    push("H. Top categorías", `${i + 1}. ${item.name}`, "percentage", item.percentage);
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

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export { FULL_REPORT_SHEETS };
