import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import {
  createPolicyDraft,
  listPolicies,
  policyDraftCreateSchema,
} from "@/lib/nom035/server/policy-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return adminJsonError("invalid_payload", requestId);
    }
    const data = await listPolicies(page, pageSize);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}

export async function POST(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const parsed = policyDraftCreateSchema.safeParse(body.value);
    if (!parsed.success) {
      const htmlIssue = parsed.error.issues.some((i) => i.message === "html_not_allowed");
      return adminJsonError(htmlIssue ? "invalid_payload" : "invalid_payload", requestId);
    }
    const data = await createPolicyDraft(parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId }, 201);
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
