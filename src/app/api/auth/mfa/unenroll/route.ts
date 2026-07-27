import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyPrivacyHeaders, readJsonBody } from "@/lib/nom035/server/api-helpers";
import { requireAal2 } from "@/lib/nom035/server/require-aal2";
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
  const auth = await requireAal2();
  if (!auth.ok) {
    return fail(
      auth.code,
      auth.code === "aal2_required"
        ? "Se requiere verificación en dos pasos."
        : "No autenticado.",
      auth.code === "unauthorized" ? 401 : 403,
      requestId
    );
  }

  const rl = await consumeRateLimit({
    rawKey: `mfa-unenroll:${auth.ctx.userId}`,
    action: "auth.mfa_unenroll",
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rl.allowed) return fail("rate_limited", "Demasiados intentos.", 429, requestId);

  const body = await readJsonBody(req);
  if (!body.ok) return fail(body.code, "Solicitud inválida.", 400, requestId);
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return fail("invalid_payload", "Datos inválidos.", 400, requestId);

  const supabase = await createSupabaseServerClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
  if (auth.ctx.mfaRequired && verified.length <= 1) {
    return fail(
      "last_factor_protected",
      "No puede eliminar el único factor mientras MFA es obligatorio.",
      409,
      requestId
    );
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: parsed.data.factorId });
  if (error) return fail("mfa_unenroll_failed", "No se pudo eliminar el factor.", 400, requestId);

  return applyPrivacyHeaders(NextResponse.json({ ok: true, requestId }));
}
