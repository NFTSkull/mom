import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import {
  actionPlanUpdateSchema,
  updateActionPlan,
} from "@/lib/nom035/server/action-plan-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) {
      return adminJsonError("invalid_payload", requestId);
    }
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const parsed = actionPlanUpdateSchema.safeParse(body.value);
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);
    const data = await updateActionPlan(id, parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
