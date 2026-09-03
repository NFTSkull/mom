import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalBlank = z
  .string()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

export const companyUpsertSchema = z
  .object({
    razonSocial: z.string().trim().min(1).max(300),
    rfc: optionalBlank,
    domicilio: optionalBlank,
    telefono: optionalBlank,
    actividadPrincipal: optionalBlank,
    totalTrabajadores: z.number().int().min(0).max(1_000_000),
    responsableNombre: optionalBlank,
    responsableEmail: z
      .string()
      .max(320)
      .optional()
      .nullable()
      .transform((v) => {
        if (v === undefined || v === null) return null;
        const t = v.trim().toLowerCase();
        return t.length === 0 ? null : t;
      })
      .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: "email_invalid",
      }),
    responsableTelefono: optionalBlank,
  })
  .strict();

export const workerCreateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(200),
    email: optionalBlank,
    telefono: optionalBlank,
    departamento: optionalBlank,
    puesto: optionalBlank,
    turno: optionalBlank,
    sucursal: optionalBlank,
    jefeDirecto: optionalBlank,
    antiguedad: optionalBlank,
    externalReference: optionalBlank,
    activo: z.boolean().optional().default(true),
  })
  .strict();

export const workerUpdateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(200).optional(),
    email: optionalBlank,
    telefono: optionalBlank,
    departamento: optionalBlank,
    puesto: optionalBlank,
    turno: optionalBlank,
    sucursal: optionalBlank,
    jefeDirecto: optionalBlank,
    antiguedad: optionalBlank,
    externalReference: optionalBlank,
  })
  .strict();

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(200).optional(),
  })
  .strict();

async function rpcClient() {
  return createSupabaseServerClient();
}

export async function getCompanySettings() {
  const { data, error } = await (await rpcClient()).rpc("admin_get_company_settings");
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function upsertCompanySettings(input: z.infer<typeof companyUpsertSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_upsert_company_settings", {
    p_razon_social: input.razonSocial,
    p_rfc: input.rfc,
    p_domicilio: input.domicilio,
    p_telefono: input.telefono,
    p_actividad_principal: input.actividadPrincipal,
    p_total_trabajadores: input.totalTrabajadores,
    p_responsable_nombre: input.responsableNombre,
    p_responsable_email: input.responsableEmail,
    p_responsable_telefono: input.responsableTelefono,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function listWorkers(params: {
  page: number;
  pageSize: number;
  search?: string;
  activo?: boolean | null;
  departamento?: string | null;
}) {
  const { data, error } = await (await rpcClient()).rpc("admin_list_workers", {
    p_search: params.search ?? null,
    p_activo: params.activo ?? null,
    p_departamento: params.departamento ?? null,
    p_page: params.page,
    p_page_size: params.pageSize,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function createWorker(input: z.infer<typeof workerCreateSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_create_worker", {
    p_nombre: input.nombre,
    p_email: input.email,
    p_telefono: input.telefono,
    p_departamento: input.departamento,
    p_puesto: input.puesto,
    p_turno: input.turno,
    p_sucursal: input.sucursal,
    p_jefe_directo: input.jefeDirecto,
    p_antiguedad: input.antiguedad,
    p_external_reference: input.externalReference,
    p_activo: input.activo,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function updateWorker(id: string, input: z.infer<typeof workerUpdateSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_update_worker", {
    p_worker_id: id,
    p_nombre: input.nombre ?? null,
    p_email: input.email,
    p_telefono: input.telefono,
    p_departamento: input.departamento,
    p_puesto: input.puesto,
    p_turno: input.turno,
    p_sucursal: input.sucursal,
    p_jefe_directo: input.jefeDirecto,
    p_antiguedad: input.antiguedad,
    p_external_reference: input.externalReference,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function deactivateWorker(id: string) {
  const { data, error } = await (await rpcClient()).rpc("admin_deactivate_worker", {
    p_worker_id: id,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function reactivateWorker(id: string) {
  const { data, error } = await (await rpcClient()).rpc("admin_reactivate_worker", {
    p_worker_id: id,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function deleteWorker(id: string) {
  const { data, error } = await (await rpcClient()).rpc("admin_delete_worker", {
    p_worker_id: id,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function importWorkers(
  rows: Array<Record<string, unknown>>,
  mode: "atomic" | "validate_only"
) {
  const { data, error } = await (await rpcClient()).rpc("admin_import_workers", {
    p_rows: rows,
    p_mode: mode,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export type WorkerImportUpsertRow = {
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  turno?: string | null;
  sucursal?: string | null;
  jefe_directo?: string | null;
  antiguedad?: string | null;
  referencia_externa: string;
  activo?: boolean;
};

/**
 * Importación idempotente por referencia_externa (número de empleado).
 * - Si no existe: crea (RPC admin_create_worker).
 * - Si existe: actualiza solo nombre, departamento y puesto.
 * No crea usuarios Auth.
 */
export async function importWorkersUpsert(
  rows: WorkerImportUpsertRow[],
  client?: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const db = client ?? (await rpcClient());
  let created = 0;
  let updated = 0;
  let rejected = 0;
  const errors: Array<{ row: number; code: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ext = row.referencia_externa?.trim();
    const rowNum = i + 1;
    if (!ext) {
      rejected += 1;
      errors.push({ row: rowNum, code: "referencia_externa_required" });
      continue;
    }

    const listed = await db.rpc("admin_list_workers", {
      p_search: ext,
      p_activo: null,
      p_departamento: null,
      p_page: 1,
      p_page_size: 100,
    });
    if (listed.error) throw listed.error;
    const items =
      ((listed.data as { items?: Array<{ id: string; externalReference?: string | null }> } | null)
        ?.items ?? []);
    const existing = items.find((w) => w.externalReference === ext) ?? null;

    if (!existing) {
      const { data, error } = await db.rpc("admin_create_worker", {
        p_nombre: row.nombre,
        p_email: row.email ?? null,
        p_telefono: row.telefono ?? null,
        p_departamento: row.departamento ?? null,
        p_puesto: row.puesto ?? null,
        p_turno: row.turno ?? null,
        p_sucursal: row.sucursal ?? null,
        p_jefe_directo: row.jefe_directo ?? null,
        p_antiguedad: row.antiguedad ?? null,
        p_external_reference: ext,
        p_activo: row.activo ?? true,
      });
      if (error) throw error;
      if ((data as { ok?: boolean } | null)?.ok) created += 1;
      else {
        rejected += 1;
        errors.push({
          row: rowNum,
          code: String((data as { code?: string } | null)?.code ?? "create_failed"),
        });
      }
      continue;
    }

    const { data, error } = await db.rpc("admin_update_worker", {
      p_worker_id: existing.id,
      p_nombre: row.nombre,
      p_departamento: row.departamento ?? null,
      p_puesto: row.puesto ?? null,
      p_email: null,
      p_telefono: null,
      p_turno: null,
      p_sucursal: null,
      p_jefe_directo: null,
      p_antiguedad: null,
      p_external_reference: null,
    });
    if (error) throw error;
    if ((data as { ok?: boolean } | null)?.ok) updated += 1;
    else {
      rejected += 1;
      errors.push({
        row: rowNum,
        code: String((data as { code?: string } | null)?.code ?? "update_failed"),
      });
    }
  }

  return {
    ok: rejected === 0,
    created,
    updated,
    rejected,
    total: rows.length,
    errors,
  };
}

export async function getDashboardSummary() {
  const { data, error } = await (await rpcClient()).rpc("admin_dashboard_summary");
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function listResults(params: {
  campaignId?: string | null;
  workerId?: string | null;
  departamento?: string | null;
  riskLevel?: string | null;
  search?: string | null;
  page: number;
  pageSize: number;
  sort?: string | null;
}) {
  const { data, error } = await (await rpcClient()).rpc("admin_list_results", {
    p_campaign_id: params.campaignId ?? null,
    p_worker_id: params.workerId ?? null,
    p_departamento: params.departamento ?? null,
    p_risk_level: params.riskLevel ?? null,
    p_search: params.search ?? null,
    p_page: params.page,
    p_page_size: params.pageSize,
    p_sort: params.sort ?? "name_asc",
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function getResultDetail(resultId: string) {
  const { data, error } = await (await rpcClient()).rpc("admin_get_result_detail", {
    p_result_id: resultId,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function getReportsSummary(params: {
  campaignId?: string | null;
  departamento?: string | null;
}) {
  const { data, error } = await (await rpcClient()).rpc("admin_reports_summary", {
    p_campaign_id: params.campaignId ?? null,
    p_departamento: params.departamento ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}
