import { NextResponse } from "next/server";
import { applyPrivacyHeaders } from "@/lib/nom035/server/api-helpers";
import { getAdminAuthContext } from "@/lib/nom035/server/require-admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const requestId = crypto.randomUUID();
  const auth = await getAdminAuthContext();
  if (!auth.ok) {
    const res = NextResponse.json(
      { ok: false, code: auth.code, message: "No autenticado.", requestId },
      { status: auth.code === "unauthorized" ? 401 : 403 }
    );
    return applyPrivacyHeaders(res);
  }
  const res = NextResponse.json({
    ok: true,
    requestId,
    user: {
      id: auth.ctx.userId,
      email: auth.ctx.email,
      nombre: auth.ctx.nombre,
      role: auth.ctx.role,
      permissions: auth.ctx.permissions,
      canViewSensitiveCases: auth.ctx.canViewSensitiveCases,
      mfaRequired: auth.ctx.mfaRequired,
      aal: auth.ctx.aal,
      mustChangePassword: auth.ctx.mustChangePassword,
    },
  });
  return applyPrivacyHeaders(res);
}
