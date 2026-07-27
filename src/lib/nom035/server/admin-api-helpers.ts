import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  assertAdminAccess,
  type AdminAccessDenialReason,
} from "@/lib/nom035/server/admin-access-guard";
import {
  applyPrivacyHeaders,
  MAX_BODY_BYTES,
  readJsonBody,
} from "@/lib/nom035/server/api-helpers";
import type { AppPermission } from "@/lib/nom035/auth/permissions";
import { findEndpointPermission } from "@/lib/nom035/auth/endpoint-permissions";
import type { AdminAuthContext } from "@/lib/nom035/server/auth-context";
import { requirePermission } from "@/lib/nom035/server/require-permission";

export { MAX_BODY_BYTES, readJsonBody };

export type AdminApiErrorBody = {
  ok: false;
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string>;
};

const ADMIN_CODE_MAP: Record<string, { status: number; message: string }> = {
  backend_disabled: { status: 403, message: "Acceso administrativo no disponible." },
  origin_missing: { status: 403, message: "Origen no permitido." },
  origin_rejected: { status: 403, message: "Origen no permitido." },
  unauthorized: { status: 401, message: "Autenticación requerida." },
  profile_missing: { status: 403, message: "Acceso no autorizado." },
  account_disabled: { status: 403, message: "Cuenta deshabilitada." },
  forbidden: { status: 403, message: "No tiene permiso para esta operación." },
  aal2_required: {
    status: 403,
    message: "Se requiere verificación en dos pasos para continuar.",
  },
  mfa_required: {
    status: 403,
    message: "Se requiere verificación en dos pasos para continuar.",
  },
  mfa_enrollment_required: {
    status: 403,
    message: "Debe configurar la verificación en dos pasos.",
  },
  last_admin_protected: {
    status: 409,
    message: "No se puede modificar al último administrador activo.",
  },
  not_found: { status: 404, message: "Recurso no encontrado." },
  invalid_payload: { status: 400, message: "Los datos enviados no son válidos." },
  invalid_content_type: { status: 400, message: "Formato de solicitud no soportado." },
  invalid_json: { status: 400, message: "Solicitud malformada." },
  body_too_large: { status: 413, message: "La solicitud es demasiado grande." },
  razon_social_required: { status: 400, message: "La razón social es obligatoria." },
  total_trabajadores_invalid: { status: 400, message: "El total de trabajadores no es válido." },
  email_invalid: { status: 400, message: "El correo no es válido." },
  nombre_required: { status: 400, message: "El nombre es obligatorio." },
  duplicate_email: { status: 409, message: "Ya existe un trabajador con ese correo." },
  duplicate_external_reference: {
    status: 409,
    message: "Ya existe un trabajador con esa referencia externa.",
  },
  has_history: {
    status: 409,
    message: "No se puede eliminar: tiene historial. Desactive el trabajador.",
  },
  invalid_mode: { status: 400, message: "Modo de importación inválido." },
  batch_too_large: { status: 400, message: "El lote excede el máximo permitido." },
  validation_failed: { status: 400, message: "La validación del lote falló." },
  invalid_dates: { status: 400, message: "Las fechas de la campaña no son válidas." },
  campaign_closed: { status: 409, message: "La campaña está cerrada." },
  invalid_status: { status: 409, message: "Estado no permitido para esta operación." },
  invalid_campaign: { status: 400, message: "La campaña no es válida." },
  another_active_exists: {
    status: 409,
    message: "Ya existe una campaña activa. Ciérrela antes de activar otra.",
  },
  campaign_unavailable: { status: 409, message: "La campaña no está disponible." },
  worker_inactive: { status: 409, message: "El trabajador no está activo." },
  duplicate_assignment: { status: 409, message: "Ya existe una asignación para este trabajador." },
  invalid_expiration: { status: 400, message: "La expiración del enlace no es válida." },
  invalid_token_hash: { status: 400, message: "Solicitud inválida." },
  invalid_token_last4: { status: 400, message: "Solicitud inválida." },
  inconsistent_result: { status: 409, message: "El resultado no es consistente." },
  invalid_transition: { status: 409, message: "La transición de estado no está permitida." },
  duplicate_version_label: { status: 409, message: "Ya existe una versión con esa etiqueta." },
  policy_not_editable: { status: 409, message: "Una política publicada no se edita directamente." },
  https_required: { status: 400, message: "El enlace debe usar HTTPS." },
  empty_file: { status: 400, message: "El archivo está vacío." },
  file_too_large: { status: 413, message: "El archivo excede el tamaño permitido." },
  mime_not_allowed: { status: 400, message: "Solo se permiten PDF, JPEG o PNG." },
  extension_not_allowed: { status: 400, message: "La extensión del archivo no está permitida." },
  mime_extension_mismatch: {
    status: 400,
    message: "El tipo y la extensión del archivo no coinciden.",
  },
  magic_bytes_mismatch: {
    status: 400,
    message: "El contenido del archivo no corresponde al tipo declarado.",
  },
  invalid_file_name: { status: 400, message: "El nombre del archivo no es válido." },
  double_extension: { status: 400, message: "El nombre del archivo no está permitido." },
  path_traversal: { status: 400, message: "El nombre del archivo no está permitido." },
  storage_upload_failed: {
    status: 502,
    message: "No se pudo almacenar el archivo. Intenta de nuevo.",
  },
  signed_url_failed: {
    status: 502,
    message: "No se pudo generar la descarga. Intenta de nuevo.",
  },
  orphan_cleanup_failed: {
    status: 502,
    message: "Ocurrió un error al procesar el archivo. Intenta de nuevo.",
  },
  not_downloadable: { status: 409, message: "Esta evidencia no admite descarga." },
  no_storage_object: { status: 409, message: "La evidencia no tiene archivo asociado." },
  internal_error: { status: 500, message: "Ocurrió un error. Intenta de nuevo." },
};

export function newAdminRequestId(): string {
  return randomUUID();
}

export function adminJsonOk(data: Record<string, unknown>, status = 200): NextResponse {
  const res = NextResponse.json({ ok: true, ...data }, { status });
  return applyPrivacyHeaders(res);
}

export function adminJsonError(
  code: string,
  requestId: string,
  fieldErrors?: Record<string, string>
): NextResponse {
  const mapped = ADMIN_CODE_MAP[code] ?? ADMIN_CODE_MAP.internal_error;
  const body: AdminApiErrorBody = {
    ok: false,
    code,
    message: mapped.message,
    requestId,
  };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    body.fieldErrors = fieldErrors;
  }
  const res = NextResponse.json(body, { status: mapped.status });
  return applyPrivacyHeaders(res);
}

export function denyFromGuard(
  reason: AdminAccessDenialReason,
  requestId: string
): NextResponse {
  return adminJsonError(reason, requestId);
}

/**
 * Guard preliminar de modo + Origin (sin Auth).
 * Preferir requireAdminApiAuth en handlers.
 */
export function requireAdminAccess(req: Request): {
  requestId: string;
  denied: NextResponse | null;
} {
  const requestId = newAdminRequestId();
  const decision = assertAdminAccess(req);
  if (!decision.allowed) {
    return { requestId, denied: denyFromGuard(decision.reason, requestId) };
  }
  return { requestId, denied: null };
}

/**
 * Auth + permiso (+ AAL2/sensitive según manifiesto o overrides).
 */
export async function requireAdminApiAuth(
  req: Request,
  permission?: AppPermission,
  opts?: { sensitive?: boolean; aal2?: boolean }
): Promise<{
  requestId: string;
  ctx: AdminAuthContext | null;
  denied: NextResponse | null;
}> {
  const { requestId, denied } = requireAdminAccess(req);
  if (denied) return { requestId, ctx: null, denied };

  let resolvedPermission = permission;
  if (!resolvedPermission) {
    try {
      const url = new URL(req.url);
      const rule = findEndpointPermission(req.method, url.pathname);
      if (!rule) {
        return {
          requestId,
          ctx: null,
          denied: adminJsonError("forbidden", requestId),
        };
      }
      resolvedPermission = rule.permission;
    } catch {
      return {
        requestId,
        ctx: null,
        denied: adminJsonError("internal_error", requestId),
      };
    }
  }

  const result = await requirePermission(resolvedPermission);
  if (!result.ok) {
    return {
      requestId,
      ctx: null,
      denied: adminJsonError(result.code, requestId),
    };
  }

  if (opts?.aal2 && result.ctx.aal !== "aal2") {
    return {
      requestId,
      ctx: null,
      denied: adminJsonError("aal2_required", requestId),
    };
  }
  if (opts?.sensitive && !result.ctx.canViewSensitiveCases) {
    return {
      requestId,
      ctx: null,
      denied: adminJsonError("forbidden", requestId),
    };
  }

  return { requestId, ctx: result.ctx, denied: null };
}

/** Interpreta resultado RPC jsonb con ok/code. */
export function unwrapRpc(
  data: unknown,
  requestId: string
): { ok: true; value: Record<string, unknown> } | { ok: false; response: NextResponse } {
  if (!data || typeof data !== "object") {
    return { ok: false, response: adminJsonError("internal_error", requestId) };
  }
  const record = data as Record<string, unknown>;
  if (record.ok === false) {
    const code = typeof record.code === "string" ? record.code : "internal_error";
    return { ok: false, response: adminJsonError(code, requestId) };
  }
  return { ok: true, value: record };
}

/** Mapea errores Postgres P0001 (require_admin_permission) a códigos API. */
export function mapRpcThrownError(error: unknown, requestId: string): NextResponse {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  for (const code of [
    "unauthorized",
    "forbidden",
    "aal2_required",
    "account_disabled",
    "profile_missing",
    "last_admin_protected",
  ] as const) {
    if (message.includes(code)) {
      return adminJsonError(code, requestId);
    }
  }
  return adminJsonError("internal_error", requestId);
}
