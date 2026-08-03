/**
 * Guardas obligatorias B4.12.1 para herramientas productivas.
 * Nunca imprime secrets ni Project ref completo.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PRODUCTION_LOGICAL_NAME = "nom035-production";
export const EXPECTED_REF_PREFIX = "agbl";
export const EXPECTED_REF_SUFFIX = "kubf";
export const FORBIDDEN_REF_PREFIX = "fvtq";
/** Único valor aceptado para habilitar mutaciones piloto. */
export const ALLOW_PRODUCTION_PILOT_VALUE = "B412_PILOT_ONLY";

const GENERIC_CONFIRMATIONS = new Set([
  "true",
  "TRUE",
  "yes",
  "YES",
  "1",
  "ok",
  "OK",
  "confirm",
  "CONFIRM",
]);

function secretsDir(): string {
  return resolve(process.env.HOME ?? "", "Desktop/nom035-production-secrets");
}

export function sanitizeRef(ref: string): string {
  if (ref.length < 8) return "???";
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`;
}

export function extractProjectRefFromUrl(url: string): string {
  if (!url) throw new Error("ABORT: URL vacía");
  if (/localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error("ABORT: localhost rechazado en modo Production");
  }
  if (/concasa|charolais/i.test(url)) {
    throw new Error("ABORT: ConCasa / proyecto ajeno");
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("ABORT: URL inválida");
  }
  if (!host.endsWith(".supabase.co")) {
    throw new Error("ABORT: URL debe terminar en .supabase.co");
  }
  return host.split(".")[0] ?? "";
}

export function resolveExpectedProjectRef(
  env: Record<string, string | undefined> = process.env
): string {
  const fromEnv = (env.EXPECTED_SUPABASE_PROJECT_REF ?? "").trim();
  if (fromEnv) return fromEnv;
  const p = resolve(secretsDir(), "project_ref.txt");
  if (!existsSync(p)) {
    throw new Error("ABORT: falta EXPECTED_SUPABASE_PROJECT_REF (o project_ref off-repo)");
  }
  return readFileSync(p, "utf8").trim();
}

export function assertRefsMatch(opts: {
  urlRef: string;
  expected: string;
  confirmed: string;
}): void {
  const { urlRef, expected, confirmed } = opts;
  if (GENERIC_CONFIRMATIONS.has(confirmed)) {
    throw new Error("ABORT: confirmación genérica rechazada");
  }
  if (!expected || expected.length < 8) {
    throw new Error("ABORT: EXPECTED_SUPABASE_PROJECT_REF inválido");
  }
  if (!confirmed || confirmed.length < 8) {
    throw new Error("ABORT: CONFIRM_SUPABASE_PROJECT_REF ausente o inválido");
  }
  if (confirmed !== expected) {
    throw new Error("ABORT: CONFIRM_SUPABASE_PROJECT_REF ≠ EXPECTED");
  }
  if (urlRef !== expected) {
    throw new Error("ABORT: project ref de URL ≠ EXPECTED");
  }
  if (urlRef.startsWith(FORBIDDEN_REF_PREFIX) || expected.startsWith(FORBIDDEN_REF_PREFIX)) {
    throw new Error("ABORT: ref ConCasa prohibido");
  }
  if (
    !urlRef.startsWith(EXPECTED_REF_PREFIX) ||
    !urlRef.endsWith(EXPECTED_REF_SUFFIX)
  ) {
    throw new Error("ABORT: project ref no autorizado");
  }
}

export function assertAllowProductionPilot(
  env: Record<string, string | undefined> = process.env
): void {
  const allow = (env.ALLOW_PRODUCTION_PILOT ?? "").trim();
  if (!allow) {
    throw new Error("ABORT: falta ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY");
  }
  if (GENERIC_CONFIRMATIONS.has(allow) || allow !== ALLOW_PRODUCTION_PILOT_VALUE) {
    throw new Error("ABORT: ALLOW_PRODUCTION_PILOT debe ser exactamente B412_PILOT_ONLY");
  }
}

/**
 * Identidad productiva para mutaciones/piloto.
 * Requiere ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY + refs coincidentes.
 */
export function assertProductionPilotGuards(opts: {
  url: string;
  env?: Record<string, string | undefined>;
}): { ref: string; sanitized: string } {
  const env = opts.env ?? process.env;
  assertAllowProductionPilot(env);

  const target = (env.NOM035_TARGET_ENV ?? env.NODE_ENV ?? "").trim();
  if (target && target !== "production") {
    throw new Error("ABORT: entorno lógico debe ser production");
  }
  if (env.VERCEL_ENV === "preview") {
    throw new Error("ABORT: Preview rechazado cuando se espera Production");
  }

  const urlRef = extractProjectRefFromUrl(opts.url);
  const expected = resolveExpectedProjectRef(env);
  const confirmed = (env.CONFIRM_SUPABASE_PROJECT_REF ?? "").trim();
  assertRefsMatch({ urlRef, expected, confirmed });

  const nameFile = resolve(secretsDir(), "project_name.txt");
  if (existsSync(nameFile)) {
    const name = readFileSync(nameFile, "utf8").trim();
    if (name !== PRODUCTION_LOGICAL_NAME) {
      throw new Error(`ABORT: nombre lógico inválido`);
    }
  }

  return { ref: urlRef, sanitized: sanitizeRef(urlRef) };
}

/** @deprecated Usar assertProductionPilotGuards — se mantiene para compat tests mínimos. */
export function assertProductionIdentity(opts: {
  url: string;
  confirmEnvVar: string;
  requireConfirmValue?: string;
  allowPreview?: boolean;
  env?: Record<string, string | undefined>;
}): { ref: string; sanitized: string } {
  const env = { ...(opts.env ?? process.env) } as Record<string, string | undefined>;
  // Mapear confirmaciones antiguas YES → exigir nuevo allow + refs
  if (env.ALLOW_PRODUCTION_PILOT !== ALLOW_PRODUCTION_PILOT_VALUE) {
    throw new Error("ABORT: falta ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY");
  }
  return assertProductionPilotGuards({ url: opts.url, env });
}

export function loadProductionEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env.staging.local", ".env.production.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2]!.trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) out[m[1]!] = v;
    }
  }
  const pepperMap: Record<string, string> = {
    NOM035_TOKEN_PEPPER: "token_pepper.txt",
    NOM035_SESSION_PEPPER: "session_pepper.txt",
    NOM035_RATE_LIMIT_PEPPER: "rate_limit_pepper.txt",
  };
  for (const [envName, fileName] of Object.entries(pepperMap)) {
    const p = resolve(secretsDir(), fileName);
    if (existsSync(p)) {
      const v = readFileSync(p, "utf8").trim();
      if (v) out[envName] = v;
    }
  }
  const merged = { ...out };
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== "string" || !v.trim()) continue;
    if (
      k.startsWith("CONFIRM_") ||
      k.startsWith("EXPECTED_") ||
      k.startsWith("ALLOW_") ||
      k === "SUPABASE_DB_PASSWORD" ||
      k === "NOM035_TARGET_ENV" ||
      k === "NODE_ENV" ||
      k === "B412_PILOT_DRY_RUN" ||
      k === "WORKERS_CSV"
    ) {
      merged[k] = v;
    }
  }
  if (
    !merged.NEXT_PUBLIC_APP_URL ||
    /mom-git-|vercel\.app\/.*preview/i.test(merged.NEXT_PUBLIC_APP_URL)
  ) {
    merged.NEXT_PUBLIC_APP_URL = "https://nom035-production.vercel.app";
  }
  delete merged.STAGING_PROJECT_NAME;
  return merged;
}
