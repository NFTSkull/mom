import { NextRequest, NextResponse } from "next/server";
import {
  adminJsonError,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import { exportNom035IndividualReportExcel } from "@/lib/nom035/server/individual-report-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const result = await exportNom035IndividualReportExcel(id);
    if (!result.ok) {
      return adminJsonError(result.code, requestId);
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Report-Generation-Ms": String(result.generationMs),
        "X-Request-Id": requestId,
      },
    });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
