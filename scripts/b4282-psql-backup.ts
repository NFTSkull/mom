/**
 * B4.28.2 — Backup lógico off-repo vía psql (sin Docker / sin pg_dump 17).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const TARGET_REF = "SYN-PRUEBA-LOGIN";
const LABEL = (process.env.BACKUP_LABEL || "manual").replace(/[^a-zA-Z0-9_-]/g, "");

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(".env.production.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) out[m[1]!] = v;
  }
  return out;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function psql(conn: string, sql: string): string {
  return execFileSync("psql", [conn, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
    timeout: 120_000,
  }).trim();
}

function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (/concasa|charolais|fvtq|localhost/i.test(url)) throw new Error("ABORT");
  const ref = new URL(url).hostname.split(".")[0]!;
  if (!ref.startsWith("agbl") || !ref.endsWith("kubf")) throw new Error("ABORT ref");
  const expected = readFileSync(
    resolve(process.env.HOME!, "Desktop/nom035-production-secrets/project_ref.txt"),
    "utf8"
  ).trim();
  if (expected !== ref) throw new Error("ABORT ref mismatch");
  const pw = readFileSync(
    resolve(process.env.HOME!, "Desktop/nom035-production-secrets/db_password.txt"),
    "utf8"
  ).trim();
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  // unaccent may live outside public search_path on pooler; backup no lo requiere
  void 0;

  const stamp = new Date().toISOString();
  const outDir = resolve(
    process.env.HOME!,
    "Desktop/nom035-production-backups",
    `${stamp.replace(/[:.]/g, "-")}-${LABEL}`
  );
  mkdirSync(outDir, { recursive: true, mode: 0o700 });

  const dumpSql = `
with tw as (
  select * from public.workers
  where external_reference = '${TARGET_REF}' and is_test = true
)
select json_build_object(
  'createdAtUtc', (now() at time zone 'utc'),
  'counts', json_build_object(
    'realWorkers', (select count(*) from public.workers where coalesce(is_test,false)=false),
    'realResults', (select count(*) from public.evaluation_results r join public.workers w on w.id=r.worker_id where coalesce(w.is_test,false)=false),
    'realAnswers', (select count(*) from public.evaluation_answers ans join public.evaluation_assignments ea on ea.id=ans.assignment_id join public.workers w on w.id=ea.worker_id where coalesce(w.is_test,false)=false),
    'realCompleted', (select count(*) from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id join public.workers w on w.id=ea.worker_id where c.nombre='Evaluación NOM-035 2026' and not coalesce(w.is_test,false) and ea.status='completed'),
    'realPending', (select count(*) from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id join public.workers w on w.id=ea.worker_id where c.nombre='Evaluación NOM-035 2026' and not coalesce(w.is_test,false) and ea.status='pending'),
    'testWorkers', (select count(*) from public.workers where is_test),
    'testResults', (select count(*) from public.evaluation_results r join public.workers w on w.id=r.worker_id where w.is_test),
    'testAnswers', (select count(*) from public.evaluation_answers ans join public.evaluation_assignments ea on ea.id=ans.assignment_id join public.workers w on w.id=ea.worker_id where w.is_test),
    'testAssignments', (select count(*) from public.evaluation_assignments ea join public.workers w on w.id=ea.worker_id where w.is_test),
    'testSessions', (select count(*) from public.evaluation_sessions s join public.evaluation_assignments ea on ea.id=s.assignment_id join public.workers w on w.id=ea.worker_id where w.is_test),
    'testQuestionnaires', (select count(*) from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.workers w on w.id=ea.worker_id where w.is_test),
    'ats', (select count(*) from public.evaluation_answers ans join public.evaluation_assignments ea on ea.id=ans.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id join public.workers w on w.id=ea.worker_id where c.nombre='Evaluación NOM-035 2026' and not coalesce(w.is_test,false) and ans.question_id='guia_i_1' and lower(trim(coalesce(ans.answer_value::text, ans.answer_text, ''))) in ('si','sí','1','true','yes')),
    'clinical', (select count(*) from public.evaluation_results r join public.evaluation_campaigns c on c.id=r.campaign_id join public.workers w on w.id=r.worker_id where c.nombre='Evaluación NOM-035 2026' and not coalesce(w.is_test,false) and r.guia_i_requires_clinical_attention=true)
  ),
  'realWorkerRefsSha', (select md5(coalesce(string_agg(external_reference, ',' order by external_reference), '')) from public.workers where coalesce(is_test,false)=false),
  'target', json_build_object(
    'worker', (select row_to_json(tw) from tw),
    'accounts', (select coalesce(json_agg(row_to_json(wa)), '[]'::json) from public.worker_accounts wa where wa.worker_id in (select id from tw)),
    'assignments', (select coalesce(json_agg(row_to_json(ea)), '[]'::json) from public.evaluation_assignments ea where ea.worker_id in (select id from tw)),
    'questionnaires', (select coalesce(json_agg(row_to_json(aq)), '[]'::json) from public.assignment_questionnaires aq where aq.assignment_id in (select id from public.evaluation_assignments where worker_id in (select id from tw))),
    'sessions', (select coalesce(json_agg(row_to_json(s)), '[]'::json) from public.evaluation_sessions s where s.assignment_id in (select id from public.evaluation_assignments where worker_id in (select id from tw))),
    'drafts', (select coalesce(json_agg(row_to_json(d)), '[]'::json) from public.evaluation_drafts d where d.assignment_id in (select id from public.evaluation_assignments where worker_id in (select id from tw))),
    'answers', (select coalesce(json_agg(row_to_json(ans)), '[]'::json) from public.evaluation_answers ans where ans.assignment_id in (select id from public.evaluation_assignments where worker_id in (select id from tw))),
    'results', (select coalesce(json_agg(row_to_json(r)), '[]'::json) from public.evaluation_results r where r.worker_id in (select id from tw)),
    'synCampaign', (select row_to_json(c) from public.evaluation_campaigns c where c.nombre = 'CAMPAÑA_LOGIN_PRUEBA_PROD')
  )
)::text;
`;

  const json = psql(conn, dumpSql);
  const payloadPath = resolve(outDir, "logical-backup.json");
  writeFileSync(payloadPath, json + "\n", { mode: 0o600 });
  const payloadSha = sha256(json + "\n");
  const parsed = JSON.parse(json) as {
    counts: Record<string, number>;
    realWorkerRefsSha: string;
  };

  if (parsed.counts.realWorkers !== 83) throw new Error("ABORT: realWorkers≠83");
  if (parsed.counts.realResults !== 80) throw new Error("ABORT: realResults≠80");
  // pre: 1; post: 0 — no forzar testWorkers=1
  if (parsed.counts.testWorkers > 1) throw new Error("ABORT: testWorkers>1");

  const manifest = {
    environment: "production",
    projectName: "nom035-production",
    refSanitized: `${ref.slice(0, 4)}…${ref.slice(-4)}`,
    label: LABEL,
    createdAtUtc: stamp,
    method: "psql-json-logical",
    sha256: payloadSha,
    counts: parsed.counts,
    realWorkerRefsSha: parsed.realWorkerRefsSha,
    files: [
      {
        name: "logical-backup.json",
        bytes: statSync(payloadPath).size,
        sha256: payloadSha,
      },
    ],
  };
  writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), {
    mode: 0o600,
  });
  console.log(JSON.stringify({ ok: true, outDir, ...manifest }, null, 2));
}

main();
