/**
 * B4.24 — Utilidades compartidas para hojas Excel.
 */
import type ExcelJS from "exceljs";

export function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber = 1): void {
  const row = sheet.getRow(rowNumber);
  row.font = { bold: true };
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
  if (!level) return null;
  if (level === "nulo" || level === "Nulo/despreciable") return "FFE2E8F0";
  if (level === "bajo" || level === "Bajo") return "FFDCFCE7";
  if (level === "medio" || level === "Medio") return "FFFEF9C3";
  if (level === "alto" || level === "Alto") return "FFFED7AA";
  if (level === "muy_alto" || level === "Muy alto") return "FFFECACA";
  return null;
}

export async function embedChartImages(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  images: Array<{ buffer: Buffer | Uint8Array; title: string; row: number }>
): Promise<void> {
  let rowCursor = 1;
  for (const img of images) {
    sheet.getCell(rowCursor, 1).value = img.title;
    sheet.getCell(rowCursor, 1).font = { bold: true };
    rowCursor += 1;
    const imageId = workbook.addImage({
      buffer: Buffer.from(img.buffer) as unknown as ExcelJS.Buffer,
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: { col: 0, row: rowCursor - 1 },
      ext: { width: 640, height: 360 },
    });
    rowCursor += 22;
  }
}

export const FULL_REPORT_SHEETS = [
  "Resumen",
  "Completados",
  "Resultados Individuales",
  "Categorías",
  "Dominios",
  "Guía I - Respuestas",
  "Guía III - Respuestas",
  "Gráficas",
] as const;

export const INDIVIDUAL_REPORT_SHEETS = [
  "Resumen",
  "Guía I",
  "Guía III",
  "Categorías",
  "Dominios",
  "Gráficas",
] as const;
