import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Servicio server-only del Plan de Acción central (B4.5).
 * Toda la persistencia ocurre vía RPCs SECURITY DEFINER (service_role).
 * No usa localStorage ni mocks. No registra cuerpos sensibles.
 */

const ACTION_LEVELS = ["primer_nivel", "segundo_nivel", "tercer_nivel"] as const;
const ACTION_TYPES = [
  "organizacional",
  "grupal",
  "individual",
  "individual_confidencial",
] as const;
const RISK_LEVELS = ["nulo", "bajo", "medio", "alto", "muy_alto"] as const;
const STATUSES = ["pendiente", "en_proceso", "completada", "cancelada"] as const;

const optionalText = z
  .string()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

export const actionPlanListSchema = z
  .object({
    campaignId: z.string().uuid().optional().nullable(),
    status: z.enum(STATUSES).optional().nullable(),
    source: z.enum(["manual", "suggested"]).optional().nullable(),
    includeArchived: z.coerce.boolean().optional().default(false),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const actionPlanCreateSchema = z
  .object({
    campaignId: z.string().uuid(),
    area: z.string().trim().min(1).max(200),
    riskFactor: z.string().trim().min(1).max(200),
    riskLevel: z.enum(RISK_LEVELS),
    actionLevel: z.enum(ACTION_LEVELS),
    actionType: z.enum(ACTION_TYPES),
    description: z.string().trim().min(1).max(2000),
    responsible: z.string().trim().min(1).max(200),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    followUpNotes: z.string().max(2000).optional().default(""),
  })
  .strict();

export const actionPlanUpdateSchema = z
  .object({
    area: z.string().trim().min(1).max(200).optional(),
    riskFactor: z.string().trim().min(1).max(200).optional(),
    riskLevel: z.enum(RISK_LEVELS).optional(),
    actionLevel: z.enum(ACTION_LEVELS).optional(),
    actionType: z.enum(ACTION_TYPES).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    responsible: z.string().trim().min(1).max(200).optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    followUpNotes: optionalText,
    clearDueDate: z.boolean().optional().default(false),
  })
  .strict();

export const actionPlanStatusSchema = z
  .object({ status: z.enum(STATUSES) })
  .strict();

export const actionPlanGenerateSchema = z
  .object({
    campaignId: z.string().uuid(),
    responsible: z.string().trim().min(1).max(200).optional().default("RH"),
    dueDays: z.coerce.number().int().min(1).max(365).optional().default(30),
    guiaIDueDays: z.coerce.number().int().min(1).max(365).optional().default(15),
  })
  .strict();

/**
 * Mapa determinista dominio → plantilla de acción sugerida.
 * El mapeo vive en el servicio; la agregación de riesgos y la persistencia
 * transaccional/idempotente ocurre en la RPC leyendo resultados centrales.
 */
const DOMAIN_ACTION_MAP: Record<
  string,
  { area: string; actionLevel: (typeof ACTION_LEVELS)[number]; actionType: (typeof ACTION_TYPES)[number]; description: string }
> = {
  "Carga de trabajo": {
    area: "Operaciones",
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar distribución de tareas, pausas, cargas y ritmo de trabajo.",
  },
  Liderazgo: {
    area: "Mandos medios",
    actionLevel: "segundo_nivel",
    actionType: "grupal",
    description: "Fortalecer comunicación, claridad de funciones y capacitación a mandos.",
  },
  Violencia: {
    area: "RH",
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar y difundir mecanismos de prevención, atención y denuncia de violencia laboral.",
  },
  "Interferencia en la relación trabajo-familia": {
    area: "RH",
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar horarios, límites de jornada y medidas de conciliación.",
  },
  "Jornada de trabajo": {
    area: "Operaciones",
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar jornadas, descansos, horas extras y rotación de turnos.",
  },
  "Falta de control sobre el trabajo": {
    area: "Mandos medios",
    actionLevel: "segundo_nivel",
    actionType: "grupal",
    description: "Incrementar claridad, autonomía, capacitación y participación del trabajador.",
  },
  "Condiciones en el ambiente de trabajo": {
    area: "Seguridad e Higiene",
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar condiciones físicas, seguridad y riesgos del entorno.",
  },
  "Relaciones en el trabajo": {
    area: "RH",
    actionLevel: "segundo_nivel",
    actionType: "grupal",
    description: "Fortalecer colaboración, apoyo social y solución de conflictos.",
  },
};

const GUIA_I_TEMPLATE = {
  area: "RH",
  actionLevel: "tercer_nivel" as const,
  description:
    "Canalizar a seguimiento psicológico, médico o institucional por personal autorizado.",
};

async function rpcClient() {
  return createSupabaseServerClient();
}

export async function listActionPlans(input: z.infer<typeof actionPlanListSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_list_action_plans", {
    p_campaign_id: input.campaignId ?? null,
    p_status: input.status ?? null,
    p_source: input.source ?? null,
    p_include_archived: input.includeArchived,
    p_page: input.page,
    p_page_size: input.pageSize,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function createActionPlan(input: z.infer<typeof actionPlanCreateSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_create_action_plan", {
    p_campaign_id: input.campaignId,
    p_area: input.area,
    p_risk_factor: input.riskFactor,
    p_risk_level: input.riskLevel,
    p_action_level: input.actionLevel,
    p_action_type: input.actionType,
    p_description: input.description,
    p_responsible: input.responsible,
    p_due_date: input.dueDate ?? null,
    p_follow_up_notes: input.followUpNotes ?? "",
    p_source: "manual",
    p_source_key: null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function updateActionPlan(id: string, input: z.infer<typeof actionPlanUpdateSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_update_action_plan", {
    p_id: id,
    p_area: input.area ?? null,
    p_risk_factor: input.riskFactor ?? null,
    p_risk_level: input.riskLevel ?? null,
    p_action_level: input.actionLevel ?? null,
    p_action_type: input.actionType ?? null,
    p_description: input.description ?? null,
    p_responsible: input.responsible ?? null,
    p_due_date: input.dueDate ?? null,
    p_follow_up_notes: input.followUpNotes ?? null,
    p_clear_due_date: input.clearDueDate ?? false,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function changeActionPlanStatus(id: string, status: (typeof STATUSES)[number]) {
  const { data, error } = await (await rpcClient()).rpc("admin_change_action_plan_status", {
    p_id: id,
    p_status: status,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function archiveActionPlan(id: string) {
  const { data, error } = await (await rpcClient()).rpc("admin_archive_action_plan", {
    p_id: id,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function generateSuggestedActionPlans(input: z.infer<typeof actionPlanGenerateSchema>) {
  const { data, error } = await (await rpcClient()).rpc("admin_generate_suggested_action_plans", {
    p_campaign_id: input.campaignId,
    p_domain_map: DOMAIN_ACTION_MAP,
    p_responsible: input.responsible ?? "RH",
    p_due_days: input.dueDays ?? 30,
    p_guia_i: GUIA_I_TEMPLATE,
    p_guia_i_due_days: input.guiaIDueDays ?? 15,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function getActionPlanSummary(campaignId?: string | null) {
  const { data, error } = await (await rpcClient()).rpc("admin_action_plan_summary", {
    p_campaign_id: campaignId ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}
