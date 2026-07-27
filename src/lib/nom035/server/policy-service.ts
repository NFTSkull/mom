import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Servicio de políticas central (B4.5).
 * Genera la base desde company_settings central, gestiona borradores,
 * publicación (archiva la vigente en la misma transacción), duplicado y archivo.
 * Guarda texto plano (sin HTML arbitrario). audit_log sin contenido completo.
 */

const plainText = z
  .string()
  .max(50000)
  .refine((v) => !/[<>]/.test(v), { message: "html_not_allowed" });

export const policyDraftCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).refine((v) => !/[<>]/.test(v), { message: "html_not_allowed" }),
    content: plainText.refine((v) => v.trim().length > 0, { message: "content_required" }),
    versionLabel: z.string().trim().min(1).max(60).optional().nullable(),
    supersedesId: z.string().uuid().optional().nullable(),
  })
  .strict();

export const policyDraftUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).refine((v) => !/[<>]/.test(v), { message: "html_not_allowed" }).optional(),
    content: plainText.optional(),
    versionLabel: z.string().trim().min(1).max(60).optional().nullable(),
  })
  .strict();

export const policyDuplicateSchema = z
  .object({ versionLabel: z.string().trim().min(1).max(60).optional().nullable() })
  .strict();

type ServiceResult = Record<string, unknown>;

async function rpcClient() {
  return createSupabaseServerClient();
}

/** Genera título/contenido base de política a partir de company_settings central. */
export async function generateBasePolicyContent(): Promise<{ title: string; content: string }> {
  const { data, error } = await (await rpcClient()).rpc("admin_get_company_settings");
  if (error) throw error;
  const settings = (data ?? {}) as Record<string, unknown>;
  const company =
    (settings.razonSocial as string) ||
    (settings.razon_social as string) ||
    (settings.legalName as string) ||
    "La empresa";

  const title = `Política de Prevención de Riesgos Psicosociales - ${company}`;
  const content = `${company} establece la presente Política de Prevención de Riesgos Psicosociales con el compromiso de promover un entorno organizacional favorable, prevenir factores de riesgo psicosocial y prevenir actos de violencia laboral dentro del centro de trabajo.

La empresa se compromete a identificar, analizar y atender los factores que puedan afectar el bienestar psicosocial de las personas trabajadoras, así como a promover condiciones de trabajo basadas en el respeto, la comunicación, la participación, la claridad de funciones y la mejora continua.

Queda prohibida cualquier forma de violencia laboral, incluyendo malos tratos, hostigamiento, acoso psicológico, humillaciones, exclusión, intimidación o conductas que afecten la dignidad de las personas trabajadoras.

La empresa mantendrá mecanismos confidenciales para recibir reportes o quejas relacionadas con prácticas opuestas al entorno organizacional favorable o posibles actos de violencia laboral. Toda información recibida será tratada con reserva por personal autorizado.

No se permitirán represalias contra ninguna persona trabajadora que participe en evaluaciones, presente reportes de buena fe o colabore en acciones de mejora.

La empresa promoverá la participación de las personas trabajadoras, la difusión de información, la capacitación y sensibilización de mandos y equipos, así como la revisión periódica de acciones preventivas y correctivas.

Esta política deberá difundirse al personal y mantenerse disponible para consulta.`;

  return { title, content };
}

export async function listPolicies(page = 1, pageSize = 50): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_list_policies", {
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function getPolicy(id: string): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_get_policy", { p_id: id });
  if (error) throw error;
  return data as ServiceResult;
}

export async function createPolicyDraft(
  input: z.infer<typeof policyDraftCreateSchema>
): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_create_policy_draft", {
    p_title: input.title,
    p_content: input.content,
    p_version_label: input.versionLabel ?? null,
    p_supersedes_id: input.supersedesId ?? null,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function updatePolicyDraft(
  id: string,
  input: z.infer<typeof policyDraftUpdateSchema>
): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_update_policy_draft", {
    p_id: id,
    p_title: input.title ?? null,
    p_content: input.content ?? null,
    p_version_label: input.versionLabel ?? null,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function duplicatePolicy(
  id: string,
  input: z.infer<typeof policyDuplicateSchema>
): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_duplicate_policy", {
    p_id: id,
    p_version_label: input.versionLabel ?? null,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function publishPolicy(id: string): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_publish_policy", { p_id: id });
  if (error) throw error;
  return data as ServiceResult;
}

export async function archivePolicy(id: string): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_archive_policy", { p_id: id });
  if (error) throw error;
  return data as ServiceResult;
}

export async function getPolicySummary(): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_policy_summary");
  if (error) throw error;
  return data as ServiceResult;
}
