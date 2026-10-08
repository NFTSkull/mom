import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { buildNom035AggregateReport } from "../aggregate-report";
import {
  buildFullReportXlsxBuffer,
  buildPersonnelStatusRows,
  PERSONNEL_STATUS_HEADERS,
  personnelSummaryText,
} from "../full-report-xlsx";
import { renderExecutiveCharts } from "../report-charts";
import {
  assertFullReportCounts,
  personnelStatusLabel,
  type NormalizedFullReport,
} from "../report-data";
import { FULL_REPORT_SHEETS } from "../report-excel-utils";
import {
  B429_OVERALL,
  B429_REAL_RESULTS,
  B430_INCOMPLETE_USERNAMES,
  buildB429ProductionLikeReport,
} from "./fixtures/b429-production-matrix";

const SHEET = "Estado del personal";
const DASH = "—";

async function loadWorkbook(report: NormalizedFullReport): Promise<ExcelJS.Workbook> {
  const agg = buildNom035AggregateReport(report);
  const charts = await renderExecutiveCharts(agg);
  const buf = await buildFullReportXlsxBuffer({ report, aggregate: agg, charts });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return wb;
}

function dataRows(sheet: ExcelJS.Worksheet): ExcelJS.Row[] {
  const rows: ExcelJS.Row[] = [];
  sheet.eachRow((row, n) => {
    if (n > 1) rows.push(row);
  });
  return rows;
}

function cellText(row: ExcelJS.Row, col: number): string {
  const v = row.getCell(col).value;
  return v == null ? "" : String(v);
}

function usernamesInColumn(sheet: ExcelJS.Worksheet): Set<string> {
  const out = new Set<string>();
  for (const row of dataRows(sheet)) {
    const u = cellText(row, 1);
    if (/^[0-9]{3}$/.test(u)) out.add(u);
  }
  return out;
}

const migration017 = readFileSync("supabase/migrations/017_full_report_personnel.sql", "utf8");

describe("B4.30 — Estado del personal (80 completados + 3 incompletos)", () => {
  const report = buildB429ProductionLikeReport();
  const incomplete = new Set<string>(B430_INCOMPLETE_USERNAMES);

  it("1. personnel = 83 y cuadra con realWorkers", () => {
    expect(report.personnel).toHaveLength(83);
    expect(report.personnel).toHaveLength(report.counts.realWorkers);
    expect(assertFullReportCounts(report)).toEqual({ ok: true });
  });

  it("2. workers sigue siendo solo completados con resultado (80)", () => {
    expect(report.workers).toHaveLength(B429_REAL_RESULTS);
    expect(report.workers.every((w) => w.status === "completed")).toBe(true);
    expect(report.workers.some((w) => incomplete.has(w.username))).toBe(false);
  });

  it("3. hoja Estado del personal tiene 83 filas, encabezados y orden 001…083", async () => {
    const wb = await loadWorkbook(report);
    expect(FULL_REPORT_SHEETS[5]).toBe(SHEET);
    expect(wb.getWorksheet("Completados")).toBeUndefined();
    const sheet = wb.getWorksheet(SHEET)!;
    const header = PERSONNEL_STATUS_HEADERS.map((_, i) => cellText(sheet.getRow(1), i + 1));
    expect(header).toEqual([...PERSONNEL_STATUS_HEADERS]);
    const rows = dataRows(sheet);
    expect(rows).toHaveLength(83);
    const usernames = rows.map((r) => cellText(r, 1));
    expect(usernames).toEqual(
      Array.from({ length: 83 }, (_, i) => String(i + 1).padStart(3, "0"))
    );
  });

  it("4-5. 80 «Completado» y 3 «Incompleto»; sin estado técnico", async () => {
    const sheet = (await loadWorkbook(report)).getWorksheet(SHEET)!;
    const estados = dataRows(sheet).map((r) => cellText(r, 5));
    expect(estados.filter((e) => e === "Completado")).toHaveLength(80);
    expect(estados.filter((e) => e === "Incompleto")).toHaveLength(3);
    expect(estados.filter((e) => /completed|pending|in_progress/.test(e))).toHaveLength(0);
    expect(personnelStatusLabel("completed")).toBe("Completado");
    expect(personnelStatusLabel("pending")).toBe("Incompleto");
    expect(personnelStatusLabel("in_progress")).toBe("Incompleto");
  });

  it("6-8. incompletos: fecha envío, resultado, puntaje y nivel = «—»", async () => {
    const sheet = (await loadWorkbook(report)).getWorksheet(SHEET)!;
    const rows = dataRows(sheet).filter((r) => incomplete.has(cellText(r, 1)));
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(cellText(r, 5)).toBe("Incompleto");
      expect(cellText(r, 7)).toBe(DASH);
      expect(cellText(r, 8)).toBe(DASH);
      expect(cellText(r, 9)).toBe(DASH);
      expect(cellText(r, 10)).toBe(DASH);
      expect(r.getCell(10).fill?.type === "pattern").toBe(false);
    }
    const completedRows = dataRows(sheet).filter((r) => !incomplete.has(cellText(r, 1)));
    expect(completedRows.every((r) => typeof r.getCell(9).value === "number")).toBe(true);
    expect(completedRows.every((r) => cellText(r, 10) !== DASH)).toBe(true);
  });

  it("9. Resultados Individuales, Guía I y Guía III siguen con 80 (sin incompletos)", async () => {
    const wb = await loadWorkbook(report);
    const individuales = wb.getWorksheet(FULL_REPORT_SHEETS[6])!;
    expect(dataRows(individuales)).toHaveLength(80);
    for (const name of [FULL_REPORT_SHEETS[6], FULL_REPORT_SHEETS[7], FULL_REPORT_SHEETS[8]]) {
      const users = usernamesInColumn(wb.getWorksheet(name)!);
      expect(users.size).toBe(80);
      for (const u of incomplete) expect(users.has(u)).toBe(false);
    }
  });

  it("10-12. categorías, dominios y distribución se calculan con 80 y no cambian con personnel", () => {
    const agg = buildNom035AggregateReport(report);
    const aggWithoutPersonnel = buildNom035AggregateReport({ ...report, personnel: [] });
    for (const c of agg.categories) expect(c.total).toBe(80);
    for (const d of agg.domains) expect(d.total).toBe(80);
    const dist = agg.overallRiskDistribution.map((r) => r.count);
    expect(dist).toEqual([...B429_OVERALL]);
    expect(dist.reduce((a, b) => a + b, 0)).toBe(80);
    expect(agg.categories).toEqual(aggWithoutPersonnel.categories);
    expect(agg.domains).toEqual(aggWithoutPersonnel.domains);
    expect(agg.overallRiskDistribution).toEqual(aggWithoutPersonnel.overallRiskDistribution);
    expect(agg.traumaticEvent).toEqual(aggWithoutPersonnel.traumaticEvent);
    expect(agg.clinicalAttention).toEqual(aggWithoutPersonnel.clinicalAttention);
  });

  it("Resumen Ejecutivo: Personal 83, Completados 80, Incompletos 3", async () => {
    const agg = buildNom035AggregateReport(report);
    expect(personnelSummaryText(agg.population)).toBe(
      "Personal: 83\nCompletados: 80\nIncompletos: 3"
    );
    const resumen = (await loadWorkbook(report)).getWorksheet(FULL_REPORT_SHEETS[0])!;
    const texts: string[] = [];
    resumen.eachRow((row) => row.eachCell((c) => texts.push(String(c.value ?? ""))));
    expect(texts.some((t) => t.includes("Personal: 83\nCompletados: 80\nIncompletos: 3"))).toBe(
      true
    );
  });

  it("13. usuarios de prueba y revocados excluidos por el RPC (guardas en migración 017)", () => {
    const personnelBlock = migration017.slice(
      migration017.indexOf("into v_personnel"),
      migration017.indexOf("between 1 and 83", migration017.indexOf("into v_personnel"))
    );
    expect(personnelBlock).toContain("coalesce(w.is_test, false) = false");
    expect(personnelBlock).toContain("a.status is distinct from 'revoked'");
    expect(personnelBlock).toContain("wa.username_normalized ~ '^[0-9]{3}$'");
    expect(report.counts.testResultsIncluded).toBe(0);
    expect(report.personnel.every((p) => /^[0-9]{3}$/.test(p.username))).toBe(true);
  });

  it("14-16. migración 017: sin cambios en scoring, respuestas, resultados ni asignaciones", () => {
    const sql = migration017.toLowerCase();
    expect(sql).not.toMatch(/\b(update|delete\s+from|truncate)\b/);
    const inserts = sql.match(/insert\s+into\s+[a-z_.]+/g) ?? [];
    expect(inserts).toEqual(["insert into public.audit_log"]);
    expect(sql).not.toMatch(/alter\s+table|drop\s+(table|function)/);
    expect(sql).not.toContain("admin_get_result_detail");
    expect(sql).toContain("'workers', v_workers,");
    expect(sql).toContain("'personnel', v_personnel");
    expect(sql).toMatch(/revoke all on function public\.admin_export_nom035_full_report\(\) from public, anon/);
    expect(sql).not.toMatch(/grant [^;]* to [^;]*\banon\b/);
    expect(readFileSync("supabase/migrations/014_admin_export_nom035_full_report.sql", "utf8")).not.toContain(
      "personnel"
    );
  });

  it("invariantes: personnel inconsistente es rechazado", () => {
    const sinUno = { ...report, personnel: report.personnel.slice(1) };
    expect(assertFullReportCounts(sinUno).ok).toBe(false);
    const todosCompletos = {
      ...report,
      personnel: report.personnel.map((p) => ({ ...p, status: "completed" })),
    };
    expect(assertFullReportCounts(todosCompletos).ok).toBe(false);
  });

  it("join por usuario: solo filas completed toman resultado de workers", () => {
    const rows = buildPersonnelStatusRows(report);
    expect(rows).toHaveLength(83);
    expect(rows.filter((r) => r.estado === "Completado")).toHaveLength(80);
    expect(rows.filter((r) => r.puntaje === DASH)).toHaveLength(3);
    expect(rows.filter((r) => r.riskLevel !== null)).toHaveLength(80);
  });
});
