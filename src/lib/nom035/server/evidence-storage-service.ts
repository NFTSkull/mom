import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEvidenceStorageEnv } from "@/lib/env";

/**
 * Acceso al bucket privado de evidencias (B4.5).
 * Solo server-only. Nunca se expone al navegador ni se persiste la URL firmada.
 * El bucket, path y firma se controlan exclusivamente en el servidor.
 */

export function getEvidenceBucket(): string {
  return getEvidenceStorageEnv().bucket;
}

/** Sube un objeto al bucket privado. No sobrescribe (upsert=false). */
export async function uploadEvidenceObject(input: {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const bucket = getEvidenceBucket();
  const { error } = await createSupabaseAdminClient()
    .storage.from(bucket)
    .upload(input.path, input.bytes, {
      contentType: input.contentType,
      upsert: false,
      cacheControl: "no-store",
    });
  if (error) {
    return { ok: false, code: "storage_upload_failed" };
  }
  return { ok: true };
}

/** Elimina un objeto del bucket. Idempotente a nivel de negocio. */
export async function removeEvidenceObject(
  path: string
): Promise<{ ok: true } | { ok: false; code: string }> {
  const bucket = getEvidenceBucket();
  const { error } = await createSupabaseAdminClient().storage.from(bucket).remove([path]);
  if (error) {
    return { ok: false, code: "storage_delete_failed" };
  }
  return { ok: true };
}

/**
 * Genera una URL firmada temporal para descarga. La duración se acota por env
 * (30..300 s). Nunca se guarda en DB ni en audit_log.
 */
export async function createSignedDownloadUrl(input: {
  path: string;
  downloadName: string;
}): Promise<{ ok: true; url: string; expiresIn: number } | { ok: false; code: string }> {
  const { bucket, signedDownloadSeconds } = getEvidenceStorageEnv();
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(bucket)
    .createSignedUrl(input.path, signedDownloadSeconds, {
      download: input.downloadName,
    });
  if (error || !data?.signedUrl) {
    return { ok: false, code: "signed_url_failed" };
  }
  return { ok: true, url: data.signedUrl, expiresIn: signedDownloadSeconds };
}
