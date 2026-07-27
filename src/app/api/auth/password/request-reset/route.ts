import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyPrivacyHeaders, readJsonBody } from "@/lib/nom035/server/api-helpers";
import { getPublicSupabaseEnv } from "@/lib/env";
import { consumeRateLimit } from "@/lib/nom035/server/public-rate-limit";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().email().max(320) }).strict();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const generic = applyPrivacyHeaders(
    NextResponse.json({
      ok: true,
      requestId,
      message:
        "Si el correo está registrado, recibirá instrucciones para restablecer el acceso.",
    })
  );

  const body = await readJsonBody(req);
  if (!body.ok) return generic;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return generic;

  const email = parsed.data.email.toLowerCase();
  const rl = await consumeRateLimit({
    rawKey: `pwd-reset:${email}`,
    action: "auth.password_reset_requested",
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rl.allowed) return generic;

  const { appUrl } = getPublicSupabaseEnv();
  const redirectTo = `${appUrl.replace(/\/$/, "")}/auth/confirm?next=/restablecer-contrasena`;
  // Validar redirect local
  if (!redirectTo.startsWith("http://127.0.0.1") && !redirectTo.startsWith("http://localhost")) {
    return generic;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // No revelar si existe. No loguear email completo.
  return generic;
}
