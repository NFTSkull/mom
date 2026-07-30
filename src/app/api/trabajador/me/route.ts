import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/env";
import { applyPrivacyHeaders } from "@/lib/nom035/server/api-helpers";
import { isWorkerAppMetadata } from "@/lib/nom035/server/worker-portal-service";

export const runtime = "nodejs";

export async function GET() {
  const requestId = crypto.randomUUID();
  const { url, publishableKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const c of items) cookieStore.set(c.name, c.value, c.options);
      },
    },
  });

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user || !isWorkerAppMetadata(userData.user.app_metadata)) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: "unauthorized", message: "Sesión requerida.", requestId },
        { status: 401 }
      )
    );
  }

  const { data, error: rpcErr } = await supabase.rpc("worker_get_portal_state");
  if (rpcErr) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: "internal_error", message: "No se pudo cargar el portal.", requestId },
        { status: 500 }
      )
    );
  }

  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok !== true) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: (row.code as string) ?? "unauthorized",
          message: "No autorizado.",
          requestId,
        },
        { status: 403 }
      )
    );
  }

  return applyPrivacyHeaders(NextResponse.json({ ...row, requestId }));
}
