/**
 * Cleanup idempotente de fixtures STAGING_TEST en nom035-staging.
 * No toca migraciones ni estructura. No imprime secretos.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_NAME = "nom035-staging";
const MARK = "STAGING_TEST";

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

function assertStaging(url: string, expectedRef: string) {
  const host = new URL(url).hostname;
  const ref = host.split(".")[0] ?? "";
  if (ref !== expectedRef) throw new Error("project ref no coincide");
  if (/prod|production|concasa/i.test(url)) throw new Error("proyecto prohibido");
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta .env.staging.local");
  const refFile = resolve(".tmp/staging-project-ref.txt");
  if (!existsSync(refFile)) throw new Error("Falta staging-project-ref");
  assertStaging(url, readFileSync(refFile, "utf8").trim());
  if (env.STAGING_PROJECT_NAME && env.STAGING_PROJECT_NAME !== EXPECTED_NAME) {
    throw new Error("STAGING_PROJECT_NAME inválido");
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: class {} as never },
  } as never);

  const fixturesPath = resolve(".tmp/staging-fixtures.json");
  let campaignId: string | null = null;
  let storagePath: string | null = null;
  if (existsSync(fixturesPath)) {
    const fx = JSON.parse(readFileSync(fixturesPath, "utf8")) as {
      campaignId?: string;
      evidence?: { path?: string };
    };
    campaignId = fx.campaignId ?? null;
    storagePath = fx.evidence?.path ?? null;
  }

  // Storage
  if (storagePath) {
    await admin.storage.from("nom035-evidence").remove([storagePath]);
  }
  const listed = await admin.storage.from("nom035-evidence").list(`staging/${MARK.toLowerCase()}`);
  if (listed.data?.length) {
    await admin.storage
      .from("nom035-evidence")
      .remove(listed.data.map((f) => `staging/${MARK.toLowerCase()}/${f.name}`));
  }

  // Quejas / políticas / planes / evidencias / assignments / campañas / workers marcados
  await admin.from("confidential_complaints").delete().ilike("description", `${MARK}%`);
  await admin.from("policy_documents").delete().ilike("title", `${MARK}%`);
  await admin.from("action_plans").delete().ilike("description", `${MARK}%`);
  await admin.from("evidence_items").delete().ilike("title", `${MARK}%`);

  if (campaignId) {
    await admin.from("evaluation_assignments").delete().eq("campaign_id", campaignId);
    await admin.from("evaluation_campaigns").delete().eq("id", campaignId);
  }
  await admin.from("evaluation_campaigns").delete().ilike("nombre", `${MARK}%`);
  await admin.from("workers").delete().ilike("nombre", `${MARK}%`);

  // Rate limits de prueba
  await admin.from("public_rate_limits").delete().like("action", "%");

  if (existsSync(fixturesPath)) unlinkSync(fixturesPath);
  console.log("Cleanup fixtures OK");
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
