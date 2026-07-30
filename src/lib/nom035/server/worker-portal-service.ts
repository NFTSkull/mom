import "server-only";

import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateEvaluationSession,
  type GeneratedEvaluationSession,
} from "@/lib/nom035/server/evaluation-session";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isWorkerAppMetadata(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  return (meta as { role?: string }).role === "worker";
}

export type WorkerLoginResolve = {
  ok: true;
  authUserId: string;
  workerId: string;
  accountId: string;
  email: string;
  mustChangePassword: boolean;
} | { ok: false; code: string };

export async function resolveWorkerLoginUsername(
  username: string
): Promise<WorkerLoginResolve> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_resolve_worker_login", {
    p_username: normalizeUsername(username),
  });
  if (error) return { ok: false, code: "not_found" };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok !== true || typeof row.email !== "string") {
    return { ok: false, code: "not_found" };
  }
  return {
    ok: true,
    authUserId: String(row.authUserId),
    workerId: String(row.workerId),
    accountId: String(row.accountId),
    email: row.email,
    mustChangePassword: Boolean(row.mustChangePassword),
  };
}

export async function markWorkerLogin(authUserId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.rpc("worker_mark_login", { p_auth_user_id: authUserId });
}

export async function clearWorkerMustChangePassword(
  authUserId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.rpc("worker_clear_must_change_password", {
    p_auth_user_id: authUserId,
  });
}

export async function openWorkerEvaluationSession(workerId: string): Promise<{
  ok: boolean;
  code?: string;
  context?: unknown;
  session?: GeneratedEvaluationSession;
}> {
  const session = generateEvaluationSession();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("open_evaluation_session_for_worker", {
    p_worker_id: workerId,
    p_session_hash: session.sessionHash,
    p_session_expires_at: session.expiresAt.toISOString(),
  });
  if (error) return { ok: false, code: "internal_error" };
  const row = (data ?? {}) as { ok?: boolean; code?: string; context?: unknown };
  if (!row.ok) return { ok: false, code: row.code ?? "no_assignment" };
  return { ok: true, context: row.context, session };
}

export async function getWorkerAccountByAuthUserId(authUserId: string): Promise<{
  worker_id: string;
  must_change_password: boolean;
  is_active: boolean;
} | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("worker_accounts")
    .select("worker_id, must_change_password, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data;
}

export async function setWorkerAccountActive(
  workerId: string,
  active: boolean
): Promise<Record<string, unknown>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_set_worker_account_active", {
    p_worker_id: workerId,
    p_active: active,
  });
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

export async function resetWorkerAccess(workerId: string): Promise<{
  rpc: Record<string, unknown>;
  temporaryPassword: string;
}> {
  const admin = createSupabaseAdminClient();
  const { data: acc, error: accErr } = await admin
    .from("worker_accounts")
    .select("id, auth_user_id")
    .eq("worker_id", workerId)
    .maybeSingle();
  if (accErr || !acc) {
    return { rpc: { ok: false, code: "not_found" }, temporaryPassword: "" };
  }

  const temporaryPassword = `Tmp-${randomBytes(12).toString("base64url")}!9A`;
  const updated = await admin.auth.admin.updateUserById(acc.auth_user_id, {
    password: temporaryPassword,
  });
  if (updated.error) {
    return { rpc: { ok: false, code: "internal_error" }, temporaryPassword: "" };
  }

  const { data, error } = await admin.rpc("admin_reset_worker_access", {
    p_worker_id: workerId,
  });
  if (error) {
    return { rpc: { ok: false, code: "internal_error" }, temporaryPassword: "" };
  }
  return {
    rpc: (data ?? {}) as Record<string, unknown>,
    temporaryPassword,
  };
}
