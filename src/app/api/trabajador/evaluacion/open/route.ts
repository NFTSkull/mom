import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/env";
import { applyPrivacyHeaders } from "@/lib/nom035/server/api-helpers";
import {
  buildSessionCookieOptions,
  getSessionCookieName,
} from "@/lib/nom035/server/evaluation-session";
import {
  getWorkerAccountByAuthUserId,
  isWorkerAppMetadata,
  openWorkerEvaluationSession,
} from "@/lib/nom035/server/worker-portal-service";

export const runtime = "nodejs";

export async function POST() {
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

  const acc = await getWorkerAccountByAuthUserId(userData.user.id);
  if (!acc || !acc.is_active) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: "account_disabled", message: "Cuenta no disponible.", requestId },
        { status: 403 }
      )
    );
  }
  if (acc.must_change_password) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: "must_change_password",
          message: "Debe cambiar la contraseña.",
          requestId,
        },
        { status: 403 }
      )
    );
  }

  const opened = await openWorkerEvaluationSession(acc.worker_id);
  if (!opened.ok || !opened.session) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: opened.code ?? "no_assignment",
          message: "No hay evaluación activa.",
          requestId,
        },
        { status: 409 }
      )
    );
  }

  const res = NextResponse.json({
    ok: true,
    context: opened.context,
    redirectTo: "/evaluacion/contestar",
    requestId,
  });
  res.cookies.set({
    name: getSessionCookieName(),
    value: opened.session.session,
    ...buildSessionCookieOptions(opened.session.expiresAt),
  });
  return applyPrivacyHeaders(res);
}
