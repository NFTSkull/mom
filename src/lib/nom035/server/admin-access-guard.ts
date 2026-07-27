import "server-only";

/**
 * Guard de origen / modo backend para endpoints administrativos (B4.6).
 *
 * Ya no limita a localhost ni bloquea producción por NODE_ENV:
 * la autorización real es Auth + RBAC + AAL2.
 * Origin sigue validándose en mutaciones.
 */

export type AdminAccessDenialReason =
  | "backend_disabled"
  | "origin_missing"
  | "origin_rejected";

export type AdminAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: AdminAccessDenialReason };

export type AdminAccessInput = {
  method: string;
  hostname: string;
  origin: string | null;
  backendMode?: string | null;
  allowedOrigins?: string[];
};

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Parsea lista CSV de orígenes permitidos. */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      try {
        return new URL(part).origin;
      } catch {
        return part;
      }
    });
}

export function getAdminBackendMode(): string | null {
  return readOptional("NOM035_ADMIN_BACKEND_MODE") ?? null;
}

export function getAdminAllowedOrigins(): string[] {
  const fromEnv = parseAllowedOrigins(readOptional("NOM035_ADMIN_ALLOWED_ORIGINS"));
  if (fromEnv.length > 0) return fromEnv;
  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}

/**
 * Extrae hostname del request sin confiar en X-Forwarded-Host.
 */
export function extractRequestHostname(req: Request): string {
  const hostHeader = req.headers.get("host");
  if (hostHeader) {
    const withoutPort = hostHeader.split(",")[0]?.trim() ?? "";
    const hostname = withoutPort.includes("]")
      ? withoutPort.slice(1, withoutPort.indexOf("]"))
      : withoutPort.split(":")[0] ?? "";
    return hostname.toLowerCase();
  }
  try {
    return new URL(req.url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") {
    return true;
  }
  if (normalized === "0:0:0:0:0:0:0:1") return true;
  return false;
}

function isMutationMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

/**
 * Decisión preliminar de modo backend + Origin.
 * No sustituye requirePermission / requireAdminAuth.
 */
export function evaluateAdminAccess(input: AdminAccessInput): AdminAccessDecision {
  const backendMode = input.backendMode ?? getAdminBackendMode();
  const allowedOrigins = input.allowedOrigins ?? getAdminAllowedOrigins();

  if (backendMode !== "auth_rbac") {
    return { allowed: false, reason: "backend_disabled" };
  }

  if (isMutationMethod(input.method)) {
    if (!input.origin) {
      return { allowed: false, reason: "origin_missing" };
    }
    let originNormalized: string;
    try {
      originNormalized = new URL(input.origin).origin;
    } catch {
      return { allowed: false, reason: "origin_rejected" };
    }
    if (!allowedOrigins.includes(originNormalized)) {
      return { allowed: false, reason: "origin_rejected" };
    }
  }

  return { allowed: true };
}

export function assertAdminAccess(req: Request): AdminAccessDecision {
  return evaluateAdminAccess({
    method: req.method,
    hostname: extractRequestHostname(req),
    origin: req.headers.get("origin"),
  });
}
