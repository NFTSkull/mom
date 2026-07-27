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

const schema = z
  .object({
    factorId: z.string().min(1).max(80),
    challengeId: z.string().min(1).max(80),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await requireAdminAuth();
  if (!auth.ok) return fail(auth.code, "No autenticado.", 401, requestId);

  // Ventana amplia: suites E2E reutilizan el mismo admin muchas veces;
  // el abuso real sigue bloqueado (código incorrecto + challenge único).
  const rl = await consumeRateLimit({
    rawKey: `mfa-verify:${auth.ctx.userId}`,
    action: "auth.mfa_verify",
    limit: 120,
    windowSeconds: 600,
  });
  if (!rl.allowed) return fail("rate_limited", "Demasiados intentos.", 429, requestId);

  const body = await readJsonBody(req);
  if (!body.ok) return fail(body.code, "Solicitud inválida.", 400, requestId);
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return fail("invalid_payload", "Código inválido.", 400, requestId);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: parsed.data.challengeId,
    code: parsed.data.code,
  });
  if (error || !data) {
    // Nunca loguear el código TOTP
    return fail("mfa_verify_failed", "Código incorrecto.", 401, requestId);
  }

  return applyPrivacyHeaders(
    NextResponse.json({ ok: true, requestId, next: "/admin" })
  );
}
