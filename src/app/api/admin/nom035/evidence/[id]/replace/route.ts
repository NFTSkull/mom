import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import { replaceEvidence } from "@/lib/nom035/server/evidence-service";
import { getEvidenceStorageEnv } from "@/lib/env";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) {
      return adminJsonError("invalid_payload", requestId);
    }
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return adminJsonError("invalid_content_type", requestId);
    }

    const { maxBytes } = getEvidenceStorageEnv();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return adminJsonError("invalid_payload", requestId);
    if (file.size <= 0) return adminJsonError("empty_file", requestId);
    if (file.size > maxBytes) return adminJsonError("file_too_large", requestId);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await replaceEvidence({
      oldId: id,
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
