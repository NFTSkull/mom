import { NextRequest, NextResponse } from "next/server";
import {
  adminJsonError,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import { getNom035ExecutiveAggregate } from "@/lib/nom035/server/full-report-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const result = await getNom035ExecutiveAggregate();
    if (!result.ok) {
      const code =
        result.code === "count_mismatch" ? "invalid_payload" : result.code;
      return adminJsonError(code, requestId);
    }

    return NextResponse.json(
      {
        ok: true,
        aggregate: result.aggregate,
        generationMs: result.generationMs,
        requestId,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Request-Id": requestId,
        },
      }
    );
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
