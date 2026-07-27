import "server-only";

import type { AdminAuthContext, AuthDenialCode } from "@/lib/nom035/server/auth-context";
import { requireAdminAuth } from "@/lib/nom035/server/require-admin-auth";

export type Aal2Result =
  | { ok: true; ctx: AdminAuthContext }
  | { ok: false; code: AuthDenialCode };

export async function requireAal2(): Promise<Aal2Result> {
  const auth = await requireAdminAuth();
  if (!auth.ok) return auth;
  if (auth.ctx.aal !== "aal2") {
    return { ok: false, code: "aal2_required" };
  }
  return auth;
}
