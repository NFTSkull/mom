import { NextRequest } from "next/server";
import {
  deriveRateLimitKey,
  isAllowedOrigin,
  jsonError,
  jsonOk,
  newRequestId,
  readJsonBody,
} from "@/lib/nom035/server/api-helpers";
import {
  buildClearedSessionCookieOptions,
  buildSessionCookieOptions,
  generateEvaluationSession,
  getSessionCookieName,
  hashEvaluationSession,
} from "@/lib/nom035/server/evaluation-session";
import {
  exchangeToken,
  getSessionContext,
} from "@/lib/nom035/server/public-evaluation-backend";
import {
  hashEvaluationToken,
  isWellFormedEvaluationToken,
} from "@/lib/nom035/server/evaluation-token";
import { consumeRateLimit } from "@/lib/nom035/server/public-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: intercambia el token por una sesión HttpOnly.
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  if (!isAllowedOrigin(req)) return jsonError("forbidden_origin", requestId);

  const rate = await consumeRateLimit({
    rawKey: deriveRateLimitKey(req),
    action: "session_exchange",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return jsonError("rate_limited", requestId, { "Retry-After": String(rate.retryAfter) });
  }

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.code, requestId);

  const token = body.value.token;
  if (!isWellFormedEvaluationToken(token)) return jsonError("not_found", requestId);

  const session = generateEvaluationSession();
  const outcome = await exchangeToken({
    tokenHash: hashEvaluationToken(token),
    sessionHash: session.sessionHash,
    sessionExpiresAt: session.expiresAt,
  });

  if (!outcome.ok) return jsonError(outcome.code ?? "not_found", requestId);

  const res = jsonOk({ context: outcome.context }, 201);
  res.cookies.set({
    name: getSessionCookieName(),
    value: session.session,
    ...buildSessionCookieOptions(session.expiresAt),
  });
  return res;
}

// GET: contexto de la sesión actual (cookie HttpOnly).
export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  const cookie = req.cookies.get(getSessionCookieName())?.value;
  if (!cookie) return jsonError("no_session", requestId);

  const outcome = await getSessionContext(hashEvaluationSession(cookie));
  if (!outcome.ok) return jsonError(outcome.code ?? "no_session", requestId);

  return jsonOk({ context: outcome.context });
}

// DELETE: cierra la sesión (borra la cookie).
export async function DELETE(req: NextRequest) {
  const requestId = newRequestId();
  if (!isAllowedOrigin(req)) return jsonError("forbidden_origin", requestId);

  const res = jsonOk({ cleared: true });
  res.cookies.set({
    name: getSessionCookieName(),
    value: "",
    ...buildClearedSessionCookieOptions(),
  });
  return res;
}
