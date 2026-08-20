import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AVANCE_EXPECTED_ROWS,
  NOM035_REAL_CAMPAIGN_NAME,
  assertAvanceCountsMatch,
  buildAvanceExcelRows,
  type AvanceSourceRow,
} from "@/lib/nom035/avance-excel";
import { buildAvanceXlsxBuffer } from "@/lib/nom035/avance-excel-xlsx";

export type AvanceExportOk = {
  ok: true;
  buffer: Buffer;
  total: number;
  si: number;
  no: number;
  dashboardCompleted: number;
  campaignName: string;
};

export type AvanceExportErr = {
  ok: false;
  code: string;
  message: string;
};

export async function exportNom035AvanceExcel(): Promise<
  AvanceExportOk | AvanceExportErr
> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("admin_export_nom035_avance");
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

  const items = Array.isArray(record.items) ? record.items : [];
  const sources: AvanceSourceRow[] = items.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      nombre: String(r.nombre ?? ""),
      username: String(r.usuario ?? r.username ?? ""),
      assignmentStatus: String(r.status ?? r.assignmentStatus ?? "pending"),
    };
  });

  const built = buildAvanceExcelRows(sources);
  const dashboardCompleted = Number(record.completedCount ?? built.si);
  const check = assertAvanceCountsMatch({
    total: built.total,
    si: built.si,
    no: built.no,
    dashboardCompleted,
    expectedTotal: AVANCE_EXPECTED_ROWS,
  });
  if (!check.ok) {
    return {
      ok: false,
      code: "count_mismatch",
      message: `Conteos inconsistentes: ${check.reason}`,
    };
  }

  const buffer = await buildAvanceXlsxBuffer(built.rows);
  return {
    ok: true,
    buffer,
    total: built.total,
    si: built.si,
    no: built.no,
    dashboardCompleted,
    campaignName: NOM035_REAL_CAMPAIGN_NAME,
  };
}
