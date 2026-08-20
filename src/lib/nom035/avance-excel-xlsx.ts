/**
 * Genera XLSX real de avance (solo Nombre | Usuario | Respondió).
 */
import ExcelJS from "exceljs";
import {
  AVANCE_ALLOWED_HEADERS,
  AVANCE_EXCEL_SHEET,
  type AvanceExcelRow,
} from "@/lib/nom035/avance-excel";

export async function buildAvanceXlsxBuffer(
  rows: AvanceExcelRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NOM-035";
  wb.created = new Date();
  const sheet = wb.addWorksheet(AVANCE_EXCEL_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: AVANCE_ALLOWED_HEADERS[0], key: "nombre", width: 40 },
    { header: AVANCE_ALLOWED_HEADERS[1], key: "usuario", width: 12 },
    { header: AVANCE_ALLOWED_HEADERS[2], key: "respondio", width: 12 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.commit();

  for (const r of rows) {
    const row = sheet.addRow({
      nombre: r.nombre,
      usuario: r.usuario,
      respondio: r.respondio,
    });
    // Forzar username como texto (conservar 001)
    row.getCell(2).value = String(r.usuario);
    row.getCell(2).numFmt = "@";
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: 3 },
  };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Heurística mínima: ZIP/XLSX empieza con PK. */
export function isLikelyXlsx(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}
