import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PreparedSubmission } from "./public-evaluation-service";

/**
 * Wrappers server-only sobre las funciones SQL atómicas. Toda autoridad
 * (worker/campaign/scores) vive en la base; aquí solo se pasan hashes y payloads
 * ya validados. Nunca se aceptan hashes calculados por el navegador.
 */

export interface RpcOutcome {
  ok: boolean;
  code?: string;
  context?: unknown;
  [key: string]: unknown;
}

function normalize(data: unknown, error: { message: string } | null): RpcOutcome {
  if (error) return { ok: false, code: "internal_error" };
  const row = (data ?? {}) as RpcOutcome;
  return row;
}

export async function exchangeToken(params: {
  tokenHash: string;
  sessionHash: string;
  sessionExpiresAt: Date;
}): Promise<RpcOutcome> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("exchange_evaluation_token", {
    p_token_hash: params.tokenHash,
    p_session_hash: params.sessionHash,
    p_session_expires_at: params.sessionExpiresAt.toISOString(),
  });
  return normalize(data, error);
}

export async function getSessionContext(sessionHash: string): Promise<RpcOutcome> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_evaluation_session_context", {
    p_session_hash: sessionHash,
  });
  return normalize(data, error);
}

export async function startEvaluation(sessionHash: string): Promise<RpcOutcome> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("start_public_evaluation", {
    p_session_hash: sessionHash,
  });
  return normalize(data, error);
}

export async function saveDraft(params: {
  sessionHash: string;
  payload: Record<string, unknown>;
  expectedUpdatedAt?: string | null;
}): Promise<RpcOutcome> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("save_public_evaluation_draft", {
    p_session_hash: params.sessionHash,
    p_payload: params.payload,
    p_expected_updated_at: params.expectedUpdatedAt ?? null,
  });
  return normalize(data, error);
}

export async function submitEvaluation(params: {
  sessionHash: string;
  submissionId: string;
  prepared: PreparedSubmission;
}): Promise<RpcOutcome> {
  const admin = createSupabaseAdminClient();
  const { prepared } = params;
  const { data, error } = await admin.rpc("submit_public_evaluation", {
    p_session_hash: params.sessionHash,
    p_submission_id: params.submissionId,
    p_answers: prepared.answers,
    p_result: prepared.result,
    p_questionnaire_version: prepared.questionnaireVersion,
    p_scoring_version: prepared.scoringVersion,
    p_calculated_at: prepared.calculatedAt,
  });
  return normalize(data, error);
}
