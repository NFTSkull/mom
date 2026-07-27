import "server-only";

import { createHash, randomUUID } from "node:crypto";

/**
 * Validación estricta de archivos de evidencia (B4.5).
 * Verifica tamaño, MIME declarado, extensión, magic bytes y coherencia
 * MIME/extensión/contenido. Genera nombre seguro, SHA-256 y path server-only.
 * No confía en bucket/path provenientes del navegador.
 */

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

const EXT_BY_MIME: Record<AllowedMime, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

const MAX_FILE_NAME_LENGTH = 180;

export type FileValidationError =
  | "empty_file"
  | "file_too_large"
  | "mime_not_allowed"
  | "extension_not_allowed"
  | "mime_extension_mismatch"
  | "magic_bytes_mismatch"
  | "invalid_file_name"
  | "double_extension"
  | "path_traversal";

export type FileValidationResult =
  | {
      ok: true;
      safeFileName: string;
      originalFileName: string;
      mimeType: AllowedMime;
      sizeBytes: number;
      sha256: string;
    }
  | { ok: false; code: FileValidationError };

function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

/**
 * Verifica magic bytes:
 * - PDF: %PDF-  (25 50 44 46 2D)
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 */
export function matchesMagicBytes(mime: AllowedMime, bytes: Uint8Array): boolean {
  if (mime === "application/pdf") {
    return (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    );
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  // image/png
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < png.length) return false;
  return png.every((b, i) => bytes[i] === b);
}

/** Detecta doble extensión sospechosa (p. ej. reporte.pdf.exe). */
function hasSuspiciousDoubleExtension(name: string): boolean {
  const dangerous = new Set([
    "exe", "js", "mjs", "cjs", "sh", "bat", "cmd", "com", "scr", "html", "htm",
    "svg", "php", "jar", "app", "zip", "rar", "gz", "7z", "dll", "bin",
  ]);
  const parts = name.toLowerCase().split(".");
  if (parts.length < 3) return false;
  // Cualquier segmento intermedio peligroso (no el último, que ya validamos).
  return parts.slice(1, -1).some((p) => dangerous.has(p));
}

function hasControlChars(name: string): boolean {
  // Caracteres de control C0/C1.
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

/** Genera un nombre de archivo seguro conservando extensión válida. */
export function sanitizeFileName(name: string, mime: AllowedMime): string {
  const ext = getExtension(name) || EXT_BY_MIME[mime][0];
  const base = name.slice(0, name.length - (getExtension(name).length ? getExtension(name).length + 1 : 0));
  const cleanedBase = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+|[.\-]+$/g, "")
    .slice(0, 80);
  const safeBase = cleanedBase.length > 0 ? cleanedBase : "evidencia";
  return `${safeBase}.${ext}`.toLowerCase();
}

export function computeSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Genera path server-only: company/evidence/YYYY/MM/<uuid>/<safe-name>.
 * Nunca incluye nombres personales ni títulos de evidencia.
 */
export function buildStoragePath(safeFileName: string, now = new Date()): string {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `company/evidence/${yyyy}/${mm}/${randomUUID()}/${safeFileName}`;
}

export function validateEvidenceFile(input: {
  originalFileName: string;
  declaredMime: string;
  bytes: Uint8Array;
  maxBytes: number;
}): FileValidationResult {
  const name = (input.originalFileName ?? "").trim();
  if (name.length === 0) return { ok: false, code: "invalid_file_name" };
  if (name.length > MAX_FILE_NAME_LENGTH) return { ok: false, code: "invalid_file_name" };
  if (hasControlChars(name)) return { ok: false, code: "invalid_file_name" };
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return { ok: false, code: "path_traversal" };
  }

  if (input.bytes.length === 0) return { ok: false, code: "empty_file" };
  if (input.bytes.length > input.maxBytes) return { ok: false, code: "file_too_large" };

  const mime = input.declaredMime.trim().toLowerCase();
  if (!isAllowedMime(mime)) return { ok: false, code: "mime_not_allowed" };

  if (hasSuspiciousDoubleExtension(name)) return { ok: false, code: "double_extension" };

  const ext = getExtension(name);
  if (!EXT_BY_MIME[mime].includes(ext)) {
    // Sin extensión válida o extensión que no corresponde al MIME declarado.
    if (ext.length === 0) return { ok: false, code: "extension_not_allowed" };
    return { ok: false, code: "mime_extension_mismatch" };
  }

  if (!matchesMagicBytes(mime, input.bytes)) {
    return { ok: false, code: "magic_bytes_mismatch" };
  }

  return {
    ok: true,
    safeFileName: sanitizeFileName(name, mime),
    originalFileName: name,
    mimeType: mime,
    sizeBytes: input.bytes.length,
    sha256: computeSha256(input.bytes),
  };
}
