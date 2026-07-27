import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyPrivacyHeaders } from "@/lib/nom035/server/api-helpers";
import { requireAdminAuth } from "@/lib/nom035/server/require-admin-auth";

export const runtime = "nodejs";

async function jsonError(code: string, message: string, status: number, requestId: string) {
  return applyPrivacyHeaders(
    NextResponse.json({ ok: false, code, message, requestId }, { status })
  );
}

export async function GET() {
  const requestId = crypto.randomUUID();
  const auth = await requireAdminAuth();
  if (!auth.ok) return jsonError(auth.code, "No autenticado.", 401, requestId);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return jsonError("internal_error", "No se pudo consultar MFA.", 500, requestId);
  const totp = (data?.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name,
    status: f.status,
  }));
  return applyPrivacyHeaders(
    NextResponse.json({
      ok: true,
      requestId,
      aal: auth.ctx.aal,
      mfaRequired: auth.ctx.mfaRequired,
      factors: totp,
    })
  );
}
