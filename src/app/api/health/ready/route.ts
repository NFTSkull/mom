import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Readiness: comprueba acceso mínimo a Auth/DB sin revelar detalle interno.
 * No expone nombres de tablas, URLs internas, keys ni SQL.
 */
export async function GET() {
  const requestId = crypto.randomUUID();
  const headers = {
    "Cache-Control": "no-store, max-age=0",
    "X-Request-Id": requestId,
  };

  try {
    const supabase = await createSupabaseServerClient();
    // Llamada mínima: getClaims no requiere sesión y valida conectividad Auth.
    const { error } = await supabase.auth.getClaims();
    // Ausencia de sesión es válida; fallo de red/config no.
    if (error && /fetch|network|invalid api key|failed to fetch/i.test(error.message)) {
      return NextResponse.json(
        { ok: false, status: "not_ready", requestId },
        { status: 503, headers }
      );
    }
    return NextResponse.json(
      { ok: true, status: "ready", requestId },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      { ok: false, status: "not_ready", requestId },
      { status: 503, headers }
    );
  }
}
