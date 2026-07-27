/**
 * Elimina únicamente usuarios de prueba @nom035.local.
 * Se niega a correr contra remoto.
 * Usa SQL local para el último admin (el trigger de protección lo bloquearía).
 */
import { createClient } from "@supabase/supabase-js";
import { unlinkSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  } catch {
    // ignore
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function localSql(sql: string): string {
  return execFileSync(
    "psql",
    ["postgresql://postgres:postgres@127.0.0.1:55322/postgres", "-At", "-c", sql],
    { encoding: "utf8" }
  ).trim();
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta configuración Supabase local");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url)) {
    throw new Error("auth:cleanup:test solo contra Supabase local");
  }

  class NoopRealtimeTransport {}
  const options: {
    auth: object;
    realtime?: { transport: new () => unknown };
  } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: NoopRealtimeTransport as never };
  }
  const admin = createClient(url, secret, options as never);

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targets = listed.data.users.filter((u) =>
    (u.email ?? "").toLowerCase().endsWith("@nom035.local")
  );

  // Desactivar trigger solo en cleanup local sintético (último admin).
  localSql("alter table public.admin_profiles disable trigger trg_protect_last_admin");
  try {
    localSql("delete from public.admin_profiles where email like '%@nom035.local'");
    for (const u of targets) {
      await admin.auth.admin.deleteUser(u.id);
    }
    // Por si quedó algún usuario Auth sin listar
    const leftover = localSql(
      "select id from auth.users where email like '%@nom035.local'"
    );
    if (leftover) {
      for (const id of leftover.split("\n").filter(Boolean)) {
        await admin.auth.admin.deleteUser(id);
      }
    }
  } finally {
    localSql("alter table public.admin_profiles enable trigger trg_protect_last_admin");
  }

  const credFile = resolve(".tmp/auth-test-credentials.json");
  if (existsSync(credFile)) unlinkSync(credFile);

  console.log(`Cleanup OK: eliminados ${targets.length} usuarios @nom035.local`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "cleanup failed");
  process.exit(1);
});
