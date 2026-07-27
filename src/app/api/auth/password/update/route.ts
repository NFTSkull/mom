import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyPrivacyHeaders, readJsonBody } from "@/lib/nom035/server/api-helpers";

export const runtime = "nodejs";

const schema = z
  .object({
    password: z
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
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return applyPrivacyHeaders(
      NextResponse.json(
        {
          ok: false,
          code: "update_failed",
          message: "No se pudo actualizar la contraseña.",
          requestId,
        },
        { status: 400 }
      )
    );
  }
  return applyPrivacyHeaders(NextResponse.json({ ok: true, requestId }));
}
