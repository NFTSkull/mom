/**
 * Limpieza EXPLÍCITA de residuos sintéticos de staging en el proyecto
 * promovido a nom035-production (mismo ref agbl…kubf).
 *
 * Requiere: CONFIRM_PRODUCTION_CLEANUP=YES
 * No hace DELETE global. No toca ConCasa. No imprime PII/secretos.
 *
 * Uso:
 *   CONFIRM_PRODUCTION_CLEANUP=YES npx tsx scripts/production-cleanup-staging-residues.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const EXPECTED_REF_PREFIX = "agbl";
const EXPECTED_REF_SUFFIX = "kubf";
const EXPECTED_NAME = "nom035-production";
const MARK = "STAGING_TEST";
const LOCAL_MARK = "LOCAL_IMPORT_TEST_83";
const SYNTH_EMAIL_SUFFIX = "@nom035.staging.local";

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

function loadEnv(): Record<string, string> {
  return {
    ...loadEnvFile(".env.staging.local"),
    ...loadEnvFile(".env.production.local"),
    ...(process.env as Record<string, string>),
  };
}

function assertProductionTarget(url: string): string {
  if (process.env.CONFIRM_PRODUCTION_CLEANUP !== "YES") {
    throw new Error("ABORT: falta CONFIRM_PRODUCTION_CLEANUP=YES");
  }
  if (/localhost|127\.0\.0\.1/i.test(url)) throw new Error("ABORT: localhost");
  if (/concasa|charolais/i.test(url)) throw new Error("ABORT: proyecto ajeno");
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  if (!ref.startsWith(EXPECTED_REF_PREFIX) || !ref.endsWith(EXPECTED_REF_SUFFIX)) {
    throw new Error("ABORT: project ref no autorizado");
  }

  const token = execFileSync(
    "security",
    ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
    { encoding: "utf8" }
  ).trim();
  const projects = JSON.parse(
    execFileSync(
      "curl",
      [
        "-sS",
        "-A",
        "Mozilla/5.0",
        "-H",
        `Authorization: Bearer ${token}`,
        "https://api.supabase.com/v1/projects",
      ],
      { encoding: "utf8" }
    )
  ) as Array<{ id: string; name: string }>;
  const me = projects.find((p) => p.id === ref);
  if (!me || me.name !== EXPECTED_NAME) {
    throw new Error(`ABORT: nombre remoto no es ${EXPECTED_NAME}`);
  }
  return ref;
}

function adminClient(url: string, secret: string): SupabaseClient {
  class NoopRealtimeTransport {}
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopRealtimeTransport as never },
  } as never);
}

async function idsByIlike(
  admin: SupabaseClient,
  table: string,
  col: string,
  pattern: string
): Promise<string[]> {
  const { data, error } = await admin.from(table).select("id").ilike(col, pattern);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta URL/secret");
  const ref = assertProductionTarget(url);
  const admin = adminClient(url, secret);

  const summary: Record<string, number> = {};

  const campaignIds = [
    ...(await idsByIlike(admin, "evaluation_campaigns", "nombre", `${MARK}%`)),
    ...(await idsByIlike(admin, "evaluation_campaigns", "nombre", `${LOCAL_MARK}%`)),
  ];
  const workerIds = [
    ...(await idsByIlike(admin, "workers", "nombre", `${MARK}%`)),
    ...(await idsByIlike(admin, "workers", "nombre", `${LOCAL_MARK}%`)),
    ...(await idsByIlike(admin, "workers", "sucursal", `${LOCAL_MARK}%`)),
  ];
  const uniqueCampaigns = [...new Set(campaignIds)];
  const uniqueWorkers = [...new Set(workerIds)];

  // Assignments → answers/results/sessions cascade or explicit
  if (uniqueCampaigns.length) {
    const { data: asg } = await admin
      .from("evaluation_assignments")
      .select("id")
      .in("campaign_id", uniqueCampaigns);
    const asgIds = (asg ?? []).map((a) => a.id as string);
    if (asgIds.length) {
      await admin.from("evaluation_answers").delete().in("assignment_id", asgIds);
      await admin.from("evaluation_results").delete().in("assignment_id", asgIds);
      // optional session table
      try {
        await admin.from("evaluation_sessions").delete().in("assignment_id", asgIds);
      } catch {
        // table may differ
      }
      const delAsg = await admin.from("evaluation_assignments").delete().in("id", asgIds);
      if (delAsg.error) throw new Error(delAsg.error.message);
      summary.assignments = asgIds.length;
    }
    const delCamp = await admin.from("evaluation_campaigns").delete().in("id", uniqueCampaigns);
    if (delCamp.error) throw new Error(delCamp.error.message);
    summary.campaigns = uniqueCampaigns.length;
  }

  // Remaining assignments pointing to synthetic workers
  if (uniqueWorkers.length) {
    const { data: asgW } = await admin
      .from("evaluation_assignments")
      .select("id")
      .in("worker_id", uniqueWorkers);
    const asgIds = (asgW ?? []).map((a) => a.id as string);
    if (asgIds.length) {
      await admin.from("evaluation_answers").delete().in("assignment_id", asgIds);
      await admin.from("evaluation_results").delete().in("assignment_id", asgIds);
      await admin.from("evaluation_assignments").delete().in("id", asgIds);
      summary.assignmentsWorker = asgIds.length;
    }
    // results by worker
    await admin.from("evaluation_results").delete().in("worker_id", uniqueWorkers);
    const delW = await admin.from("workers").delete().in("id", uniqueWorkers);
    if (delW.error) throw new Error(`workers: ${delW.error.message}`);
    summary.workers = uniqueWorkers.length;
  }

  // Other STAGING_TEST rows
  for (const [table, col] of [
    ["confidential_complaints", "description"],
    ["policy_documents", "title"],
    ["action_plans", "description"],
    ["evidence_items", "title"],
  ] as const) {
    const { data, error } = await admin.from(table).delete().ilike(col, `${MARK}%`).select("id");
    if (error) throw new Error(`${table}: ${error.message}`);
    summary[table] = data?.length ?? 0;
  }

  // Synthetic company singleton
  const { data: company } = await admin
    .from("company_settings")
    .select("id,razon_social")
    .maybeSingle();
  if (company && /STAGING_TEST|LOCAL_IMPORT|NOM035_LOCAL|ACME Servicios/i.test(company.razon_social)) {
    const delC = await admin.from("company_settings").delete().eq("id", company.id);
    if (delC.error) throw new Error(`company: ${delC.error.message}`);
    summary.companySynthetic = 1;
  }

  // Auth synthetic
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targets = (listed.data.users ?? []).filter((u) =>
    (u.email ?? "").toLowerCase().endsWith(SYNTH_EMAIL_SUFFIX)
  );
  for (const u of targets) {
    await admin.from("admin_profiles").delete().eq("id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
  summary.authSynthetic = targets.length;

  // Rate limits (all ephemeral; safe to clear)
  const { data: rl } = await admin.from("public_rate_limits").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
  summary.rateLimits = rl?.length ?? 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        refSanitized: `${ref.slice(0, 4)}…${ref.slice(-4)}`,
        expectedName: EXPECTED_NAME,
        deleted: summary,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
