import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEvaluationFlowEnv } from "@/lib/env";

/**
 * Token de evaluación pública.
 * - >= 32 bytes aleatorios con crypto.randomBytes (nunca Math.random).
 * - base64url, con prefijo identificable no sensible.
 * - NO contiene campaignId, workerId ni timestamp.
 * - Se persiste SOLO el HMAC-SHA-256 (con NOM035_TOKEN_PEPPER) y los últimos 4 caracteres.
 * - El token real se devuelve una sola vez al emisor.
 */

export const EVALUATION_TOKEN_PREFIX = "ev_";
const TOKEN_RANDOM_BYTES = 32;
/** Longitud mínima aceptable del token completo (prefijo + base64url de 32 bytes). */
export const EVALUATION_TOKEN_MIN_LENGTH = EVALUATION_TOKEN_PREFIX.length + 40;
export const EVALUATION_TOKEN_MAX_LENGTH = 128;

export interface GeneratedEvaluationToken {
  token: string;
  tokenHash: string;
  tokenLast4: string;
}

export function generateEvaluationToken(): GeneratedEvaluationToken {
  const random = randomBytes(TOKEN_RANDOM_BYTES).toString("base64url");
  const token = `${EVALUATION_TOKEN_PREFIX}${random}`;
  return {
    token,
    tokenHash: hashEvaluationToken(token),
    tokenLast4: token.slice(-4),
  };
}

export function hashEvaluationToken(token: string): string {
  const { tokenPepper } = getEvaluationFlowEnv();
  return createHmac("sha256", tokenPepper).update(token, "utf8").digest("hex");
}

/** Valida forma del token (no revela existencia de assignment). */
export function isWellFormedEvaluationToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < EVALUATION_TOKEN_MIN_LENGTH) return false;
  if (token.length > EVALUATION_TOKEN_MAX_LENGTH) return false;
  if (!token.startsWith(EVALUATION_TOKEN_PREFIX)) return false;
  const body = token.slice(EVALUATION_TOKEN_PREFIX.length);
  return /^[A-Za-z0-9_-]+$/.test(body);
}

/** Comparación en tiempo constante de dos hashes hex. */
export function safeHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
