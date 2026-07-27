import "server-only";

import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";

/**
 * Transport inerte para realtime-js en runtimes sin WebSocket global (Node 20).
 * NUNCA se instancia: este cliente no usa realtime, solo .rpc()/.from().
 * Evita añadir la dependencia "ws" solo para satisfacer una comprobación.
 */
class NoopRealtimeTransport {}

/**
 * Cliente privilegiado (service/secret key).
 * SOLO para Route Handlers / jobs de servidor.
 * Nunca importar desde componentes cliente ni páginas "use client".
 */
export function createSupabaseAdminClient() {
  const { url, secretKey } = getSupabaseAdminEnv();

  const options: SupabaseClientOptions<"public"> = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };

  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: NoopRealtimeTransport as never };
  }

  return createClient(url, secretKey, options);
}
