import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import {
  evidenceUploadMetaSchema,
  uploadEvidence,
} from "@/lib/nom035/server/evidence-service";
import { getEvidenceStorageEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return adminJsonError("invalid_content_type", requestId);
    }

    const { maxBytes } = getEvidenceStorageEnv();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return adminJsonError("invalid_payload", requestId);
    // Cota temprana antes de leer el buffer completo.
    if (file.size <= 0) return adminJsonError("empty_file", requestId);
    if (file.size > maxBytes) return adminJsonError("file_too_large", requestId);

    const metaParse = evidenceUploadMetaSchema.safeParse({
      title: form.get("title") ?? undefined,
      evidenceType: form.get("evidenceType") ?? undefined,
      description: form.get("description") ?? undefined,
      campaignId: (form.get("campaignId") as string | null) || undefined,
    });
    if (!metaParse.success) return adminJsonError("invalid_payload", requestId);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadEvidence({
      meta: metaParse.data,
      originalFileName: file.name,
      declaredMime: file.type,
      bytes,
    });
    if (!result.ok) return adminJsonError(result.code, requestId);
    return adminJsonOk({ evidence: result.evidence, requestId }, 201);
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
