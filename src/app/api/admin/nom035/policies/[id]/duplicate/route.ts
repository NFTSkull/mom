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
  duplicatePolicy,
  policyDuplicateSchema,
} from "@/lib/nom035/server/policy-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) {
      return adminJsonError("invalid_payload", requestId);
    }
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const parsed = policyDuplicateSchema.safeParse(body.value);
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);
    const data = await duplicatePolicy(id, parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId }, 201);
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
