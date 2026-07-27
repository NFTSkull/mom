import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEvidenceStorageEnv } from "@/lib/env";
import {
  buildStoragePath,
  validateEvidenceFile,
  type FileValidationError,
} from "@/lib/nom035/server/evidence-file-validator";
import {
  createSignedDownloadUrl,
  getEvidenceBucket,
  removeEvidenceObject,
  uploadEvidenceObject,
} from "@/lib/nom035/server/evidence-storage-service";

/**
 * Servicio de evidencias central (B4.5).
 * Orquesta validación de archivo + Storage privado + metadata en DB con
 * compensación (Storage y DB NO son una transacción única).
 * Nunca persiste URL firmada ni acepta bucket/path del navegador.
 */

export const EVIDENCE_TYPES = [
  "politica",
  "difusion",
  "resultados",
  "reporte",
  "capacitacion",
  "plan_accion",
  "quejas",
  "canalizacion",
  "otro",
] as const;

const optionalText = z
  .string()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

export const evidenceListSchema = z
  .object({
    evidenceType: z.enum(EVIDENCE_TYPES).optional().nullable(),
    search: z.string().max(200).optional().nullable(),
    state: z.enum(["active", "deleted", "all"]).optional().default("active"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const evidenceExternalSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    evidenceType: z.enum(EVIDENCE_TYPES),
    description: z.string().max(2000).optional().default(""),
    campaignId: z.string().uuid().optional().nullable(),
    externalUrl: z
      .string()
      .trim()
      .url()
      .max(2000)
      .refine((v) => v.toLowerCase().startsWith("https://"), { message: "https_required" }),
  })
  .strict();

export const evidenceUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    evidenceType: z.enum(EVIDENCE_TYPES).optional(),
    description: optionalText,
    notes: optionalText,
  })
  .strict();

export const evidenceUploadMetaSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    evidenceType: z.enum(EVIDENCE_TYPES),
    description: z.string().max(2000).optional().default(""),
    campaignId: z.string().uuid().optional().nullable(),
  })
  .strict();

type ServiceResult = Record<string, unknown>;

async function rpcClient() {
  return createSupabaseServerClient();
}

export async function listEvidence(input: z.infer<typeof evidenceListSchema>): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_list_evidence", {
    p_evidence_type: input.evidenceType ?? null,
    p_search: input.search ?? null,
    p_state: input.state,
    p_page: input.page,
    p_page_size: input.pageSize,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function getEvidenceDetail(id: string): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_get_evidence_detail", { p_id: id });
  if (error) throw error;
  return data as ServiceResult;
}

export async function getEvidenceSummary(): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_evidence_summary");
  if (error) throw error;
  return data as ServiceResult;
}

export async function createExternalEvidence(
  input: z.infer<typeof evidenceExternalSchema>
): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_create_evidence_metadata", {
    p_evidence_source: "external",
    p_title: input.title,
    p_evidence_type: input.evidenceType,
    p_description: input.description ?? "",
    p_campaign_id: input.campaignId ?? null,
    p_storage_bucket: null,
    p_storage_path: null,
    p_external_url: input.externalUrl,
    p_original_file_name: null,
    p_safe_file_name: null,
    p_mime_type: null,
    p_size_bytes: null,
    p_sha256: null,
    p_notes: null,
  });
  if (error) throw error;
  return data as ServiceResult;
}

export async function updateEvidence(
  id: string,
  input: z.infer<typeof evidenceUpdateSchema>
): Promise<ServiceResult> {
  const { data, error } = await (await rpcClient()).rpc("admin_update_evidence_metadata", {
    p_id: id,
    p_title: input.title ?? null,
    p_evidence_type: input.evidenceType ?? null,
    p_description: input.description ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as ServiceResult;
}

/**
 * Carga con compensación:
 * 1) valida archivo, 2) sube al bucket privado, 3) inserta metadata,
 * 4) si metadata falla, elimina el objeto subido,
 * 5) si la limpieza falla, devuelve error seguro (no deja huérfano silencioso).
 */
export async function uploadEvidence(input: {
  meta: z.infer<typeof evidenceUploadMetaSchema>;
  originalFileName: string;
  declaredMime: string;
  bytes: Uint8Array;
}): Promise<
  | { ok: true; evidence: Record<string, unknown> }
  | { ok: false; code: FileValidationError | string }
> {
  const { maxBytes } = getEvidenceStorageEnv();
  const validation = validateEvidenceFile({
    originalFileName: input.originalFileName,
    declaredMime: input.declaredMime,
    bytes: input.bytes,
    maxBytes,
  });
  if (!validation.ok) return { ok: false, code: validation.code };

  const bucket = getEvidenceBucket();
  const path = buildStoragePath(validation.safeFileName);

  const uploaded = await uploadEvidenceObject({
    path,
    bytes: input.bytes,
    contentType: validation.mimeType,
  });
  if (!uploaded.ok) return { ok: false, code: uploaded.code };

  const { data, error } = await (await rpcClient()).rpc("admin_create_evidence_metadata", {
    p_evidence_source: "upload",
    p_title: input.meta.title,
    p_evidence_type: input.meta.evidenceType,
    p_description: input.meta.description ?? "",
    p_campaign_id: input.meta.campaignId ?? null,
    p_storage_bucket: bucket,
    p_storage_path: path,
    p_external_url: null,
    p_original_file_name: validation.originalFileName,
    p_safe_file_name: validation.safeFileName,
    p_mime_type: validation.mimeType,
    p_size_bytes: validation.sizeBytes,
    p_sha256: validation.sha256,
    p_notes: null,
  });

  const failedMeta = Boolean(error) || (data && (data as Record<string, unknown>).ok === false);
  if (failedMeta) {
    const cleanup = await removeEvidenceObject(path);
    if (!cleanup.ok) {
      return { ok: false, code: "orphan_cleanup_failed" };
    }
    if (error) throw error;
    const code =
      data && typeof (data as Record<string, unknown>).code === "string"
        ? ((data as Record<string, unknown>).code as string)
        : "internal_error";
    return { ok: false, code };
  }

  const record = data as Record<string, unknown>;
  return { ok: true, evidence: (record.evidence as Record<string, unknown>) ?? record };
}

/**
 * Reemplazo versionado con compensación:
 * sube el archivo nuevo (path nuevo), crea nueva versión (supersedes/replaced_by),
 * conserva el archivo anterior. Si falla la DB, limpia el archivo nuevo.
 */
export async function replaceEvidence(input: {
  oldId: string;
  originalFileName: string;
  declaredMime: string;
  bytes: Uint8Array;
}): Promise<
  | { ok: true; evidence: Record<string, unknown> }
  | { ok: false; code: FileValidationError | string }
> {
  const { maxBytes } = getEvidenceStorageEnv();
  const validation = validateEvidenceFile({
    originalFileName: input.originalFileName,
    declaredMime: input.declaredMime,
    bytes: input.bytes,
    maxBytes,
  });
  if (!validation.ok) return { ok: false, code: validation.code };

  const bucket = getEvidenceBucket();
  const path = buildStoragePath(validation.safeFileName);

  const uploaded = await uploadEvidenceObject({
    path,
    bytes: input.bytes,
    contentType: validation.mimeType,
  });
  if (!uploaded.ok) return { ok: false, code: uploaded.code };

  const { data, error } = await (await rpcClient()).rpc("admin_replace_evidence_metadata", {
    p_old_id: input.oldId,
    p_storage_bucket: bucket,
    p_storage_path: path,
    p_original_file_name: validation.originalFileName,
    p_safe_file_name: validation.safeFileName,
    p_mime_type: validation.mimeType,
    p_size_bytes: validation.sizeBytes,
    p_sha256: validation.sha256,
  });

  const failedMeta = Boolean(error) || (data && (data as Record<string, unknown>).ok === false);
  if (failedMeta) {
    const cleanup = await removeEvidenceObject(path);
    if (!cleanup.ok) {
      return { ok: false, code: "orphan_cleanup_failed" };
    }
    if (error) throw error;
    const code =
      data && typeof (data as Record<string, unknown>).code === "string"
        ? ((data as Record<string, unknown>).code as string)
        : "internal_error";
    return { ok: false, code };
  }

  const record = data as Record<string, unknown>;
  return { ok: true, evidence: (record.evidence as Record<string, unknown>) ?? record };
}

/**
 * Eliminación (soft delete) con intento de limpieza en Storage:
 * 1) marca deleted_at (RPC), 2) intenta borrar el objeto,
 * 3) si borra, marca storage_delete_pending=false, 4) si falla, queda pendiente.
 */
export async function deleteEvidence(id: string): Promise<
  { ok: true; evidence: Record<string, unknown>; cleanupPending: boolean } | { ok: false; code: string }
> {
  const detail = await getEvidenceDetail(id);
  if (detail.ok === false) {
    return { ok: false, code: (detail.code as string) ?? "not_found" };
  }
  const evidenceNode = (detail.evidence as Record<string, unknown>) ?? {};
  const source = evidenceNode.evidenceSource as string | undefined;
  const storagePath = evidenceNode.storagePath as string | undefined;

  const { data, error } = await (await rpcClient()).rpc("admin_soft_delete_evidence", { p_id: id });
  if (error) throw error;
  const softResult = data as Record<string, unknown>;
  if (softResult.ok === false) {
    return { ok: false, code: (softResult.code as string) ?? "internal_error" };
  }

  if (source !== "upload" || !storagePath) {
    return { ok: true, evidence: (softResult.evidence as Record<string, unknown>) ?? softResult, cleanupPending: false };
  }

  const cleanup = await removeEvidenceObject(storagePath);
  if (cleanup.ok) {
    const { data: markData, error: markErr } = await (await rpcClient()).rpc(
      "admin_mark_evidence_storage_deleted",
      { p_id: id }
    );
    if (markErr) throw markErr;
    return {
      ok: true,
      evidence: (markData as Record<string, unknown>)?.evidence as Record<string, unknown>,
      cleanupPending: false,
    };
  }

  const { data: pendData, error: pendErr } = await (await rpcClient()).rpc(
    "admin_mark_evidence_cleanup_pending",
    { p_id: id }
  );
  if (pendErr) throw pendErr;
  return {
    ok: true,
    evidence: (pendData as Record<string, unknown>)?.evidence as Record<string, unknown>,
    cleanupPending: true,
  };
}

/** Reintento de limpieza para evidencias con storage_delete_pending. */
export async function retryEvidenceCleanup(id: string): Promise<
  { ok: true; cleanupPending: boolean } | { ok: false; code: string }
> {
  const detail = await getEvidenceDetail(id);
  if (detail.ok === false) return { ok: false, code: (detail.code as string) ?? "not_found" };
  const evidenceNode = (detail.evidence as Record<string, unknown>) ?? {};
  const storagePath = evidenceNode.storagePath as string | undefined;
  if (!storagePath) return { ok: false, code: "no_storage_object" };

  const cleanup = await removeEvidenceObject(storagePath);
  if (!cleanup.ok) return { ok: true, cleanupPending: true };

  const { data, error } = await (await rpcClient()).rpc("admin_mark_evidence_storage_deleted", {
    p_id: id,
  });
  if (error) throw error;
  const result = data as Record<string, unknown>;
  if (result.ok === false) return { ok: false, code: (result.code as string) ?? "internal_error" };
  return { ok: true, cleanupPending: false };
}

/**
 * Genera una descarga firmada temporal y registra evidence.downloaded sin URL.
 * Solo para evidencias tipo upload activas.
 */
export async function createEvidenceDownload(id: string): Promise<
  { ok: true; url: string; expiresIn: number; fileName: string } | { ok: false; code: string }
> {
  const detail = await getEvidenceDetail(id);
  if (detail.ok === false) return { ok: false, code: (detail.code as string) ?? "not_found" };
  const evidenceNode = (detail.evidence as Record<string, unknown>) ?? {};
  const source = evidenceNode.evidenceSource as string | undefined;
  const storagePath = evidenceNode.storagePath as string | undefined;
  const deletedAt = evidenceNode.deletedAt as string | null | undefined;
  const safeName = (evidenceNode.safeFileName as string | undefined) ?? "evidencia";

  if (source !== "upload" || !storagePath) return { ok: false, code: "not_downloadable" };
  if (deletedAt) return { ok: false, code: "not_found" };

  const signed = await createSignedDownloadUrl({ path: storagePath, downloadName: safeName });
  if (!signed.ok) return { ok: false, code: signed.code };

  await (await rpcClient())
    .from("audit_log")
    .insert({
      action: "evidence.downloaded",
      entity_type: "evidence",
      entity_id: id,
      metadata: { evidenceType: evidenceNode.evidenceType ?? null },
    });

  return { ok: true, url: signed.url, expiresIn: signed.expiresIn, fileName: safeName };
}
