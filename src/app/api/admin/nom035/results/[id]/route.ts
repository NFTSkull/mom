import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import { getResultDetail } from "@/lib/nom035/server/admin-core-service";
import { mapResultDetail } from "@/lib/nom035/server/admin-result-mapper";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) {
      return adminJsonError("invalid_payload", requestId);
    }
    const data = await getResultDetail(id);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    const mapped = mapResultDetail(unwrapped.value);
    return adminJsonOk({
      detail: mapped,
      disclaimer: mapped?.disclaimer,
      requestId,
    });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
