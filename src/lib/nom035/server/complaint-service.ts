import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Servicio de quejas confidenciales (B4.5).
 * El folio y confirmation_code se generan exclusivamente en SQL/servidor.
 * El formulario público NO puede fijar folio, status, assignedTo ni notas.
 * Nunca se registran descripción ni contacto en logs/errores.
 */

export const COMPLAINT_TYPES = [
  "violencia_laboral",
  "entorno_organizacional",
  "factores_riesgo_psicosocial",
  "otro",
] as const;

const optionalContact = z
  .string()
  .max(300)
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

/**
 * Payload público. `strict()` rechaza campos administrativos desconocidos.
 * `website` es honeypot (debe venir vacío). `confirm` es la aceptación obligatoria.
 */
export const publicComplaintSchema = z
  .object({
    complaintType: z.enum(COMPLAINT_TYPES),
    description: z.string().trim().min(20).max(5000),
    isAnonymous: z.boolean(),
    reporterName: optionalContact,
    reporterContact: optionalContact,
    confirm: z.literal(true),
    website: z.string().max(0).optional().default(""),
  })
  .strict()
  .refine(
    (v) => (v.isAnonymous ? v.reporterName === null && v.reporterContact === null : true),
    { message: "anonymous_conflict", path: ["isAnonymous"] }
  )
  .refine(
    (v) => (!v.isAnonymous ? Boolean(v.reporterName || v.reporterContact) : true),
    { message: "identified_requires_contact", path: ["reporterName"] }
  );

export const complaintListSchema = z
  .object({
    status: z.enum(["recibida", "en_revision", "resuelta", "cerrada"]).optional().nullable(),
    complaintType: z.enum(COMPLAINT_TYPES).optional().nullable(),
    folio: z.string().max(50).optional().nullable(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const complaintAssignSchema = z
  .object({ assignedLabel: z.string().trim().min(1).max(120) })
  .strict();

export const complaintStatusSchema = z
  .object({ status: z.enum(["en_revision"]) })
  .strict();

export const complaintResolveSchema = z
  .object({
    category: z.string().trim().min(1).max(120).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .strict();

export const complaintCloseSchema = z
  .object({ justification: z.string().max(2000).optional().nullable() })
  .strict();

type ServiceResult = Record<string, unknown>;

async function rpcClient() {
  return createSupabaseServerClient();
}

/** Envío público. Devuelve solo folio/confirmationCode/receivedAt. */
export async function submitPublicComplaint(
  input: z.infer<typeof publicComplaintSchema>
): Promise<ServiceResult> {
  const { data, error } = await createSupabaseAdminClient().rpc("public_submit_confidential_complaint", {
    p_complaint_type: input.complaintType,
    p_description: input.description,
    p_is_anonymous: input.isAnonymous,
    p_reporter_name: input.isAnonymous ? null : input.reporterName,
    p_reporter_contact: input.isAnonymous ? null : input.reporterContact,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function listComplaints(input: z.infer<typeof complaintListSchema>): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_list_complaints", {
    p_status: input.status ?? null,
    p_complaint_type: input.complaintType ?? null,
    p_folio: input.folio ?? null,
    p_page: input.page,
    p_page_size: input.pageSize,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function getComplaintDetail(id: string): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_get_complaint_detail", { p_id: id });
  if (error) throw error;
  return data as ServiceResult;
}

export async function assignComplaint(id: string, assignedLabel: string): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_assign_complaint", {
    p_id: id,
    p_assigned_label: assignedLabel,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function changeComplaintStatus(id: string, status: string): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_change_complaint_status", {
    p_id: id,
    p_status: status,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function resolveComplaint(
  id: string,
  input: z.infer<typeof complaintResolveSchema>
): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_resolve_complaint", {
    p_id: id,
    p_category: input.category ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function closeComplaint(
  id: string,
  input: z.infer<typeof complaintCloseSchema>
): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_close_complaint", {
    p_id: id,
    p_justification: input.justification ?? null,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function getComplaintSummary(): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_complaint_summary");
  if (error) throw error;
  return data as ServiceResult;
}
