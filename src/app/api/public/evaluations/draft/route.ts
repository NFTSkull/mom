import { NextRequest } from "next/server";
import {
  isAllowedOrigin,
  jsonError,
  jsonOk,
  newRequestId,
  readJsonBody,
} from "@/lib/nom035/server/api-helpers";
import {
  getSessionCookieName,
  hashEvaluationSession,
} from "@/lib/nom035/server/evaluation-session";
import { saveDraft } from "@/lib/nom035/server/public-evaluation-backend";
import { CLIENT_AUTHORITATIVE_FIELDS } from "@/lib/nom035/server/public-evaluation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Elimina cualquier campo de autoridad/score del borrador antes de persistir. */
function sanitizeDraftPayload(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return {};
  const clone: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  for (const field of CLIENT_AUTHORITATIVE_FIELDS) delete clone[field];
  // El token nunca debe guardarse en el borrador.
  delete clone.token;
  return clone;
}

// PUT: guarda el borrador central (sin scores/token).
export async function PUT(req: NextRequest) {
  const requestId = newRequestId();
  if (!isAllowedOrigin(req)) return jsonError("forbidden_origin", requestId);

  const cookie = req.cookies.get(getSessionCookieName())?.value;
  if (!cookie) return jsonError("no_session", requestId);

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.code, requestId);

  const payload = sanitizeDraftPayload(body.value.payload);
  const expectedUpdatedAt =
    typeof body.value.expectedUpdatedAt === "string" ? body.value.expectedUpdatedAt : null;

  const outcome = await saveDraft({
    sessionHash: hashEvaluationSession(cookie),
    payload,
    expectedUpdatedAt,
  });
  if (!outcome.ok) return jsonError(outcome.code ?? "no_session", requestId);

  return jsonOk({ updatedAt: outcome.updatedAt });
}
