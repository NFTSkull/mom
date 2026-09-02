import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertAggregateMath,
  buildNom035AggregateReport,
  type Nom035AggregateReport,
} from "@/lib/nom035/aggregate-report";
import { buildFullReportXlsxBuffer } from "@/lib/nom035/full-report-xlsx";
import {
  assertFullReportCounts,
  normalizeFullReportPayload,
  type NormalizedFullReport,
} from "@/lib/nom035/report-data";
import { renderExecutiveCharts } from "@/lib/nom035/report-charts";
import { getCompanySettings } from "@/lib/nom035/server/admin-core-service";

export type FullReportExportOk = {
  ok: true;
  buffer: Buffer;
  report: NormalizedFullReport;
  aggregate: Nom035AggregateReport;
  generationMs: number;
};

export type FullReportExportErr = {
  ok: false;
  code: string;
  message: string;
};

async function loadNormalizedFullReport(): Promise<
  | { ok: true; report: NormalizedFullReport; companyName: string }
  | FullReportExportErr
> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("admin_export_nom035_full_report");
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("forbidden") || msg.includes("unauthorized")) {
      return { ok: false, code: "forbidden", message: "Sin permiso." };
    }
    return { ok: false, code: "internal_error", message: "No se pudo exportar." };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, code: "internal_error", message: "Respuesta inválida." };
  }
  const record = data as Record<string, unknown>;
  if (record.ok === false) {
    const code = typeof record.code === "string" ? record.code : "internal_error";
    return {
      ok: false,
      code,
      message:
        code === "not_found"
          ? "Campaña Evaluación NOM-035 2026 no encontrada."
          : "No se pudo exportar.",
    };
  }

  const report = normalizeFullReportPayload(record);
  if (!report) {
    return { ok: false, code: "internal_error", message: "Datos inválidos." };
  }

  const check = assertFullReportCounts(report);
  if (!check.ok) {
    return { ok: false, code: "count_mismatch", message: check.reason };
  }

  let companyName = "—";
  try {
    const company = await getCompanySettings();
    if (company && typeof company === "object") {
      const rs =
        (company as { razonSocial?: string }).razonSocial ??
        (company as { razon_social?: string }).razon_social;
      if (rs) companyName = String(rs);
    }
  } catch {
    companyName = "—";
  }

  return { ok: true, report, companyName };
}

export async function exportNom035FullReportExcel(): Promise<
  FullReportExportOk | FullReportExportErr
> {
  const started = Date.now();
  const loaded = await loadNormalizedFullReport();
  if (!loaded.ok) return loaded;

  const aggregate = buildNom035AggregateReport(loaded.report, {
    companyName: loaded.companyName,
  });
  const math = assertAggregateMath(aggregate);
  if (!math.ok) {
    return { ok: false, code: "count_mismatch", message: math.reason };
  }

  const charts = await renderExecutiveCharts(aggregate);
  const buffer = await buildFullReportXlsxBuffer({
    report: loaded.report,
    aggregate,
    charts,
  });

  return {
    ok: true,
    buffer,
    report: loaded.report,
    aggregate,
    generationMs: Date.now() - started,
  };
}

export async function getNom035ExecutiveAggregate(): Promise<
  | { ok: true; aggregate: Nom035AggregateReport; generationMs: number }
  | FullReportExportErr
> {
  const started = Date.now();
  const loaded = await loadNormalizedFullReport();
  if (!loaded.ok) return loaded;

  const aggregate = buildNom035AggregateReport(loaded.report, {
    companyName: loaded.companyName,
  });
  const math = assertAggregateMath(aggregate);
  if (!math.ok) {
    return { ok: false, code: "count_mismatch", message: math.reason };
  }

  return {
    ok: true,
    aggregate,
    generationMs: Date.now() - started,
  };
}
