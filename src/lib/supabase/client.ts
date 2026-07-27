import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv, hasPublicSupabaseConfig } from "@/lib/env";

/**
 * Cliente Supabase para el navegador.
 * Solo usa variables NEXT_PUBLIC_*. Nunca importa secretos.
 */
export function createSupabaseBrowserClient() {
  if (!hasPublicSupabaseConfig()) {
    throw new Error(
      "Supabase público no configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const { url, publishableKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
