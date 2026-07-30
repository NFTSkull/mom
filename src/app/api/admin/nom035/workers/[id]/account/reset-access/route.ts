import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import { resetWorkerAccess } from "@/lib/nom035/server/worker-portal-service";

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

    const result = await resetWorkerAccess(id);
    const unwrapped = unwrapRpc(result.rpc, requestId);
    if (!unwrapped.ok) return unwrapped.response;

    return adminJsonOk({
      ...unwrapped.value,
      temporaryPassword: result.temporaryPassword,
      requestId,
    });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
