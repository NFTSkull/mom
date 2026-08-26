import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFullReportXlsxBuffer } from "@/lib/nom035/full-report-xlsx";
import {
  assertFullReportCounts,
  buildChartDatasets,
  normalizeFullReportPayload,
  type NormalizedFullReport,
} from "@/lib/nom035/report-data";
import { renderAggregateCharts } from "@/lib/nom035/report-charts";

export type FullReportExportOk = {
  ok: true;
  buffer: Buffer;
  report: NormalizedFullReport;
  generationMs: number;
};

export type FullReportExportErr = {
  ok: false;
  code: string;
  message: string;
};

export async function exportNom035FullReportExcel(): Promise<
  FullReportExportOk | FullReportExportErr
> {
  const started = Date.now();
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

  const chartData = buildChartDatasets(report);
  const charts = await renderAggregateCharts(chartData);
  const buffer = await buildFullReportXlsxBuffer({ report, charts });

  return {
    ok: true,
    buffer,
    report,
    generationMs: Date.now() - started,
  };
}
