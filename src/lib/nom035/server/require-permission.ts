import "server-only";

import type { AppPermission } from "@/lib/nom035/auth/permissions";
import {
  permissionIsSensitive,
  permissionRequiresAal2,
} from "@/lib/nom035/auth/permissions";
import type { AdminAuthContext, AuthDenialCode } from "@/lib/nom035/server/auth-context";
import { requireAdminAuth } from "@/lib/nom035/server/require-admin-auth";

export type PermissionResult =
  | { ok: true; ctx: AdminAuthContext }
  | { ok: false; code: AuthDenialCode };

export async function requirePermission(
  permission: AppPermission
): Promise<PermissionResult> {
  const auth = await requireAdminAuth();
  if (!auth.ok) return auth;

  const { ctx } = auth;
  if (!ctx.permissions.includes(permission)) {
    return { ok: false, code: "forbidden" };
  }

  if (permissionRequiresAal2(permission) && ctx.aal !== "aal2") {
    return { ok: false, code: "aal2_required" };
  }

  if (permissionIsSensitive(permission) && !ctx.canViewSensitiveCases) {
    return { ok: false, code: "forbidden" };
  }

  return { ok: true, ctx };
}

export async function requireSensitivePermission(
  permission: AppPermission
): Promise<PermissionResult> {
  if (!permissionIsSensitive(permission)) {
    return requirePermission(permission);
  }
  return requirePermission(permission);
}
