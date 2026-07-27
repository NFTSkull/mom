import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import { complaintListSchema, listComplaints } from "@/lib/nom035/server/complaint-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const parsed = complaintListSchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      complaintType: url.searchParams.get("complaintType") ?? undefined,
      folio: url.searchParams.get("folio") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);
    const data = await listComplaints(parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
