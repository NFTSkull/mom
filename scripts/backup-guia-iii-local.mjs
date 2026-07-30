/**
 * Dump lógico LOCAL de fixtures Guía III + verificación de snapshot.
 *   npm run guia3:backup:local
 *   npm run guia3:backup:verify
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), ".local-backups");
const DUMP = join(OUT_DIR, "guia-iii-synthetic-dump.json");
const VERSION = "nom035-stps-2018-guias-referencia-i-iii";

function loadEnv() {
  const out = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return { ...out, ...process.env };
}

function assertLocal(url) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url)) throw new Error("ABORT: solo localhost");
  if (/supabase\.co|concasa|production/i.test(url)) throw new Error("ABORT: remoto");
}

function adminClient(env) {
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof globalThis.WebSocket === "undefined") {
    options.realtime = { transport: class {} };
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options);
}

async function dump() {
  const env = loadEnv();
  assertLocal(env.NEXT_PUBLIC_SUPABASE_URL);
  const admin = adminClient(env);
  const { data: camps } = await admin
    .from("evaluation_campaigns")
    .select("*")
    .eq("nombre", "CAMPAÑA_GUIA_III_TEST");
  const campaignIds = (camps ?? []).map((c) => c.id);
  const { data: asgs } = campaignIds.length
    ? await admin.from("evaluation_assignments").select("*").in("campaign_id", campaignIds)
    : { data: [] };
  const asgIds = (asgs ?? []).map((a) => a.id);
  const { data: instruments } = asgIds.length
    ? await admin.from("assignment_questionnaires").select("*").in("assignment_id", asgIds)
    : { data: [] };
  const { data: answers } = asgIds.length
    ? await admin.from("evaluation_answers").select("*").in("assignment_id", asgIds)
    : { data: [] };
  const { data: results } = asgIds.length
    ? await admin.from("evaluation_results").select("*").in("assignment_id", asgIds)
    : { data: [] };

  mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    dumpedAt: new Date().toISOString(),
    version: VERSION,
    campaigns: camps ?? [],
    assignments: asgs ?? [],
    instruments: instruments ?? [],
    answers: answers ?? [],
    results: results ?? [],
  };
  writeFileSync(DUMP, JSON.stringify(payload, null, 2));
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
  console.log(JSON.stringify({ ok: true, dump: DUMP, fingerprint: hash, assignments: asgIds.length }));
}

async function verify() {
  if (!existsSync(DUMP)) throw new Error("Falta dump; corre guia3:backup:local primero");
  const raw = JSON.parse(readFileSync(DUMP, "utf8"));
  const hasIII = (raw.instruments ?? []).some((i) => i.questionnaire_type === "GUIA_III");
  const hasII = (raw.instruments ?? []).some((i) => i.questionnaire_type === "GUIA_II");
  const versionsOk = (raw.assignments ?? []).every(
    (a) => a.questionnaire_version === VERSION
  );
  const snapshotsOk = (raw.results ?? []).every((r) => {
    const snap = r.result_snapshot ?? {};
    if (!snap || Object.keys(snap).length === 0) return true;
    return snap.final_score === r.guia_ii_final_score;
  });
  const ok = hasIII && !hasII && versionsOk && snapshotsOk;
  console.log(
    JSON.stringify({
      ok,
      hasGuiaIII: hasIII,
      hasGuiaII: hasII,
      versionsOk,
      snapshotsMatchScores: snapshotsOk,
      assignmentCount: (raw.assignments ?? []).length,
      resultCount: (raw.results ?? []).length,
    })
  );
  if (!ok) process.exit(1);
}

const mode = process.argv[2] ?? "dump";
(mode === "verify" ? verify() : dump()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
