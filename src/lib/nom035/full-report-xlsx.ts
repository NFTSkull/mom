/**
 * B4.26 — XLSX consolidado NOM-035 (11 hojas, modelo Guía I+III).
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
  embedChartImages,
  FULL_REPORT_SHEETS,
  paintKpiBox,
  riskFillColor,
  setTextCell,
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

  // —— 1. Resumen Ejecutivo ——
  const resumen = wb.addWorksheet(FULL_REPORT_SHEETS[0]);
  applySheetDefaults(resumen, [22, 18, 18, 18, 18, 22, 22, 22], 0);
  try {
    resumen.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
  } catch {
    /* printSettings opcionales */
  }

  resumen.mergeCells(1, 1, 1, 8);
  resumen.getCell(1, 1).value = "RESULTADOS NOM-035 2026";
  resumen.getCell(1, 1).font = { bold: true, size: 20, color: { argb: "FF0F172A" } };
  resumen.getCell(1, 1).alignment = { horizontal: "center" };

  resumen.mergeCells(2, 1, 2, 8);
  resumen.getCell(2, 1).value = agg.companyName;
  resumen.getCell(2, 1).font = { size: 14, color: { argb: "FF334155" } };
  resumen.getCell(2, 1).alignment = { horizontal: "center" };

  paintKpiBox(resumen, 4, 1, "MODELO", agg.modelLabel, "FFDBEAFE");
  paintKpiBox(
    resumen,
    4,
    2,
    "PERSONAL EVALUADO",
    String(agg.population.realCompleted),
    "FFDCFCE7"
  );
  paintKpiBox(
    resumen,
    4,
    3,
    "PENDIENTES",
    String(agg.population.realPending),
    "FFFEF9C3"
  );
  paintKpiBox(
    resumen,
    4,
    4,
    "EN PROGRESO",
    String(agg.population.realInProgress),
    "FFE2E8F0"
  );
  paintKpiBox(resumen, 4, 5, "ESTADO", agg.campaignStatusLabel, "FFF1F5F9");

  resumen.getCell(7, 1).value = "CALIFICACIÓN FINAL DE RIESGOS PSICOSOCIALES";
  resumen.getCell(7, 1).font = { bold: true, size: 12 };

  resumen.addRow([]);
  const distHeader = resumen.getRow(8);
  distHeader.values = ["Nivel", "Personas", "Porcentaje %"];
  styleHeaderRow(resumen, 8);
  let r = 9;
  for (const row of agg.overallRiskDistribution) {
    const excelRow = resumen.getRow(r);
    excelRow.values = [row.shortLabel, row.count, row.percentage];
    const fill = riskFillColor(row.level);
    if (fill) {
      excelRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    }
    r += 1;
  }

  paintKpiBox(
    resumen,
    4,
    7,
    "RIESGO PREDOMINANTE",
    `${agg.predominantRisk.label}\n${agg.predominantRisk.count} de ${agg.population.realResults} (${agg.predominantRisk.percentage}%)`,
    "FFFEF08A"
  );

  paintKpiBox(
    resumen,
    9,
    7,
    "ACONTECIMIENTO TRAUMÁTICO SEVERO",
    `${agg.traumaticEvent.yes}\n${agg.traumaticEvent.percentageYes}%`,
    "FFFECACA"
  );
  paintKpiBox(
    resumen,
    11,
    7,
    "PERSONAL QUE REQUIERE VALORACIÓN CLÍNICA",
    `${agg.clinicalAttention.yes}\n${agg.clinicalAttention.percentageYes}%`,
    "FFFED7AA"
  );

  resumen.getCell(16, 1).value =
    "DOMINIOS CON MAYOR CONCENTRACIÓN DE RIESGO ALTO / MUY ALTO";
  resumen.getCell(16, 1).font = { bold: true };
  let tipRow = 17;
  agg.topDomainsHighRisk.forEach((item, i) => {
    resumen.getCell(tipRow, 1).value =
      `${i + 1}. ${item.name} — ${item.count} (${item.percentage}%)`;
    tipRow += 1;
  });
  if (agg.topDomainsHighRisk.length === 0) {
    resumen.getCell(tipRow, 1).value = "Sin concentraciones Alto/Muy alto.";
    tipRow += 1;
  }

  tipRow += 1;
  resumen.getCell(tipRow, 1).value =
    "CATEGORÍAS CON MAYOR CONCENTRACIÓN DE RIESGO MEDIO / ALTO / MUY ALTO";
  resumen.getCell(tipRow, 1).font = { bold: true };
  tipRow += 1;
  agg.topCategoriesMediumPlus.forEach((item, i) => {
    resumen.getCell(tipRow, 1).value =
      `${i + 1}. ${item.name} — ${item.count} (${item.percentage}%)`;
    tipRow += 1;
  });

  await embedChartImages(wb, resumen, [
    {
      buffer: charts.riskDistribution,
      title: "",
      row: tipRow + 2,
      width: 780,
      height: 360,
    },
  ]);

  // —— 2. Categorías ——
  const categorias = wb.addWorksheet(FULL_REPORT_SHEETS[1]);
  applySheetDefaults(categorias, [36, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  try {
    categorias.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  } catch { /* optional */ }
  categorias.mergeCells(1, 1, 1, 12);
  categorias.getCell(1, 1).value =
    "CALIFICACIÓN DE CATEGORÍAS DE RIESGOS PSICOSOCIALES POR TOTAL DE PERSONAL EVALUADO";
  categorias.getCell(1, 1).font = { bold: true, size: 13 };
  categorias.getCell(1, 1).alignment = { horizontal: "center", wrapText: true };

  const catHeader = ["Categoría", ...levelHeaders(), "Total"];
  categorias.addRow([]);
  categorias.addRow(catHeader);
  styleHeaderRow(categorias, 3);
  let catDataRows = 0;
  for (const cat of agg.categories) {
    const rowVals: Array<string | number> = [cat.name];
    for (const level of RISK_LEVEL_ORDER) {
      rowVals.push(cat.levels[level].count, cat.levels[level].percentage);
    }
    rowVals.push(cat.total);
    categorias.addRow(rowVals);
    catDataRows += 1;
  }
  applyAutoFilter(categorias, catHeader.length, 3 + catDataRows);
  await embedChartImages(wb, categorias, [
    {
      buffer: charts.categoriesGrouped,
      title: "Gráfica de categorías",
      row: 5 + catDataRows,
      width: 900,
      height: 420,
    },
  ]);

  // —— 3. Dominios ——
  const dominios = wb.addWorksheet(FULL_REPORT_SHEETS[2]);
  applySheetDefaults(dominios, [34, 28, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]);
  try {
    dominios.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  } catch { /* optional */ }
  dominios.mergeCells(1, 1, 1, 13);
  dominios.getCell(1, 1).value =
    "CALIFICACIÓN DE DOMINIOS DE RIESGOS PSICOSOCIALES POR TOTAL DE PERSONAL EVALUADO";
  dominios.getCell(1, 1).font = { bold: true, size: 13 };
  dominios.getCell(1, 1).alignment = { horizontal: "center", wrapText: true };

  const domHeader = ["Dominio", "Categoría", ...levelHeaders(), "Total"];
  dominios.addRow([]);
  dominios.addRow(domHeader);
  styleHeaderRow(dominios, 3);
  let domDataRows = 0;
  for (const dom of agg.domains) {
    const rowVals: Array<string | number> = [dom.name, dom.category ?? ""];
    for (const level of RISK_LEVEL_ORDER) {
      rowVals.push(dom.levels[level].count, dom.levels[level].percentage);
    }
    rowVals.push(dom.total);
    dominios.addRow(rowVals);
    domDataRows += 1;
  }
  applyAutoFilter(dominios, domHeader.length, 3 + domDataRows);
  const domainImages = [
    {
      buffer: charts.domainsGrouped,
      title: "Gráfica de dominios (1/2)",
      row: 5 + domDataRows,
      width: 980,
      height: 440,
    },
  ];
  if (charts.domainsGroupedB) {
    domainImages.push({
      buffer: charts.domainsGroupedB,
      title: "Gráfica de dominios (2/2)",
      row: 28 + domDataRows,
      width: 980,
      height: 440,
    });
  }
  await embedChartImages(wb, dominios, domainImages);

  // —— 4. Distribución Final ——
  const dist = wb.addWorksheet(FULL_REPORT_SHEETS[3]);
  applySheetDefaults(dist, [18, 12, 14]);
  dist.getCell(1, 1).value = "CALIFICACIÓN FINAL DE RIESGOS PSICOSOCIALES";
  dist.getCell(1, 1).font = { bold: true, size: 14 };
  dist.addRow([]);
  dist.addRow(["Nivel", "Personas", "Porcentaje %"]);
  styleHeaderRow(dist, 3);
  for (const row of agg.overallRiskDistribution) {
    const excelRow = dist.addRow([row.label, row.count, row.percentage]);
    const fill = riskFillColor(row.level);
    if (fill) {
      excelRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    }
  }
  dist.addRow([
    "TOTAL",
    agg.population.realResults,
    agg.overallRiskDistribution.reduce((a, b) => a + b.percentage, 0),
  ]);
  applyAutoFilter(dist, 3, 3 + agg.overallRiskDistribution.length);
  await embedChartImages(wb, dist, [
    {
      buffer: charts.riskDistribution,
      title: "No. de personas",
      row: 12,
      width: 780,
      height: 360,
    },
    {
      buffer: charts.riskDistributionPct,
      title: "Porcentaje",
      row: 34,
      width: 780,
      height: 360,
    },
  ]);

  // —— 5. Acontecimiento Traumático ——
  const ats = wb.addWorksheet(FULL_REPORT_SHEETS[4]);
  applySheetDefaults(ats, [48, 10, 10, 14]);
  ats.getCell(1, 1).value = "Acontecimiento Traumático Severo — Guía I";
  ats.getCell(1, 1).font = { bold: true, size: 14 };
  ats.getCell(3, 1).value =
    `Se evaluaron ${agg.traumaticEvent.denominator} trabajadores mediante Guía de Referencia I.`;
  ats.getCell(4, 1).value =
    `${agg.traumaticEvent.yes} reportaron acontecimiento traumático severo.`;
  ats.getCell(5, 1).value =
    `${agg.clinicalAttention.yes} requieren valoración clínica según la lógica implementada.`;
  ats.addRow([]);
  ats.addRow(["Indicador", "Sí", "No", "Porcentaje Sí"]);
  styleHeaderRow(ats, 7);
  ats.addRow([
    "Acontecimiento traumático severo reportado",
    agg.traumaticEvent.yes,
    agg.traumaticEvent.no,
    agg.traumaticEvent.percentageYes,
  ]);
  ats.addRow([
    "Criterio de valoración clínica",
    agg.clinicalAttention.yes,
    agg.clinicalAttention.no,
    agg.clinicalAttention.percentageYes,
  ]);
  applyAutoFilter(ats, 4, 9);
  await embedChartImages(wb, ats, [
    {
      buffer: charts.traumaticEvent,
      title: "Distribución ATS",
      row: 12,
      width: 560,
      height: 300,
    },
  ]);

  // —— 6. Completados ——
  const completados = wb.addWorksheet(FULL_REPORT_SHEETS[5]);
  applySheetDefaults(completados, [10, 32, 20, 18, 12, 18, 18, 16, 10, 14]);
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
    indHeaders.map((_, i) => (i < 2 ? 28 : i < 7 ? 14 : 18))
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
  applySheetDefaults(guiaI, [10, 32, 10, 60, 24, 28]);
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
      } else if (w.guiaIRequiresClinicalAttention != null && a.questionId.startsWith("guia_i_")) {
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
  applySheetDefaults(datos, [28, 36, 14, 14, 14]);
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
      push(
        "B. Categorías × nivel",
        cat.name,
        `${level}_pct`,
        cat.levels[level].percentage
      );
    }
  }
  for (const dom of agg.domains) {
    for (const level of RISK_LEVEL_ORDER) {
      push("C. Dominios × nivel", dom.name, `${level}_count`, dom.levels[level].count);
      push(
        "C. Dominios × nivel",
        dom.name,
        `${level}_pct`,
        dom.levels[level].percentage
      );
    }
  }
  push("D. ATS", "Sí", "count", agg.traumaticEvent.yes);
  push("D. ATS", "No", "count", agg.traumaticEvent.no);
  push("D. ATS", "Sí", "percentage", agg.traumaticEvent.percentageYes);
  push("E. Valoración clínica", "Sí", "count", agg.clinicalAttention.yes);
  push("E. Valoración clínica", "No", "count", agg.clinicalAttention.no);
  push(
    "E. Valoración clínica",
    "Sí",
    "percentage",
    agg.clinicalAttention.percentageYes
  );
  push("F. Avance", "Completados", "count", agg.population.realCompleted);
  push("F. Avance", "Pendientes", "count", agg.population.realPending);
  push("F. Avance", "En progreso", "count", agg.population.realInProgress);
  agg.topDomainsHighRisk.forEach((item, i) => {
    push("G. Top dominios", `${i + 1}. ${item.name}`, "count", item.count);
    push("G. Top dominios", `${i + 1}. ${item.name}`, "percentage", item.percentage);
  });
  agg.topCategoriesMediumPlus.forEach((item, i) => {
    push("H. Top categorías", `${i + 1}. ${item.name}`, "count", item.count);
    push(
      "H. Top categorías",
      `${i + 1}. ${item.name}`,
      "percentage",
      item.percentage
    );
  });
  applyAutoFilter(datos, 4, datos.rowCount);
  try {
    datos.state = "hidden";
  } catch {
    /* ocultar si la API lo permite; no bloquear */
  }

  // —— 11. Metodología ——
  const metodo = wb.addWorksheet(FULL_REPORT_SHEETS[10]);
  applySheetDefaults(metodo, [28, 72]);
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
