import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
  mapRpcThrownError,
  readJsonBody,
} from "@/lib/nom035/server/admin-api-helpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(200).optional(),
    role: z.enum(["admin", "rh", "psicologo", "direccion"]).optional(),
    canViewSensitiveCases: z.boolean().optional(),
    mfaRequired: z.boolean().optional(),
    active: z.boolean().optional(),
    confirm: z.literal(true),
  })
  .strict();

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req, "users.manage");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  if (!body.ok) return adminJsonError(body.code, requestId);
  const parsed = updateSchema.safeParse(body.value);
  if (!parsed.success) return adminJsonError("invalid_payload", requestId);

  try {
    const supabase = await createSupabaseServerClient();
    const list = await supabase.rpc("admin_list_users");
    const users = (list.data as { users?: Array<Record<string, unknown>> })?.users ?? [];
    const current = users.find((u) => u.id === id);
    if (!current) return adminJsonError("not_found", requestId);

    const { data, error } = await supabase.rpc("admin_upsert_admin_profile", {
      p_id: id,
      p_nombre: parsed.data.nombre ?? String(current.nombre),
      p_email: String(current.email),
      p_role: parsed.data.role ?? String(current.role),
      p_can_view_sensitive_cases:
        parsed.data.canViewSensitiveCases ?? Boolean(current.canViewSensitiveCases),
      p_mfa_required: parsed.data.mfaRequired ?? Boolean(current.mfaRequired),
      p_active: parsed.data.active ?? Boolean(current.active),
    });
    if (error) return mapRpcThrownError(error, requestId);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch (e) {
    return mapRpcThrownError(e, requestId);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req, "users.manage");
  if (denied) return denied;
  const { id } = await ctx.params;
  // Preferir desactivar; borrado solo si no hay historial crítico y no es último admin.
  try {
    const supabase = await createSupabaseServerClient();
    const deact = await supabase.rpc("admin_deactivate_admin_profile", { p_id: id });
    if (deact.error) return mapRpcThrownError(deact.error, requestId);
    const unwrapped = unwrapRpc(deact.data, requestId);
    if (!unwrapped.ok) return unwrapped.response;

    // No eliminar auth.users ni audit_log; documentado: soft-delete preferido.
    return adminJsonOk({
      requestId,
      deleted: false,
      deactivated: true,
      note: "Se desactivó el perfil; no se elimina historial ni auditoría.",
    });
  } catch (e) {
    return mapRpcThrownError(e, requestId);
  }
}
