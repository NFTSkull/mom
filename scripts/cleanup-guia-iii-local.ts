/**
 * Cleanup LOCAL Guía III sintético. Solo localhost.
 *   npm run guia3:cleanup:local
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const CAMPAIGN = "CAMPAÑA_GUIA_III_TEST";
const REFS = ["WORKER-G3-A", "WORKER-G3-B"];
const EMAILS = ["worker.g3.a@nom035.test", "worker.g3.b@nom035.test"];

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function assertLocal(url: string) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url)) {
    throw new Error("ABORT: solo localhost");
  }
  if (/supabase\.co|production|concasa/i.test(url)) {
    throw new Error("ABORT: host remoto prohibido");
  }
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY!;
  assertLocal(url);
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });

  const { data: camp } = await admin
    .from("evaluation_campaigns")
    .select("id")
    .eq("nombre", CAMPAIGN)
    .maybeSingle();
  if (camp) {
    const { data: asgs } = await admin
      .from("evaluation_assignments")
      .select("id")
      .eq("campaign_id", camp.id);
    for (const a of asgs ?? []) {
      await admin.from("assignment_questionnaires").delete().eq("assignment_id", a.id);
      await admin.from("evaluation_answers").delete().eq("assignment_id", a.id);
      await admin.from("evaluation_results").delete().eq("assignment_id", a.id);
      await admin.from("evaluation_drafts").delete().eq("assignment_id", a.id);
      await admin.from("evaluation_sessions").delete().eq("assignment_id", a.id);
    }
    await admin.from("evaluation_assignments").delete().eq("campaign_id", camp.id);
    await admin.from("evaluation_campaigns").delete().eq("id", camp.id);
  }

  for (const ref of REFS) {
    const { data: w } = await admin
      .from("workers")
      .select("id")
      .eq("external_reference", ref)
      .maybeSingle();
    if (w) {
      await admin.from("worker_accounts").delete().eq("worker_id", w.id);
      await admin.from("workers").delete().eq("id", w.id);
    }
  }

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of listed.data.users) {
    if (EMAILS.includes((u.email || "").toLowerCase())) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  console.log(JSON.stringify({ ok: true, cleaned: true, campaign: CAMPAIGN }));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
