import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import { listResults } from "@/lib/nom035/server/admin-core-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return adminJsonError("invalid_payload", requestId);
    }
    const data = await listResults({
      campaignId: url.searchParams.get("campaignId"),
      workerId: url.searchParams.get("workerId"),
      departamento: url.searchParams.get("departamento"),
      riskLevel: url.searchParams.get("riskLevel"),
      search: url.searchParams.get("search"),
      page,
      pageSize,
    });
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
