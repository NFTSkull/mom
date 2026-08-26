import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/env";
import {
  applyPrivacyHeaders,
  readJsonBody,
} from "@/lib/nom035/server/api-helpers";
import { consumeRateLimit, hashRateLimitKey } from "@/lib/nom035/server/public-rate-limit";
import {
  isWorkerAppMetadata,
  isNom035CampaignClosed,
  markWorkerLogin,
  normalizeUsername,
  resolveWorkerLoginUsername,
} from "@/lib/nom035/server/worker-portal-service";

export const runtime = "nodejs";

const loginSchema = z
  .object({
    username: z.string().trim().min(3).max(64),
    password: z.string().min(1).max(200),
  })
  .strict();

function genericUnauthorized(requestId: string) {
  return applyPrivacyHeaders(
    NextResponse.json(
      {
        ok: false,
        code: "invalid_credentials",
        message: "Usuario o contraseña incorrectos.",
        requestId,
      },
      { status: 401 }
    )
  );
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.NOM035_ADMIN_ALLOWED_ORIGINS?.split(",") ?? []),
    process.env.NEXT_PUBLIC_APP_URL ?? "",
  ]
    .filter(Boolean)
    .map((o) => {
      try {
        return new URL(o.trim()).origin;
      } catch {
        return o.trim();
      }
    });
  try {
    return allowed.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!originAllowed(req)) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: "origin_rejected", message: "Origen no permitido.", requestId },
        { status: 403 }
      )
    );
  }

  const body = await readJsonBody(req);
  if (!body.ok) return genericUnauthorized(requestId);
  const parsed = loginSchema.safeParse(body.value);
  if (!parsed.success) return genericUnauthorized(requestId);

  const username = normalizeUsername(parsed.data.username);
  // B4.18: username es string (p.ej. "001"); no Number/parseInt — se preservan ceros.
  const ipHash = hashRateLimitKey(`${clientIp(req)}:${username}`);
  const rate = await consumeRateLimit({
    rawKey: `worker-login:${ipHash}`,
    action: "worker_login",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: "rate_limited", message: "Demasiados intentos.", requestId },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
      )
    );
  }

  // B4.23: campaña cerrada → no hay acceso operativo (mensaje único, sin enumerar).
  if (await isNom035CampaignClosed()) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: "evaluation_unavailable",
          message: "La evaluación ya no está disponible.",
          requestId,
        },
        { status: 403 }
      )
    );
  }

  const resolved = await resolveWorkerLoginUsername(username);
  if (!resolved.ok) return genericUnauthorized(requestId);

  const { url, publishableKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const c of items) cookieStore.set(c.name, c.value, c.options);
      },
    },
  });

  const signed = await supabase.auth.signInWithPassword({
    email: resolved.email,
    password: parsed.data.password,
  });
  if (signed.error || !signed.data.user) return genericUnauthorized(requestId);

  if (!isWorkerAppMetadata(signed.data.user.app_metadata)) {
    await supabase.auth.signOut();
    return genericUnauthorized(requestId);
  }

  await markWorkerLogin(signed.data.user.id);

  return applyPrivacyHeaders(
    NextResponse.json({
      ok: true,
      mustChangePassword: resolved.mustChangePassword,
      requestId,
    })
  );
}
