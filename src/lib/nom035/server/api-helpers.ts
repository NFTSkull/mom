import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/env";

/**
 * Contrato común de respuestas para el flujo público. Nunca expone stack traces,
 * SQL, secretos ni datos personales. Aplica cabeceras de no-cache/privacidad.
 */

export const MAX_BODY_BYTES = 64 * 1024;

export interface ApiErrorBody {
  ok: false;
  code: string;
  message: string;
  requestId: string;
}

/** Mapea códigos internos de negocio a HTTP + mensaje genérico para el trabajador. */
const CODE_MAP: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: "El enlace no es válido." },
  invalid_token: { status: 404, message: "El enlace no es válido." },
  expired: { status: 410, message: "El enlace ha vencido." },
  revoked: { status: 410, message: "El enlace fue revocado." },
  completed: { status: 409, message: "Esta evaluación ya fue completada." },
  conflict: { status: 409, message: "Esta evaluación ya fue completada." },
  version_mismatch: { status: 409, message: "El enlace no es compatible con esta versión." },
  worker_inactive: { status: 410, message: "El enlace no está disponible." },
  campaign_unavailable: { status: 410, message: "La evaluación no está disponible." },
  invalid_expiration: { status: 400, message: "Solicitud inválida." },
  no_session: { status: 401, message: "Tu sesión no es válida. Abre el enlace nuevamente." },
  session_expired: { status: 401, message: "Tu sesión expiró. Abre el enlace nuevamente." },
  session_revoked: { status: 401, message: "Tu sesión fue reemplazada. Abre el enlace nuevamente." },
  stale_draft: { status: 409, message: "El progreso cambió en otra pestaña. Recarga." },
  invalid_payload: { status: 400, message: "Los datos enviados no son válidos." },
  invalid_content_type: { status: 400, message: "Formato de solicitud no soportado." },
  invalid_json: { status: 400, message: "Solicitud malformada." },
  body_too_large: { status: 413, message: "La solicitud es demasiado grande." },
  forbidden_origin: { status: 403, message: "Origen no permitido." },
  rate_limited: { status: 429, message: "Demasiadas solicitudes. Intenta más tarde." },
  internal_error: { status: 500, message: "Ocurrió un error. Intenta de nuevo." },
};

export function newRequestId(): string {
  return randomUUID();
}

/** Cabeceras de privacidad/no-cache para /api/public/evaluations/*. */
export function applyPrivacyHeaders(res: NextResponse, extra?: Record<string, string>): NextResponse {
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
  }
  return res;
}

export function jsonOk(data: Record<string, unknown>, status = 200): NextResponse {
  const res = NextResponse.json({ ok: true, ...data }, { status });
  return applyPrivacyHeaders(res);
}

export function jsonError(code: string, requestId: string, extraHeaders?: Record<string, string>): NextResponse {
  const mapped = CODE_MAP[code] ?? CODE_MAP.internal_error;
  const body: ApiErrorBody = { ok: false, code, message: mapped.message, requestId };
  const res = NextResponse.json(body, { status: mapped.status });
  return applyPrivacyHeaders(res, extraHeaders);
}

/** Valida Content-Type JSON. */
export function isJsonContentType(req: Request): boolean {
  const ct = req.headers.get("content-type") ?? "";
  return ct.toLowerCase().includes("application/json");
}

/** Lee y parsea el body con límite de tamaño. Devuelve un código de error o el objeto. */
export async function readJsonBody(
  req: Request
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; code: string }> {
  if (!isJsonContentType(req)) return { ok: false, code: "invalid_content_type" };
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false, code: "body_too_large" };
  if (raw.trim().length === 0) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, code: "invalid_json" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, code: "invalid_json" };
  }
}

/** Valida el Origin en métodos mutables (defensa CSRF, junto con SameSite=Strict). */
export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Sin Origin: rechazar en métodos mutables (fail-closed).
    return false;
  }
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(getPublicSupabaseEnv().appUrl).origin);
  } catch {
    // ignora appUrl inválido
  }
  const host = req.headers.get("host");
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  try {
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

/** Clave de rate limit no reversible a partir de headers de red disponibles. */
export function deriveRateLimitKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const real = req.headers.get("x-real-ip");
  const ip = (fwd?.split(",")[0] ?? real ?? "local").trim();
  return ip.length > 0 ? ip : "local";
}
