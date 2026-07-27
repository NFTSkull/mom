import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import {
  createExternalEvidence,
  evidenceExternalSchema,
} from "@/lib/nom035/server/evidence-service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const parsed = evidenceExternalSchema.safeParse(body.value);
    if (!parsed.success) {
      const httpsIssue = parsed.error.issues.some((i) => i.message === "https_required");
      return adminJsonError(httpsIssue ? "https_required" : "invalid_payload", requestId);
    }
    const data = await createExternalEvidence(parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId }, 201);
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
