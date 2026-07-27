import { NextRequest } from "next/server";
import {
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
  mapRpcThrownError,
} from "@/lib/nom035/server/admin-api-helpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req, "audit.read");
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_list_audit_log", {
      p_limit: Number(url.searchParams.get("limit") ?? 100),
      p_action: url.searchParams.get("action"),
      p_entity_type: url.searchParams.get("entityType"),
      p_actor: url.searchParams.get("actor"),
    });
    if (error) return mapRpcThrownError(error, requestId);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch (e) {
    return mapRpcThrownError(e, requestId);
  }
}
