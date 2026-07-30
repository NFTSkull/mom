import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/env";
import {
  applyPrivacyHeaders,
  readJsonBody,
} from "@/lib/nom035/server/api-helpers";
import {
  clearWorkerMustChangePassword,
  isWorkerAppMetadata,
} from "@/lib/nom035/server/worker-portal-service";

export const runtime = "nodejs";

const schema = z
  .object({
    password: z
      .string()
      .min(10)
      .max(200)
      .regex(/[A-Z]/, "Mayúscula requerida")
      .regex(/[a-z]/, "Minúscula requerida")
      .regex(/[0-9]/, "Número requerido")
      .regex(/[^A-Za-z0-9]/, "Símbolo requerido"),
  })
  .strict();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const body = await readJsonBody(req);
  if (!body.ok) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: "invalid_payload", message: "Solicitud inválida.", requestId },
        { status: 400 }
      )
    );
  }
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: "weak_password",
          message: "La contraseña no cumple la política de fortaleza.",
          requestId,
        },
        { status: 400 }
      )
    );
  }

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

  const updated = await supabase.auth.updateUser({ password: parsed.data.password });
  if (updated.error) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: "update_failed", message: "No se pudo actualizar.", requestId },
        { status: 400 }
      )
    );
  }

  await clearWorkerMustChangePassword(userData.user.id);
  return applyPrivacyHeaders(NextResponse.json({ ok: true, requestId }));
}
