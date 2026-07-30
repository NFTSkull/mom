import "server-only";

import { z } from "zod";
import { NOM035_QUESTIONNAIRE_VERSION } from "@/data/nom035/guia-ii-manifest";
import { getPublicSupabaseEnv } from "@/lib/env";
import { resolveQuestionnaireVersionForWorkerCount } from "@/lib/nom035/resolve-questionnaire-version";
import { generateEvaluationToken } from "@/lib/nom035/server/evaluation-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalBlank = z
  .string()
  .max(1000)
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

export const campaignCreateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(300),
    descripcion: optionalBlank,
    fechaInicio: z.string().date().optional().nullable(),
    fechaCierre: z.string().date().optional().nullable(),
    questionnaireVersion: z.string().max(120).optional(),
  })
  .strict();

export const campaignUpdateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(300).optional(),
    descripcion: optionalBlank,
    fechaInicio: z.string().date().optional().nullable(),
    fechaCierre: z.string().date().optional().nullable(),
  })
  .strict();

async function rpcClient() {
  return createSupabaseServerClient();
}

function defaultExpiresAt(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString();
}

export function buildEvaluationLink(token: string): string {
  const { appUrl } = getPublicSupabaseEnv();
  const base = appUrl.replace(/\/$/, "");
  return `${base}/evaluacion/${token}`;
}

export function buildWorkerMessage(params: {
  workerName: string;
  companyName: string;
  link: string;
}): string {
  return `Hola ${params.workerName}, como parte de la evaluación NOM-035 de ${params.companyName}, te compartimos tu enlace individual.

Tus respuestas serán tratadas de forma confidencial y se utilizarán para identificar oportunidades de mejora en el entorno laboral.

Responde desde tu celular en el siguiente enlace:

${params.link}`;
}

export async function listCampaigns(params: {
  page: number;
  pageSize: number;
  status?: string | null;
  search?: string | null;
}) {
  const { data, error } = await (await rpcClient()).rpc("admin_list_campaigns", {
    p_status: params.status ?? null,
    p_search: params.search ?? null,
    p_page: params.page,
    p_page_size: params.pageSize,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function resolveDefaultQuestionnaireVersion(): Promise<string> {
  const client = await rpcClient();
  const { data } = await client
    .from("company_settings")
    .select("total_trabajadores")
    .limit(1)
    .maybeSingle();
  const count =
    typeof data?.total_trabajadores === "number" ? data.total_trabajadores : 0;
  return resolveQuestionnaireVersionForWorkerCount(count);
}

export async function createCampaign(input: z.infer<typeof campaignCreateSchema>) {
  const version =
    input.questionnaireVersion ?? (await resolveDefaultQuestionnaireVersion());
  const { data, error } = await (await rpcClient()).rpc("admin_create_campaign", {
    p_nombre: input.nombre,
    p_descripcion: input.descripcion,
    p_fecha_inicio: input.fechaInicio ?? null,
    p_fecha_cierre: input.fechaCierre ?? null,
    p_questionnaire_version: version,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function updateCampaign(id: string, input: z.infer<typeof campaignUpdateSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_update_campaign", {
    p_campaign_id: id,
    p_nombre: input.nombre ?? null,
    p_descripcion: input.descripcion,
    p_fecha_inicio: input.fechaInicio ?? null,
    p_fecha_cierre: input.fechaCierre ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function activateCampaign(id: string) {
  const { data, error } = await (await rpcClient()).rpc("admin_activate_campaign", {
    p_campaign_id: id,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function closeCampaign(id: string) {
  const { data, error } = await (await rpcClient()).rpc("admin_close_campaign", {
    p_campaign_id: id,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function listCampaignAssignments(
  campaignId: string,
  params: { page: number; pageSize: number; status?: string | null; search?: string | null }
) {
  const { data, error } = await (await rpcClient()).rpc("admin_list_campaign_assignments", {
    p_campaign_id: campaignId,
    p_status: params.status ?? null,
    p_search: params.search ?? null,
    p_page: params.page,
    p_page_size: params.pageSize,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export type IssuedLink = {
  workerId: string;
  assignmentId: string;
  tokenLast4: string;
  token: string;
  link: string;
  expiresAt: string;
};

/** Emite un assignment individual. El token real solo vive en esta respuesta. */
async function campaignQuestionnaireVersion(campaignId: string): Promise<string> {
  const client = await rpcClient();
  const { data } = await client
    .from("evaluation_campaigns")
    .select("questionnaire_version")
    .eq("id", campaignId)
    .maybeSingle();
  return (
    (data?.questionnaire_version as string | null) ??
    NOM035_QUESTIONNAIRE_VERSION
  );
}

export async function issueAssignment(params: {
  campaignId: string;
  workerId: string;
  expiresAt?: string;
}): Promise<Record<string, unknown>> {
  const generated = generateEvaluationToken();
  const expiresAt = params.expiresAt ?? defaultExpiresAt();
  const questionnaireVersion = await campaignQuestionnaireVersion(params.campaignId);
  const { data, error } = await (await rpcClient()).rpc("admin_issue_assignment", {
    p_campaign_id: params.campaignId,
    p_worker_id: params.workerId,
    p_token_hash: generated.tokenHash,
    p_token_last4: generated.tokenLast4,
    p_expires_at: expiresAt,
    p_questionnaire_version: questionnaireVersion,
  });
  if (error) throw error;
  const rpc = data as Record<string, unknown>;
  if (rpc.ok === false) return rpc;
  return {
    ...rpc,
    token: generated.token,
    link: buildEvaluationLink(generated.token),
  };
}

/**
 * Emite assignments faltantes. Tokens se generan en Next (no en SQL).
 * Batch atómico en DB; si falla uno, no persiste el lote.
 * Tokens reales solo en la respuesta inmediata.
 */
export async function issueMissingAssignments(campaignId: string): Promise<Record<string, unknown>> {
  const missingRes = await (await rpcClient()).rpc("admin_list_missing_assignment_workers", {
    p_campaign_id: campaignId,
  });
  if (missingRes.error) throw missingRes.error;
  const missing = missingRes.data as Record<string, unknown>;
  if (missing.ok === false) return missing;

  const workerIds = (missing.workerIds as string[]) ?? [];
  if (workerIds.length === 0) {
    return { ok: true, created: [], links: [], warning: "No hay trabajadores activos sin enlace." };
  }

  const expiresAt = defaultExpiresAt();
  const questionnaireVersion = await campaignQuestionnaireVersion(campaignId);
  const localTokens: IssuedLink[] = [];
  const items = workerIds.map((workerId) => {
    const generated = generateEvaluationToken();
    localTokens.push({
      workerId,
      assignmentId: "",
      tokenLast4: generated.tokenLast4,
      token: generated.token,
      link: buildEvaluationLink(generated.token),
      expiresAt,
    });
    return {
      workerId,
      tokenHash: generated.tokenHash,
      tokenLast4: generated.tokenLast4,
      expiresAt,
      questionnaireVersion,
    };
  });

  const { data, error } = await (await rpcClient()).rpc("admin_issue_assignments_batch", {
    p_campaign_id: campaignId,
    p_items: items,
    p_questionnaire_version: questionnaireVersion,
  });
  if (error) throw error;
  const rpc = data as Record<string, unknown>;
  if (rpc.ok === false) return rpc;

  const created = (rpc.created as Array<Record<string, string>>) ?? [];
  const links = localTokens.map((t) => {
    const match = created.find((c) => c.workerId === t.workerId);
    return {
      ...t,
      assignmentId: match?.assignmentId ?? "",
    };
  });

  return {
    ok: true,
    created,
    links,
    warning:
      "Por seguridad, estos enlaces no podrán consultarse nuevamente. Puedes regenerarlos posteriormente.",
  };
}

export async function rotateAssignmentToken(assignmentId: string): Promise<Record<string, unknown>> {
  const generated = generateEvaluationToken();
  const expiresAt = defaultExpiresAt();
  const { data, error } = await (await rpcClient()).rpc("admin_rotate_assignment_token", {
    p_assignment_id: assignmentId,
    p_token_hash: generated.tokenHash,
    p_token_last4: generated.tokenLast4,
    p_expires_at: expiresAt,
  });
  if (error) throw error;
  const rpc = data as Record<string, unknown>;
  if (rpc.ok === false) return rpc;
  return {
    ...rpc,
    token: generated.token,
    link: buildEvaluationLink(generated.token),
  };
}

export async function revokeAssignment(assignmentId: string, reason?: string | null) {
  const { data, error } = await (await rpcClient()).rpc("admin_revoke_assignment", {
    p_assignment_id: assignmentId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}
