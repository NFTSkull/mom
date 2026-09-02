/**
 * B4.26 — Utilidades compartidas para hojas Excel.
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
  row.commit();
}

export function applySheetDefaults(
  sheet: ExcelJS.Worksheet,
  columnWidths: number[],
  freezeRow = 1
): void {
  sheet.views = [{ state: "frozen", ySplit: freezeRow }];
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
  rowCount: number
): void {
  if (rowCount < 1) return;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rowCount, 1), column: colCount },
  };
}

export function riskFillColor(level: string | null | undefined): string | null {
  return riskExcelArgb(level);
}

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
    sheet.getCell(img.row, 1).value = img.title;
    sheet.getCell(img.row, 1).font = { bold: true, size: 12 };
    const imageId = workbook.addImage({
      buffer: Buffer.from(img.buffer) as unknown as ExcelJS.Buffer,
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: { col: 0, row: img.row },
      ext: {
        width: img.width ?? 720,
        height: img.height ?? 380,
      },
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
  fillArgb: string
): void {
  const titleCell = sheet.getCell(startRow, startCol);
  const valueCell = sheet.getCell(startRow + 1, startCol);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 9, color: { argb: "FF475569" } };
  valueCell.value = value;
  valueCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  for (const r of [startRow, startRow + 1]) {
    const cell = sheet.getCell(r, startCol);
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
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}
