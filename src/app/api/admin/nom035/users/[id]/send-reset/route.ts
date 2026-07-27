import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  readJsonBody,
} from "@/lib/nom035/server/admin-api-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSupabaseEnv } from "@/lib/env";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ confirm: z.literal(true) }).strict();

export async function POST(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req, "users.manage");
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  if (!body.ok) return adminJsonError(body.code, requestId);
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return adminJsonError("invalid_payload", requestId);

  const admin = createSupabaseAdminClient();
  const { data: userData, error } = await admin.auth.admin.getUserById(id);
  if (error || !userData.user?.email) return adminJsonError("not_found", requestId);

  const { appUrl } = getPublicSupabaseEnv();
  const redirectTo = `${appUrl.replace(/\/$/, "")}/auth/confirm?next=/restablecer-contrasena`;
  await admin.auth.resetPasswordForEmail(userData.user.email, { redirectTo });

  return adminJsonOk({ requestId, sent: true });
}
