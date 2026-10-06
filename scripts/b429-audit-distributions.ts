/**
 * B4.29 — Auditoría READ-ONLY de distribuciones por nivel (Production).
 *
 * - Replica el filtro de `admin_export_nom035_full_report` (sin audit_log).
 * - Pasa el payload por `normalizeFullReportPayload` + `buildNom035AggregateReport`.
 * - Calcula huellas md5 de tablas sensibles para certificar "sin modificaciones".
 * - Transacción `READ ONLY`; no imprime nombres ni PII.
 *
 * Uso: NOM035_SECRETS_DIR=<dir> npx tsx scripts/b429-audit-distributions.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertAggregateMath,
  buildNom035AggregateReport,
} from "@/lib/nom035/aggregate-report";
import { normalizeFullReportPayload } from "@/lib/nom035/report-data";

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

function connString(): string {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (/concasa|charolais|fvtq|localhost/i.test(url)) throw new Error("ABORT: URL no NOM-035");
  const ref = new URL(url).hostname.split(".")[0]!;
  if (!ref.startsWith("agbl") || !ref.endsWith("kubf")) throw new Error("ABORT ref");
  const secretsDir =
    process.env.NOM035_SECRETS_DIR ??
    resolve(process.env.HOME!, "Desktop/nom035-production-secrets");
  // iCloud puede dejar project_ref.txt como placeholder vacío (dataless).
  const expected = readFileSync(resolve(secretsDir, "project_ref.txt"), "utf8").trim();
  if (expected && expected !== ref) throw new Error("ABORT ref mismatch");
  if (!expected) console.error("WARN project_ref.txt vacío; se usa guarda prefijo/sufijo");
  const pw = readFileSync(resolve(secretsDir, "db_password.txt"), "utf8").trim();
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
}

function psqlReadOnly(conn: string, select: string): string {
  return execFileSync(
    "psql",
    [conn, "-v", "ON_ERROR_STOP=1", "-At", "-c", `begin transaction read only; ${select}`],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }
  ).trim();
}

const REAL_FILTER = `
  coalesce(w.is_test, false) = false
  and wa.username_normalized ~ '^[0-9]{3}$'
  and wa.username_normalized::int between 1 and 83`;

const PAYLOAD_SQL = `
with camp as (
  select id, nombre, status::text as status
  from public.evaluation_campaigns
  where nombre = 'Evaluación NOM-035 2026'
  limit 1
),
assign as (
  select a.* from public.evaluation_assignments a
  join public.workers w on w.id = a.worker_id
  join public.worker_accounts wa on wa.worker_id = w.id
  where a.campaign_id = (select id from camp)
    and a.status is distinct from 'revoked'
    and w.external_reference ~ '^[0-9]+$'
    and ${REAL_FILTER}
),
cw as (
  select
    r.id as result_id, a.id as assignment_id, wa.username_normalized as username,
    a.status::text as status,
    (select aq.status from public.assignment_questionnaires aq
      where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_I' limit 1) as guia_i_status,
    (select aq.status from public.assignment_questionnaires aq
      where aq.assignment_id = a.id and aq.questionnaire_type = 'GUIA_III' limit 1) as guia_iii_status,
    r.guia_ii_final_score as final_score,
    r.guia_ii_final_risk_level::text as final_risk_level,
    r.guia_ii_category_scores as category_scores,
    r.guia_ii_domain_scores as domain_scores,
    r.guia_i_requires_clinical_attention,
    r.scoring_version, r.questionnaire_version
  from public.evaluation_results r
  join public.evaluation_assignments a on a.id = r.assignment_id
  join public.workers w on w.id = r.worker_id
  join public.worker_accounts wa on wa.worker_id = w.id
  where r.campaign_id = (select id from camp)
    and a.status = 'completed'
    and ${REAL_FILTER}
)
select json_build_object(
  'ok', true,
  'generatedAt', timezone('utc', now()),
  'campaign', (select json_build_object('nombre', nombre, 'status', status) from camp),
  'counts', json_build_object(
    'realWorkers', (select count(*) from assign),
    'realCompleted', (select count(*) from assign where status = 'completed'),
    'realPending', (select count(*) from assign where status = 'pending'),
    'realInProgress', (select count(*) from assign where status = 'in_progress'),
    'realResults', (select count(*) from cw),
    'testWorkers', (select count(*) from public.workers where coalesce(is_test,false)),
    'testResultsStored', (select count(*) from public.evaluation_results r
       join public.workers w on w.id = r.worker_id
       where r.campaign_id = (select id from camp) and coalesce(w.is_test,false)),
    'testResultsIncluded', 0,
    'guiaICompleted', (select count(*) from cw where guia_i_status = 'submitted'),
    'guiaIIICompleted', (select count(*) from cw where guia_iii_status = 'submitted'),
    'guiaIICompleted', 0
  ),
  'riskDistribution', (select coalesce(json_object_agg(lvl, cnt), '{}'::json) from (
     select final_risk_level as lvl, count(*) as cnt from cw group by final_risk_level) s),
  'categoryAverages', '{}'::json,
  'domainAverages', '{}'::json,
  'workers', (select coalesce(json_agg(json_build_object(
     'resultId', cw.result_id,
     'username', cw.username,
     'nombre', '',
     'status', cw.status,
     'guiaIStatus', cw.guia_i_status,
     'guiaIIIStatus', cw.guia_iii_status,
     'finalScore', cw.final_score,
     'finalRiskLevel', cw.final_risk_level,
     'categoryScores', cw.category_scores,
     'domainScores', cw.domain_scores,
     'guiaIRequiresClinicalAttention', cw.guia_i_requires_clinical_attention,
     'scoringVersion', cw.scoring_version,
     'questionnaireVersion', cw.questionnaire_version,
     'answers', coalesce((select json_agg(json_build_object(
         'questionnaireCode', ans.questionnaire_code,
         'questionId', ans.question_id,
         'answerText', ans.answer_text,
         'answerValue', ans.answer_value))
       from public.evaluation_answers ans
       where ans.assignment_id = cw.assignment_id and ans.question_id = 'guia_i_1'), '[]'::json)
   ) order by cw.username), '[]'::json) from cw)
);`;

const FINGERPRINT_SQL = `
select json_build_object(
  'evaluation_answers', (select json_build_object('n', count(*), 'md5', md5(coalesce(string_agg(t::text, '|' order by t.id), ''))) from public.evaluation_answers t),
  'evaluation_results', (select json_build_object('n', count(*), 'md5', md5(coalesce(string_agg(t::text, '|' order by t.id), ''))) from public.evaluation_results t),
  'evaluation_assignments', (select json_build_object('n', count(*), 'md5', md5(coalesce(string_agg(t::text, '|' order by t.id), ''))) from public.evaluation_assignments t),
  'workers', (select json_build_object('n', count(*), 'md5', md5(coalesce(string_agg(t::text, '|' order by t.id), ''))) from public.workers t),
  'worker_accounts', (select json_build_object('n', count(*), 'md5', md5(coalesce(string_agg(t::text, '|' order by t.worker_id), ''))) from public.worker_accounts t),
  'evaluation_campaigns', (select json_build_object('n', count(*), 'md5', md5(coalesce(string_agg(t::text, '|' order by t.id), ''))) from public.evaluation_campaigns t)
);`;

function main() {
  const conn = connString();
  const payload = JSON.parse(psqlReadOnly(conn, PAYLOAD_SQL)) as Record<string, unknown>;
  const report = normalizeFullReportPayload(payload);
  if (!report) throw new Error("payload inválido");
  const agg = buildNom035AggregateReport(report);
  const math = assertAggregateMath(agg);

  const fmt = (m: (typeof agg.categories)[number]) => ({
    name: m.name,
    ...(m.category ? { category: m.category } : {}),
    nulo: m.levels.nulo.count,
    bajo: m.levels.bajo.count,
    medio: m.levels.medio.count,
    alto: m.levels.alto.count,
    muy_alto: m.levels.muy_alto.count,
    total: m.total,
    medioPlus: m.medioPlus?.count,
    medioPlusPct: m.medioPlus?.percentage,
    altoPlus: m.altoPlus?.count,
    altoPlusPct: m.altoPlus?.percentage,
  });

  const fingerprints = JSON.parse(psqlReadOnly(conn, FINGERPRINT_SQL));

  const out = {
    REAL_WORKERS: agg.population.realWorkers,
    REAL_COMPLETED: agg.population.realCompleted,
    REAL_RESULTS: agg.population.realResults,
    TEST_INCLUDED: agg.population.testResultsIncluded,
    TEST_RESULTS_STORED: agg.population.testResultsStored,
    CAMPAIGN_STATUS: agg.campaignStatusLabel,
    SCORING_VERSION: agg.scoringVersion,
    ATS_REAL_COUNT: agg.traumaticEvent.yes,
    CLINICAL_ATTENTION_REAL_COUNT: agg.clinicalAttention.yes,
    OVERALL: Object.fromEntries(agg.overallRiskDistribution.map((r) => [r.level, r.count])),
    AGGREGATE_MATH: math,
    categories: agg.categories.map(fmt),
    domains: agg.domains.map(fmt),
    fingerprints,
  };
  console.log(JSON.stringify(out, null, 2));
}

main();
