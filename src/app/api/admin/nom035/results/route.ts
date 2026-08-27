import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import { listResults } from "@/lib/nom035/server/admin-core-service";
import {
  RESULTS_PAGE_SIZE,
  computeTotalPages,
  normalizePage,
} from "@/lib/nom035/results-pagination";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const rawPage = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? String(RESULTS_PAGE_SIZE));
    if (!Number.isFinite(rawPage) || !Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) {
      return adminJsonError("invalid_payload", requestId);
    }
    const page = rawPage < 1 ? 1 : Math.floor(rawPage);
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
    const value = unwrapped.value as Record<string, unknown>;
    const total = Number(value.total ?? 0);
    const totalPages = computeTotalPages(total, pageSize);
    const safePage = normalizePage(Number(value.page ?? page), total, pageSize);
    return adminJsonOk({
      ...value,
      page: safePage,
      pageSize,
      total,
      totalPages,
      requestId,
    });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
