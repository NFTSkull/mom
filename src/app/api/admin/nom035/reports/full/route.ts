import { NextRequest, NextResponse } from "next/server";
import {
  adminJsonError,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import { exportNom035FullReportExcel } from "@/lib/nom035/server/full-report-service";
import { FULL_REPORT_FILENAME } from "@/lib/nom035/report-data";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const result = await exportNom035FullReportExcel();
    if (!result.ok) {
      const code =
        result.code === "count_mismatch" ? "invalid_payload" : result.code;
      return adminJsonError(code, requestId);
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${FULL_REPORT_FILENAME}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Report-Completed": String(result.report.counts.realCompleted),
        "X-Report-Generation-Ms": String(result.generationMs),
        "X-Request-Id": requestId,
      },
    });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
