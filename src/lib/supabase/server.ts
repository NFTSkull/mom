import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv, hasPublicSupabaseConfig } from "@/lib/env";

/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Usa cookies de Next.js App Router. No crea Auth todavía.
 * Solo variables públicas (URL + publishable key).
 */
export async function createSupabaseServerClient() {
  if (!hasPublicSupabaseConfig()) {
    throw new Error(
      "Supabase público no configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const { url, publishableKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // En Server Components el set puede fallar; es aceptable en lectura.
        }
      },
    },
  });
}
