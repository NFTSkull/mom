/**
 * Cleanup LOCAL exclusivo del sintético WORKER LOGIN TEST.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const COMPANY = "EMPRESA_PRUEBA_LOGIN";
const CAMPAIGN = "CAMPAÑA_LOGIN_PRUEBA";
const WORKER_REF = "TST-0001";
const AUTH_EMAIL = "trabajador.prueba@nom035.test";
const USERNAME = "trabajador.prueba";

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
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url)) {
    throw new Error("ABORT: solo localhost");
  }
  if (/supabase\.co|production|concasa|charolais/i.test(url)) {
    throw new Error("ABORT: remoto prohibido");
  }
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY!;
  assertLocal(url);
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: worker } = await admin
    .from("workers")
    .select("id")
    .eq("external_reference", WORKER_REF)
    .maybeSingle();

  if (worker) {
    const { data: asgs } = await admin
      .from("evaluation_assignments")
      .select("id")
      .eq("worker_id", worker.id);
    const ids = (asgs ?? []).map((a) => a.id);
    if (ids.length) {
      await admin.from("evaluation_answers").delete().in("assignment_id", ids);
      await admin.from("evaluation_results").delete().in("assignment_id", ids);
      await admin.from("evaluation_drafts").delete().in("assignment_id", ids);
      await admin.from("evaluation_sessions").delete().in("assignment_id", ids);
      await admin.from("evaluation_assignments").delete().in("id", ids);
    }
    await admin.from("worker_accounts").delete().eq("worker_id", worker.id);
    await admin.from("workers").delete().eq("id", worker.id);
  }

  await admin.from("worker_accounts").delete().eq("username_normalized", USERNAME);
  await admin.from("evaluation_campaigns").delete().eq("nombre", CAMPAIGN);

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of listed.data.users) {
    if ((u.email || "").toLowerCase() === AUTH_EMAIL) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  const { data: company } = await admin
    .from("company_settings")
    .select("id,razon_social")
    .maybeSingle();
  if (company?.razon_social === COMPANY) {
    await admin.from("company_settings").delete().eq("id", company.id);
  }

  console.log(JSON.stringify({ ok: true, cleaned: true, env: "local" }));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
