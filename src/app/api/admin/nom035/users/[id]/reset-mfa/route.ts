import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  readJsonBody,
} from "@/lib/nom035/server/admin-api-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const { data: factors, error } = await admin.auth.admin.mfa.listFactors({ userId: id });
  if (error) return adminJsonError("internal_error", requestId);

  for (const f of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: id });
  }
  // Nunca mostrar secretos. Obliga reenrolamiento en próximo login.
  return adminJsonOk({ requestId, reset: true });
}
