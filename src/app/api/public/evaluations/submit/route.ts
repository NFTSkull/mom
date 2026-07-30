import { randomUUID } from "node:crypto";
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
  getSessionCookieName,
  hashEvaluationSession,
} from "@/lib/nom035/server/evaluation-session";
import {
  getSessionContext,
  submitEvaluation,
} from "@/lib/nom035/server/public-evaluation-backend";
import {
  EvaluationValidationError,
  prepareCanonicalSubmission,
  type PreparedSubmission,
  type RawEvaluationInput,
} from "@/lib/nom035/server/public-evaluation-service";
import { consumeRateLimit } from "@/lib/nom035/server/public-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST: valida en servidor, calcula con motor certificado y persiste atómicamente.
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  if (!isAllowedOrigin(req)) return jsonError("forbidden_origin", requestId);

  const rate = await consumeRateLimit({
    rawKey: deriveRateLimitKey(req),
    action: "submit",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return jsonError("rate_limited", requestId, { "Retry-After": String(rate.retryAfter) });
  }

  const cookie = req.cookies.get(getSessionCookieName())?.value;
  if (!cookie) return jsonError("no_session", requestId);

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.code, requestId);

  const submissionId =
    typeof body.value.submissionId === "string" && UUID_RE.test(body.value.submissionId)
      ? body.value.submissionId
      : randomUUID();

  const sessionHash = hashEvaluationSession(cookie);
  const sessionCtx = await getSessionContext(sessionHash);
  if (!sessionCtx.ok) {
    return jsonError(sessionCtx.code ?? "no_session", requestId);
  }
  const context = sessionCtx.context as { questionnaireVersion?: string } | undefined;
  const questionnaireVersion = context?.questionnaireVersion;
  if (!questionnaireVersion) {
    return jsonError("version_mismatch", requestId);
  }

  let prepared: PreparedSubmission;
  try {
    // El instrumento FRP lo fija el assignment (servidor), no el cliente.
    prepared = prepareCanonicalSubmission(body.value as RawEvaluationInput, {
      questionnaireVersion,
    });
  } catch (error) {
    if (error instanceof EvaluationValidationError) {
      return jsonError("invalid_payload", requestId);
    }
    return jsonError("internal_error", requestId);
  }

  const outcome = await submitEvaluation({
    sessionHash,
    submissionId,
    prepared,
  });

  if (!outcome.ok) return jsonError(outcome.code ?? "internal_error", requestId);

  // Éxito (nuevo o idempotente): la sesión ya fue revocada en la BD; limpia la cookie.
  const isIdempotent = outcome.code === "already_completed";
  const res = jsonOk(
    {
      completed: true,
      completedAt: outcome.completedAt,
      confirmationId: outcome.submissionId ?? submissionId,
    },
    isIdempotent ? 200 : 201
  );
  res.cookies.set({
    name: getSessionCookieName(),
    value: "",
    ...buildClearedSessionCookieOptions(),
  });
  return res;
}
