import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import { createEvidenceDownload } from "@/lib/nom035/server/evidence-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) {
      return adminJsonError("invalid_payload", requestId);
    }
    const result = await createEvidenceDownload(id);
    if (!result.ok) return adminJsonError(result.code, requestId);

    // Redirección temporal a la URL firmada (nunca se persiste).
    const res = NextResponse.redirect(result.url, 302);
    res.headers.set("Cache-Control", "no-store, max-age=0");
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set(
      "Content-Disposition",
      `attachment; filename="${result.fileName.replace(/["\\]/g, "")}"`
    );
    return res;
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
