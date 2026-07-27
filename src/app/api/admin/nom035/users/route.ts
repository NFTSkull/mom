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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req, "users.read");
  if (denied) return denied;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) return mapRpcThrownError(error, requestId);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch (e) {
    return mapRpcThrownError(e, requestId);
  }
}

const createSchema = z
  .object({
    email: z.string().trim().email().max(320),
    nombre: z.string().trim().min(1).max(200),
    role: z.enum(["admin", "rh", "psicologo", "direccion"]),
    canViewSensitiveCases: z.boolean().optional().default(false),
    mfaRequired: z.boolean().optional().default(true),
    /** Solo pruebas locales: si true, crea usuario con contraseña temporal (no se devuelve). */
    localTemporaryPassword: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req, "users.manage");
  if (denied) return denied;

  const body = await readJsonBody(req);
  if (!body.ok) return adminJsonError(body.code, requestId);
  const parsed = createSchema.safeParse(body.value);
  if (!parsed.success) return adminJsonError("invalid_payload", requestId);

  const email = parsed.data.email.toLowerCase();
  const admin = createSupabaseAdminClient();
  let userId: string | null = null;

  try {
    const tempPassword = parsed.data.localTemporaryPassword
      ? `Tmp!${randomBytes(18).toString("base64url")}`
      : undefined;

    if (tempPassword) {
      const created = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {}, // NUNCA autoridad de roles
      });
      if (created.error || !created.data.user) {
        return adminJsonError("internal_error", requestId);
      }
      userId = created.data.user.id;
    } else {
      const invited = await admin.auth.admin.inviteUserByEmail(email, {
        data: {},
      });
      if (invited.error || !invited.data.user) {
        return adminJsonError("internal_error", requestId);
      }
      userId = invited.data.user.id;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_upsert_admin_profile", {
      p_id: userId,
      p_nombre: parsed.data.nombre,
      p_email: email,
      p_role: parsed.data.role,
      p_can_view_sensitive_cases: parsed.data.canViewSensitiveCases,
      p_mfa_required: parsed.data.mfaRequired,
      p_active: true,
    });
    if (error) {
      await admin.auth.admin.deleteUser(userId);
      return mapRpcThrownError(error, requestId);
    }
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) {
      await admin.auth.admin.deleteUser(userId);
      return unwrapped.response;
    }
    // Nunca devolver contraseña temporal al navegador.
    return adminJsonOk({ ...unwrapped.value, requestId }, 201);
  } catch (e) {
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // incidente compensatorio: no filtrar detalles
      }
    }
    return mapRpcThrownError(e, requestId);
  }
}
