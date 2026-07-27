import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyPrivacyHeaders, readJsonBody } from "@/lib/nom035/server/api-helpers";
import { requireAal2 } from "@/lib/nom035/server/require-aal2";

export const runtime = "nodejs";

const schema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z
      .string()
      .min(12)
      .max(200)
      .refine(
        (pw) =>
          /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw),
        { message: "weak_password" }
      ),
  })
  .strict();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const auth = await requireAal2();
  if (!auth.ok) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: auth.code,
          message: "Se requiere autenticación reforzada.",
          requestId,
        },
        { status: auth.code === "unauthorized" ? 401 : 403 }
      )
    );
  }

  const body = await readJsonBody(req);
  if (!body.ok) {
    return applyPrivacyHeaders(
      NextResponse.json(
        { ok: false, code: body.code, message: "Solicitud inválida.", requestId },
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
          message:
            "La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.",
          requestId,
        },
        { status: 400 }
      )
    );
  }

  const supabase = await createSupabaseServerClient();
  // Reautenticación con contraseña actual
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: auth.ctx.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: "invalid_credentials",
          message: "La contraseña actual no es correcta.",
          requestId,
        },
        { status: 401 }
      )
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: "update_failed",
          message: "No se pudo cambiar la contraseña.",
          requestId,
        },
        { status: 400 }
      )
    );
  }
  return applyPrivacyHeaders(NextResponse.json({ ok: true, requestId }));
}
