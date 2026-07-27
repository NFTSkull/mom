import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type AdminAuthContext,
  type AuthDenialCode,
} from "@/lib/nom035/server/auth-context";
import {
  type AppPermission,
  isAppPermission,
  type AdminRole,
} from "@/lib/nom035/auth/permissions";

export type AuthResult =
  | { ok: true; ctx: AdminAuthContext }
  | { ok: false; code: AuthDenialCode };

function asRole(value: unknown): AdminRole | null {
  if (value === "admin" || value === "rh" || value === "psicologo" || value === "direccion") {
    return value;
  }
  return null;
}

function asAal(value: unknown): "aal1" | "aal2" {
  return value === "aal2" ? "aal2" : "aal1";
}

/**
 * Valida el JWT con getClaims (NO getSession como autoridad).
 */
export async function getVerifiedClaims(): Promise<{
  sub: string | null;
  aal: "aal1" | "aal2";
  email: string | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const claims = data.claims as Record<string, unknown>;
  const sub = typeof claims.sub === "string" ? claims.sub : null;
  const email = typeof claims.email === "string" ? claims.email : null;
  const aal = asAal(claims.aal);
  return { sub, aal, email };
}

/**
 * Confirma estado Auth actualizado con el servidor (getUser).
 * No usar la sesión en caché del cliente como autoridad de autorización.
 */
export async function getFreshAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getAdminAuthContext(): Promise<AuthResult> {
  const claims = await getVerifiedClaims();
  if (!claims?.sub) {
    return { ok: false, code: "unauthorized" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_my_auth_context");
  if (error || !data || typeof data !== "object") {
    return { ok: false, code: "unauthorized" };
  }
  const record = data as Record<string, unknown>;
  if (record.ok === false) {
    const code = typeof record.code === "string" ? record.code : "unauthorized";
    if (
      code === "profile_missing" ||
      code === "account_disabled" ||
      code === "unauthorized"
    ) {
      return { ok: false, code };
    }
    return { ok: false, code: "forbidden" };
  }

  const profile = record.profile as Record<string, unknown> | undefined;
  if (!profile) return { ok: false, code: "profile_missing" };
  const role = asRole(profile.role);
  if (!role) return { ok: false, code: "forbidden" };

  const rawPerms = Array.isArray(record.permissions) ? record.permissions : [];
  const permissions: AppPermission[] = rawPerms.filter(
    (p): p is AppPermission => typeof p === "string" && isAppPermission(p)
  );

  const aalFromRpc = asAal(record.aal);
  const aal = claims.aal === "aal2" || aalFromRpc === "aal2" ? "aal2" : "aal1";

  return {
    ok: true,
    ctx: {
      userId: String(profile.id ?? claims.sub),
      email: String(profile.email ?? claims.email ?? ""),
      nombre: String(profile.nombre ?? ""),
      role,
      permissions,
      canViewSensitiveCases: profile.canViewSensitiveCases === true,
      mfaRequired: profile.mfaRequired !== false,
      mustChangePassword: profile.mustChangePassword === true,
      active: profile.active === true,
      aal,
      version: typeof profile.version === "number" ? profile.version : 1,
    },
  };
}

export async function requireAdminAuth(): Promise<AuthResult> {
  return getAdminAuthContext();
}

export async function optionalAdminAuth(): Promise<AdminAuthContext | null> {
  const result = await getAdminAuthContext();
  return result.ok ? result.ctx : null;
}
