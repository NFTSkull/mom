/**
 * Cleanup de usuarios sintéticos @nom035.staging.local únicamente.
 * Se niega a correr fuera de staging. No toca usuarios no sintéticos.
 */
import { createClient } from "@supabase/supabase-js";
import { unlinkSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SYNTH_SUFFIX = "@nom035.staging.local";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.staging.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  } catch {
    // optional
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta configuración staging");

  const refFile = resolve(".tmp/staging-project-ref.txt");
  if (!existsSync(refFile)) throw new Error("Falta staging-project-ref.txt");
  const expectedRef = readFileSync(refFile, "utf8").trim();
  const host = new URL(url).hostname;
  const ref = host.split(".")[0] ?? "";
  if (ref !== expectedRef) throw new Error("URL no corresponde a staging verificado");

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
    (u.email ?? "").toLowerCase().endsWith(SYNTH_SUFFIX)
  );

  for (const u of targets) {
    await admin.from("admin_profiles").delete().eq("id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }

  const cred = resolve(".tmp/staging-auth-credentials.json");
  if (existsSync(cred)) unlinkSync(cred);

  console.log(`Cleanup staging OK: eliminados ${targets.length} usuarios sintéticos`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "cleanup staging failed");
  process.exit(1);
});
