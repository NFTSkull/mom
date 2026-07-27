import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyPrivacyHeaders, readJsonBody } from "@/lib/nom035/server/api-helpers";
import { requireAdminAuth } from "@/lib/nom035/server/require-admin-auth";
import { consumeRateLimit } from "@/lib/nom035/server/public-rate-limit";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number, requestId: string) {
  return applyPrivacyHeaders(
    NextResponse.json({ ok: false, code, message, requestId }, { status })
  );
}

const schema = z.object({ factorId: z.string().min(1).max(80) }).strict();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await requireAdminAuth();
  if (!auth.ok) return fail(auth.code, "No autenticado.", 401, requestId);

  const rl = await consumeRateLimit({
    rawKey: `mfa-challenge:${auth.ctx.userId}`,
    action: "auth.mfa_challenge",
    limit: 120,
    windowSeconds: 600,
  });
  if (!rl.allowed) return fail("rate_limited", "Demasiados intentos.", 429, requestId);

  const body = await readJsonBody(req);
  if (!body.ok) return fail(body.code, "Solicitud inválida.", 400, requestId);
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return fail("invalid_payload", "Datos inválidos.", 400, requestId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factorId,
  });
  if (error || !data) {
    return fail("mfa_challenge_failed", "No se pudo iniciar el desafío.", 400, requestId);
  }
  return applyPrivacyHeaders(
    NextResponse.json({ ok: true, requestId, challengeId: data.id })
  );
}
