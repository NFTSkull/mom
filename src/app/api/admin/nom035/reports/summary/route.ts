import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import { getReportsSummary } from "@/lib/nom035/server/admin-core-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const data = await getReportsSummary({
      campaignId: url.searchParams.get("campaignId"),
      departamento: url.searchParams.get("departamento"),
    });
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
