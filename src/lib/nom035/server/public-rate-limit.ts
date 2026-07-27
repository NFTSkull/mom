import "server-only";

import { createHmac } from "node:crypto";
import { getEvaluationFlowEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting server-only. La clave (p.ej. IP) se guarda SOLO como HMAC
 * (con NOM035_RATE_LIMIT_PEPPER); nunca IP/token/user-agent en claro.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export function hashRateLimitKey(rawKey: string): string {
  const { rateLimitPepper } = getEvaluationFlowEnv();
  return createHmac("sha256", rateLimitPepper).update(rawKey, "utf8").digest("hex");
}

export async function consumeRateLimit(params: {
  rawKey: string;
  action: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("consume_public_rate_limit", {
    p_key_hash: hashRateLimitKey(params.rawKey),
    p_action: params.action,
    p_limit: params.limit,
    p_window_seconds: params.windowSeconds,
  });

  if (error) {
    // Fail-closed: si el rate limit no puede evaluarse, no permitir.
    return { allowed: false, remaining: 0, retryAfter: params.windowSeconds };
  }

  const row = (data ?? {}) as {
    allowed?: boolean;
    remaining?: number;
    retryAfter?: number;
  };
  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    retryAfter: Number(row.retryAfter ?? 0),
  };
}
