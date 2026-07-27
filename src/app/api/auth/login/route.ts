import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  applyPrivacyHeaders,
  readJsonBody,
} from "@/lib/nom035/server/api-helpers";
import { getPublicSupabaseEnv } from "@/lib/env";
import { consumeRateLimit, hashRateLimitKey } from "@/lib/nom035/server/public-rate-limit";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const loginSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(200),
  })
  .strict();

function genericUnauthorized(requestId: string) {
  const res = NextResponse.json(
    {
      ok: false,
      code: "invalid_credentials",
      message: "Correo o contraseña incorrectos.",
      requestId,
    },
    { status: 401 }
  );
  return applyPrivacyHeaders(res);
}

function clientIp(req: NextRequest): string {
  // No confiar en X-Forwarded-For para autorización; solo para rate-limit HMAC.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get("origin");
  const allowed = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.NOM035_ADMIN_ALLOWED_ORIGINS?.split(",") ?? []),
  ].map((o) => {
    try {
      return new URL(o.trim()).origin;
    } catch {
      return o.trim();
    }
  });
  if (!origin || !allowed.includes(new URL(origin).origin)) {
    const res = NextResponse.json(
      { ok: false, code: "origin_rejected", message: "Origen no permitido.", requestId },
      { status: 403 }
    );
    return applyPrivacyHeaders(res);
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const res = NextResponse.json(
      {
        ok: false,
        code: "invalid_content_type",
        message: "Formato de solicitud no soportado.",
        requestId,
      },
      { status: 400 }
    );
    return applyPrivacyHeaders(res);
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    const res = NextResponse.json(
      { ok: false, code: bodyResult.code, message: "Solicitud inválida.", requestId },
      { status: bodyResult.code === "body_too_large" ? 413 : 400 }
    );
    return applyPrivacyHeaders(res);
  }

  const parsed = loginSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return genericUnauthorized(requestId);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ipHash = hashRateLimitKey(`${clientIp(req)}:${email}`);
  // Usamos el hash ya listo como rawKey compuesto (consumeRateLimit vuelve a hashear).
  const rl = await consumeRateLimit({
    rawKey: `login:${ipHash}`,
    action: "auth.login",
    limit: 200,
    windowSeconds: 15 * 60,
  });
  if (!rl.allowed) {
    const res = NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        message: "Demasiados intentos. Intente más tarde.",
        requestId,
      },
      { status: 429 }
    );
    return applyPrivacyHeaders(res);
  }

  const { url, publishableKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (signError || !signData.user) {
    // No revelar si el correo existe. No loguear password.
    void createHash("sha256").update(email).digest("hex");
    return genericUnauthorized(requestId);
  }

  const { data: ctxData, error: ctxError } = await supabase.rpc("admin_get_my_auth_context");
  if (ctxError || !ctxData || typeof ctxData !== "object") {
    await supabase.auth.signOut();
    return genericUnauthorized(requestId);
  }
  const ctx = ctxData as Record<string, unknown>;
  if (ctx.ok === false) {
    await supabase.auth.signOut();
    const code = String(ctx.code ?? "unauthorized");
    if (code === "account_disabled") {
      const res = NextResponse.json(
        {
          ok: false,
          code: "account_disabled",
          message: "Cuenta deshabilitada.",
          requestId,
        },
        { status: 403 }
      );
      return applyPrivacyHeaders(res);
    }
    const res = NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        message: "Acceso no autorizado.",
        requestId,
      },
      { status: 403 }
    );
    return applyPrivacyHeaders(res);
  }

  await supabase.rpc("admin_touch_last_login");

  const profile = ctx.profile as Record<string, unknown>;
  const aal = ctx.aal === "aal2" ? "aal2" : "aal1";
  const mfaRequired = profile?.mfaRequired !== false;

  let next = "/admin";
  if (mfaRequired) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.some((f) => f.status === "verified") ?? false;
    if (!verified) {
      next = "/admin/seguridad/mfa?mode=enroll";
    } else if (aal !== "aal2") {
      next = "/admin/seguridad/mfa?mode=verify";
    }
  }

  const res = NextResponse.json({ ok: true, next, requestId });
  return applyPrivacyHeaders(res);
}
