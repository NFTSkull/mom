import { NextRequest } from "next/server";
import {
  adminJsonOk,
  requireAdminApiAuth,
  unwrapRpc,
  mapRpcThrownError,
} from "@/lib/nom035/server/admin-api-helpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req, "users.manage");
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_deactivate_admin_profile", { p_id: id });
    if (error) return mapRpcThrownError(error, requestId);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch (e) {
    return mapRpcThrownError(e, requestId);
  }
}
