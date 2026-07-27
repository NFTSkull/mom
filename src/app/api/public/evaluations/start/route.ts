import { NextRequest } from "next/server";
import {
  isAllowedOrigin,
  jsonError,
  jsonOk,
  newRequestId,
} from "@/lib/nom035/server/api-helpers";
import {
  getSessionCookieName,
  hashEvaluationSession,
} from "@/lib/nom035/server/evaluation-session";
import { startEvaluation } from "@/lib/nom035/server/public-evaluation-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: marca la evaluación como iniciada (idempotente).
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  if (!isAllowedOrigin(req)) return jsonError("forbidden_origin", requestId);

  const cookie = req.cookies.get(getSessionCookieName())?.value;
  if (!cookie) return jsonError("no_session", requestId);

  const outcome = await startEvaluation(hashEvaluationSession(cookie));
  if (!outcome.ok) return jsonError(outcome.code ?? "no_session", requestId);

  return jsonOk({ context: outcome.context });
}
