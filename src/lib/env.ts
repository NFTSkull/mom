/**
 * Validación de variables de entorno por contexto.
 * - Públicas: seguras para exponer en cliente (URL + publishable key).
 * - Privadas: solo servidor (secret key + token pepper).
 *
 * No lanza errores al importar este módulo.
 * Las funciones get* fallan con mensajes claros sin incluir valores de secretos.
 */

export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
  appUrl: string;
};

export type PrivateSupabaseEnv = {
  secretKey: string;
  tokenPepper: string;
};

export type EvaluationFlowEnv = {
  backend: "supabase" | "local";
  tokenPepper: string;
  sessionPepper: string;
  rateLimitPepper: string;
  sessionMinutes: number;
};

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable de entorno requerida ausente o vacía: ${name}. Configúrala en el entorno del servidor (nunca en el cliente).`
    );
  }
  return value;
}

/** Variables públicas. No exige secretos. */
export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL", readOptional("NEXT_PUBLIC_SUPABASE_URL")),
    publishableKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      readOptional("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    ),
    appUrl: readOptional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  };
}

/**
 * Indica si hay configuración pública mínima para clientes browser/server cookie.
 * No implica modo local: en producción estas variables son obligatorias.
 */
export function hasPublicSupabaseConfig(): boolean {
  return Boolean(
    readOptional("NEXT_PUBLIC_SUPABASE_URL") &&
      readOptional("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}

/**
 * Runtime de producción en Vercel (no Preview/local).
 * Usar para ocultar avisos/herramientas solo de desarrollo.
 */
export function isVercelProduction(): boolean {
  return readOptional("VERCEL_ENV") === "production";
}

/** Secretos de servidor. Solo llamar desde código server-only. */
export function getPrivateSupabaseEnv(): PrivateSupabaseEnv {
  return {
    secretKey: requireEnv("SUPABASE_SECRET_KEY", readOptional("SUPABASE_SECRET_KEY")),
    tokenPepper: requireEnv("NOM035_TOKEN_PEPPER", readOptional("NOM035_TOKEN_PEPPER")),
  };
}

export function hasPrivateSupabaseConfig(): boolean {
  return Boolean(readOptional("SUPABASE_SECRET_KEY") && readOptional("NOM035_TOKEN_PEPPER"));
}

/**
 * Variables del flujo de evaluación pública. Solo server-only.
 * Falla de forma segura si falta una variable privada necesaria, sin revelar su valor.
 */
export function getEvaluationFlowEnv(): EvaluationFlowEnv {
  const backendRaw = readOptional("NOM035_PUBLIC_EVALUATION_BACKEND") ?? "local";
  if (backendRaw !== "supabase" && backendRaw !== "local") {
    throw new Error(
      "NOM035_PUBLIC_EVALUATION_BACKEND inválido: use 'supabase' o 'local'."
    );
  }

  const minutesRaw = readOptional("NOM035_EVALUATION_SESSION_MINUTES");
  const sessionMinutes = minutesRaw ? Number.parseInt(minutesRaw, 10) : NaN;
  if (!Number.isInteger(sessionMinutes) || sessionMinutes <= 0 || sessionMinutes > 24 * 60) {
    throw new Error(
      "NOM035_EVALUATION_SESSION_MINUTES debe ser un entero de minutos entre 1 y 1440."
    );
  }

  return {
    backend: backendRaw,
    tokenPepper: requireEnv("NOM035_TOKEN_PEPPER", readOptional("NOM035_TOKEN_PEPPER")),
    sessionPepper: requireEnv("NOM035_SESSION_PEPPER", readOptional("NOM035_SESSION_PEPPER")),
    rateLimitPepper: requireEnv(
      "NOM035_RATE_LIMIT_PEPPER",
      readOptional("NOM035_RATE_LIMIT_PEPPER")
    ),
    sessionMinutes,
  };
}

/** True si el backend de evaluación pública está configurado como Supabase. */
export function isSupabaseEvaluationBackend(): boolean {
  return readOptional("NOM035_PUBLIC_EVALUATION_BACKEND") === "supabase";
}

export type PublicComplaintEnv = {
  backend: "supabase" | "local";
  rateLimitMax: number;
  rateLimitWindowMinutes: number;
  rateLimitPepper: string;
};

/**
 * Config de la queja pública confidencial (B4.5). Solo server-only.
 * Valida rangos de rate limit sin exponer valores privados en los mensajes.
 */
export function getPublicComplaintEnv(): PublicComplaintEnv {
  const backendRaw = readOptional("NOM035_PUBLIC_COMPLAINT_BACKEND") ?? "local";
  if (backendRaw !== "supabase" && backendRaw !== "local") {
    throw new Error("NOM035_PUBLIC_COMPLAINT_BACKEND inválido: use 'supabase' o 'local'.");
  }

  const maxRaw = readOptional("NOM035_COMPLAINT_RATE_LIMIT_MAX");
  const rateLimitMax = maxRaw ? Number.parseInt(maxRaw, 10) : 5;
  if (!Number.isInteger(rateLimitMax) || rateLimitMax < 1 || rateLimitMax > 1000) {
    throw new Error("NOM035_COMPLAINT_RATE_LIMIT_MAX debe ser un entero entre 1 y 1000.");
  }

  const windowRaw = readOptional("NOM035_COMPLAINT_RATE_LIMIT_WINDOW_MINUTES");
  const rateLimitWindowMinutes = windowRaw ? Number.parseInt(windowRaw, 10) : 60;
  if (
    !Number.isInteger(rateLimitWindowMinutes) ||
    rateLimitWindowMinutes < 1 ||
    rateLimitWindowMinutes > 24 * 60
  ) {
    throw new Error(
      "NOM035_COMPLAINT_RATE_LIMIT_WINDOW_MINUTES debe ser un entero de minutos entre 1 y 1440."
    );
  }

  return {
    backend: backendRaw,
    rateLimitMax,
    rateLimitWindowMinutes,
    rateLimitPepper: requireEnv(
      "NOM035_RATE_LIMIT_PEPPER",
      readOptional("NOM035_RATE_LIMIT_PEPPER")
    ),
  };
}

export function isSupabaseComplaintBackend(): boolean {
  return readOptional("NOM035_PUBLIC_COMPLAINT_BACKEND") === "supabase";
}

export type EvidenceStorageEnv = {
  bucket: string;
  maxBytes: number;
  signedDownloadSeconds: number;
};

const EVIDENCE_MIN_BYTES = 1_048_576; // 1 MB
const EVIDENCE_MAX_BYTES = 15_728_640; // 15 MB
const SIGNED_MIN_SECONDS = 30;
const SIGNED_MAX_SECONDS = 300;

/**
 * Config de evidencias/Storage privado (B4.5). Solo server-only.
 * Aplica límites duros: tamaño 1..15 MB, URL firmada 30..300 s.
 */
export function getEvidenceStorageEnv(): EvidenceStorageEnv {
  const bucket = readOptional("NOM035_EVIDENCE_BUCKET") ?? "nom035-evidence";

  const maxRaw = readOptional("NOM035_EVIDENCE_MAX_BYTES");
  const maxBytes = maxRaw ? Number.parseInt(maxRaw, 10) : EVIDENCE_MAX_BYTES;
  if (
    !Number.isInteger(maxBytes) ||
    maxBytes < EVIDENCE_MIN_BYTES ||
    maxBytes > EVIDENCE_MAX_BYTES
  ) {
    throw new Error(
      "NOM035_EVIDENCE_MAX_BYTES debe ser un entero de bytes entre 1 MB (1048576) y 15 MB (15728640)."
    );
  }

  const signedRaw = readOptional("NOM035_SIGNED_DOWNLOAD_SECONDS");
  const signedDownloadSeconds = signedRaw ? Number.parseInt(signedRaw, 10) : 120;
  if (
    !Number.isInteger(signedDownloadSeconds) ||
    signedDownloadSeconds < SIGNED_MIN_SECONDS ||
    signedDownloadSeconds > SIGNED_MAX_SECONDS
  ) {
    throw new Error(
      "NOM035_SIGNED_DOWNLOAD_SECONDS debe ser un entero de segundos entre 30 y 300."
    );
  }

  return { bucket, maxBytes, signedDownloadSeconds };
}

export type AdminBackendEnv = {
  backendMode: "auth_rbac" | "disabled";
  allowedOriginsRaw: string | undefined;
};

/**
 * Config del panel administrativo. Solo server-only.
 * B4.6: el modo válido es `auth_rbac`. Cualquier otro valor falla cerrado.
 */
export function getAdminBackendEnv(): AdminBackendEnv {
  const raw = readOptional("NOM035_ADMIN_BACKEND_MODE");
  return {
    backendMode: raw === "auth_rbac" ? "auth_rbac" : "disabled",
    allowedOriginsRaw: readOptional("NOM035_ADMIN_ALLOWED_ORIGINS"),
  };
}

export function isLocalAdminBackendEnabled(): boolean {
  return getAdminBackendEnv().backendMode === "auth_rbac";
}

/**
 * Config completa para admin/service role.
 * Falla si falta cualquier variable requerida para operaciones privilegiadas.
 */
export function getSupabaseAdminEnv(): PublicSupabaseEnv & PrivateSupabaseEnv {
  return {
    ...getPublicSupabaseEnv(),
    ...getPrivateSupabaseEnv(),
  };
}
