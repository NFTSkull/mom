import { NextRequest, NextResponse } from "next/server";
import {
  adminJsonError,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import { exportNom035AvanceExcel } from "@/lib/nom035/server/avance-excel-service";
import { AVANCE_EXCEL_FILENAME } from "@/lib/nom035/avance-excel";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const result = await exportNom035AvanceExcel();
    if (!result.ok) {
      const code =
        result.code === "count_mismatch" ? "invalid_payload" : result.code;
      return adminJsonError(code, requestId);
    }

    const res = new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${AVANCE_EXCEL_FILENAME}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Avance-Total": String(result.total),
        "X-Avance-Si": String(result.si),
        "X-Avance-No": String(result.no),
        "X-Request-Id": requestId,
      },
    });
    return res;
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
