/**
 * B4.27 — Utilidades Excel: anclaje visible, KPIs, hojas.
 */
import type ExcelJS from "exceljs";
import { riskExcelArgb } from "@/lib/nom035/risk-palette";

export function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber = 1): void {
  const row = sheet.getRow(rowNumber);
  row.font = { bold: true, color: { argb: "FF0F172A" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
  row.commit();
}

export function applySheetDefaults(
  sheet: ExcelJS.Worksheet,
  columnWidths: number[],
  freezeRowOrOpts:
    | number
    | { freezeRow?: number; zoomScale?: number; showGridLines?: boolean } = 1
): void {
  const opts =
    typeof freezeRowOrOpts === "number"
      ? { freezeRow: freezeRowOrOpts }
      : freezeRowOrOpts;
  const freezeRow = opts.freezeRow ?? 0;
  const zoomScale = opts.zoomScale ?? 85;
  sheet.views = [
    {
      state: freezeRow > 0 ? "frozen" : "normal",
      ySplit: freezeRow > 0 ? freezeRow : undefined,
      zoomScale,
      activeCell: "A1",
      showGridLines: opts.showGridLines ?? freezeRow > 0,
    },
  ];
  columnWidths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
}

export function setTextCell(cell: ExcelJS.Cell, value: string): void {
  cell.value = value;
  cell.numFmt = "@";
}

export function applyAutoFilter(
  sheet: ExcelJS.Worksheet,
  colCount: number,
  rowCount: number,
  headerRow = 1
): void {
  if (rowCount < headerRow) return;
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: Math.max(rowCount, headerRow), column: colCount },
  };
}

export function riskFillColor(level: string | null | undefined): string | null {
  return riskExcelArgb(level);
}

export type VisibleChartSpec = {
  buffer: Buffer | Uint8Array;
  /** Título opcional en celda (1-based). */
  title?: string;
  titleRow?: number;
  titleCol?: number;
  /**
   * Ancla drawing ExcelJS (0-based).
   * tl.row=3 → inicia en la fila Excel 4.
   */
  tlCol: number;
  tlRow: number;
  brCol: number;
  brRow: number;
  /** Altura de cada fila reservada (pt). */
  rowHeightPt?: number;
};

/**
 * Embebe una gráfica visible reservando filas y usando ancla tl/br estable.
 * Coordenadas de drawing son 0-based (convención ExcelJS).
 */
export function embedVisibleChart(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  spec: VisibleChartSpec
): void {
  const titleCol = (spec.titleCol ?? spec.tlCol) + 1;
  if (spec.title && spec.titleRow) {
    const cell = sheet.getCell(spec.titleRow, titleCol);
    cell.value = spec.title;
    cell.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
  }

  const excelFrom = Math.max(1, spec.tlRow + 1);
  const excelTo = Math.max(excelFrom, spec.brRow);
  const span = Math.max(1, excelTo - excelFrom + 1);
  const rowHeightPt = spec.rowHeightPt ?? Math.max(18, Math.round(520 / span));
  for (let r = excelFrom; r <= excelTo; r++) {
    const row = sheet.getRow(r);
    row.height = Math.max(row.height ?? 0, rowHeightPt);
  }

  const imageId = workbook.addImage({
    buffer: Buffer.from(spec.buffer) as unknown as ExcelJS.Buffer,
    extension: "png",
  });
  sheet.addImage(
    imageId,
    {
      tl: { col: spec.tlCol, row: spec.tlRow },
      br: { col: spec.brCol, row: spec.brRow },
      editAs: "oneCell",
    } as unknown as ExcelJS.ImageRange
  );
}

/** @deprecated Usar embedVisibleChart. Conservado por compat tests B4.24. */
export async function embedChartImages(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  images: Array<{
    buffer: Buffer | Uint8Array;
    title: string;
    row: number;
    width?: number;
    height?: number;
  }>
): Promise<void> {
  for (const img of images) {
    const tlRow = Math.max(0, img.row - 1);
    const span = Math.max(12, Math.round((img.height ?? 380) / 28));
    embedVisibleChart(workbook, sheet, {
      buffer: img.buffer,
      title: img.title,
      titleRow: img.row,
      titleCol: 0,
      tlCol: 0,
      tlRow,
      brCol: 10,
      brRow: tlRow + span,
    });
  }
}

export const FULL_REPORT_SHEETS = [
  "Resumen Ejecutivo",
  "Categorías",
  "Dominios",
  "Distribución Final",
  "Acontecimiento Traumático",
  "Completados",
  "Resultados Individuales",
  "Guía I - Respuestas",
  "Guía III - Respuestas",
  "Datos para Gráficas",
  "Metodología",
] as const;

export const INDIVIDUAL_REPORT_SHEETS = [
  "Resumen Individual",
  "Guía I",
  "Guía III",
  "Categorías",
  "Dominios",
  "Gráficas",
] as const;

export function paintKpiBox(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  title: string,
  value: string,
  fillArgb: string,
  opts?: { rowSpan?: number; colSpan?: number }
): void {
  const rowSpan = opts?.rowSpan ?? 2;
  const colSpan = opts?.colSpan ?? 1;
  const endRow = startRow + rowSpan - 1;
  const endCol = startCol + colSpan - 1;
  if (rowSpan > 1 || colSpan > 1) {
    sheet.mergeCells(startRow, startCol, endRow, endCol);
  }
  const cell = sheet.getCell(startRow, startCol);
  cell.value = `${title}\n${value}`;
  cell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fillArgb },
  };
  cell.border = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
  for (let r = startRow; r <= endRow; r++) {
    sheet.getRow(r).height = Math.max(sheet.getRow(r).height ?? 0, 22);
  }
}

export function setLandscapePrint(
  sheet: ExcelJS.Worksheet,
  printArea: string,
  zoomScale = 85
): void {
  try {
    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printArea,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    };
    const view = sheet.views?.[0];
    if (view) view.zoomScale = zoomScale;
  } catch {
    /* printSettings opcionales */
  }
}

export function setWorkbookActiveFirstSheet(workbook: ExcelJS.Workbook): void {
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 12000,
      height: 20000,
      firstSheet: 0,
      activeTab: 0,
      visibility: "visible",
    },
  ];
}
