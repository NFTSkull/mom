import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Callback PKCE / confirmación de correo (recuperación).
 * Valida redirect local; no expone tokens en la URL final.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/restablecer-contrasena";
  const next = nextRaw.startsWith("/") ? nextRaw : "/restablecer-contrasena";

  if (code) {
    const { url, publishableKey } = getPublicSupabaseEnv();
    const cookieStore = await cookies();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, origin));
}
