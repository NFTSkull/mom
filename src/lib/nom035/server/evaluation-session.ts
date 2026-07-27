import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { getEvaluationFlowEnv } from "@/lib/env";

/**
 * Sesión de evaluación (HttpOnly).
 * - Secreto de sesión independiente del token (>= 32 bytes aleatorios).
 * - Se guarda SOLO el HMAC-SHA-256 (con NOM035_SESSION_PEPPER).
 * - El secreto real viaja únicamente en cookie HttpOnly; nunca en JSON ni logs.
 * - La cookie no contiene assignmentId en claro.
 */

const SESSION_RANDOM_BYTES = 32;
export const EVALUATION_SESSION_PREFIX = "es_";

/** __Host- exige Secure + Path=/ + sin Domain; en dev (http) usamos nombre sin prefijo. */
export const EVALUATION_SESSION_COOKIE_PROD = "__Host-nom035_eval_session";
export const EVALUATION_SESSION_COOKIE_DEV = "nom035_eval_session";

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? EVALUATION_SESSION_COOKIE_PROD
    : EVALUATION_SESSION_COOKIE_DEV;
}

export interface GeneratedEvaluationSession {
  session: string;
  sessionHash: string;
  expiresAt: Date;
}

export function generateEvaluationSession(): GeneratedEvaluationSession {
  const { sessionMinutes } = getEvaluationFlowEnv();
  const session = `${EVALUATION_SESSION_PREFIX}${randomBytes(SESSION_RANDOM_BYTES).toString(
    "base64url"
  )}`;
  const expiresAt = new Date(Date.now() + sessionMinutes * 60_000);
  return { session, sessionHash: hashEvaluationSession(session), expiresAt };
}

export function hashEvaluationSession(session: string): string {
  const { sessionPepper } = getEvaluationFlowEnv();
  return createHmac("sha256", sessionPepper).update(session, "utf8").digest("hex");
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "strict";
  secure: boolean;
  path: string;
  maxAge: number;
}

export function buildSessionCookieOptions(expiresAt: Date): SessionCookieOptions {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function buildClearedSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
