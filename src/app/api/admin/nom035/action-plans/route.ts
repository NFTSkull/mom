import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import {
  actionPlanCreateSchema,
  actionPlanListSchema,
  createActionPlan,
  listActionPlans,
} from "@/lib/nom035/server/action-plan-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const parsed = actionPlanListSchema.safeParse({
      campaignId: url.searchParams.get("campaignId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      includeArchived: url.searchParams.get("includeArchived") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);
    const data = await listActionPlans(parsed.data);
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
    const parsed = actionPlanCreateSchema.safeParse(body.value);
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);
    const data = await createActionPlan(parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId }, 201);
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
