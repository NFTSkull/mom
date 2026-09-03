/**
 * B4.28.2 — Limpieza EXCLUSIVA de SYN-PRUEBA-LOGIN en nom035-production.
 *
 * Target obligatorio:
 *   workers.external_reference = 'SYN-PRUEBA-LOGIN' AND is_test = true
 * Debe resolver exactamente 1 worker. Si 0 o >1 → ABORT.
 *
 * Dry-run:
 *   npx tsx scripts/b4282-cleanup-syn-prueba.ts
 * Execute:
 *   B4282_EXECUTE=1 npx tsx scripts/b4282-cleanup-syn-prueba.ts
 *
 * No imprime UUIDs, Auth IDs ni passwords.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGET_REF = "SYN-PRUEBA-LOGIN";
const REAL_CAMPAIGN = "Evaluación NOM-035 2026";
const SYN_CAMPAIGN = "CAMPAÑA_LOGIN_PRUEBA_PROD";
const EXPECTED_REF_PREFIX = "agbl";
const EXPECTED_REF_SUFFIX = "kubf";
const EXECUTE = process.env.B4282_EXECUTE === "1";

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v) out[m[1]!] = v;
  }
  return out;
}

function loadEnv(): Record<string, string> {
  return { ...loadEnvFile(".env.production.local") };
}

function assertProductionUrl(url: string): string {
  if (!url) throw new Error("ABORT: URL vacía");
  if (/localhost|127\.0\.0\.1/i.test(url)) throw new Error("ABORT: localhost");
  if (/concasa|charolais|fvtq/i.test(url)) throw new Error("ABORT: ConCasa");
  const host = new URL(url).hostname;
  if (!host.endsWith(".supabase.co")) throw new Error("ABORT: host no supabase");
  const ref = host.split(".")[0] ?? "";
  if (!ref.startsWith(EXPECTED_REF_PREFIX) || !ref.endsWith(EXPECTED_REF_SUFFIX)) {
    throw new Error("ABORT: project ref no autorizado");
  }
  const nameFile = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-secrets/project_name.txt"
  );
  if (existsSync(nameFile)) {
    const name = readFileSync(nameFile, "utf8").trim();
    if (name !== "nom035-production") throw new Error("ABORT: nombre lógico inválido");
  }
  const expectedFile = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-secrets/project_ref.txt"
  );
  if (existsSync(expectedFile)) {
    const expected = readFileSync(expectedFile, "utf8").trim();
    if (expected !== ref) throw new Error("ABORT: URL ≠ project_ref off-repo");
  }
  return ref;
}

function dbPassword(env: Record<string, string>): string {
  const file = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-secrets/db_password.txt"
  );
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  if (env.SUPABASE_DB_PASSWORD) return env.SUPABASE_DB_PASSWORD;
  throw new Error("ABORT: falta db_password");
}

function connString(ref: string, password: string): string {
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
}

function psql(conn: string, sql: string): string {
  try {
    return execFileSync("psql", [conn, "-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", sql], {
      encoding: "utf8",
      timeout: 90_000,
    }).trim();
  } catch (e) {
    const err = e as { stderr?: string };
    throw new Error(`psql failed: ${(err.stderr ?? "error").slice(0, 400)}`);
  }
}

/** Un único SELECT: psql -c solo devuelve el último statement. */
function kvQuery(conn: string, pairsSql: string): Record<string, string> {
  const raw = psql(
    conn,
    `select string_agg(k || '=' || v, E'\\n' order by k) from (${pairsSql}) s(k, v);`
  );
  return parseKv(raw);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function parseKv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const i = line.indexOf("=");
    if (i < 1) continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const secret = env.SUPABASE_SECRET_KEY ?? "";
  const ref = assertProductionUrl(url);
  const conn = connString(ref, dbPassword(env));
  console.log("PROJECT=nom035-production");
  console.log("REF=", `${ref.slice(0, 4)}…${ref.slice(-4)}`);
  console.log("MODE=", EXECUTE ? "EXECUTE" : "DRY-RUN");

  const identity = kvQuery(
    conn,
    `
  select 'workers', count(*)::text from public.workers
  where external_reference = '${TARGET_REF}' and is_test = true
  union all
  select 'test_all', count(*)::text from public.workers where is_test = true
  union all
  select 'nombre_ok', count(*)::text from public.workers
  where external_reference = '${TARGET_REF}' and is_test = true
    and nombre = 'Trabajador Prueba Portal'
`
  );
  const targetWorkers = Number(identity.workers ?? -1);
  console.log("TARGET_TEST_WORKERS=", targetWorkers);
  if (targetWorkers !== 1) {
    throw new Error(`ABORT: target workers=${targetWorkers} (esperado 1)`);
  }
  if (Number(identity.test_all) !== 1) {
    throw new Error(`ABORT: is_test total=${identity.test_all} (esperado 1)`);
  }
  if (Number(identity.nombre_ok) !== 1) {
    throw new Error("ABORT: nombre no coincide con Trabajador Prueba Portal");
  }

  const counts = kvQuery(
    conn,
    `
with w as (
  select id from public.workers
  where external_reference = '${TARGET_REF}' and is_test = true
),
a as (
  select ea.id, ea.campaign_id, ea.status
  from public.evaluation_assignments ea
  join w on w.id = ea.worker_id
)
select 'accounts', count(*)::text from public.worker_accounts wa join w on w.id = wa.worker_id
union all select 'assignments', count(*)::text from a
union all select 'questionnaires', count(*)::text from public.assignment_questionnaires aq join a on a.id = aq.assignment_id
union all select 'sessions', count(*)::text from public.evaluation_sessions s join a on a.id = s.assignment_id
union all select 'drafts', count(*)::text from public.evaluation_drafts d join a on a.id = d.assignment_id
union all select 'answers', count(*)::text from public.evaluation_answers ans join a on a.id = ans.assignment_id
union all select 'results', count(*)::text from public.evaluation_results r join w on w.id = r.worker_id
union all select 'real_workers_in_target', count(*)::text
from public.evaluation_assignments ea
join public.workers rw on rw.id = ea.worker_id
where ea.id in (select id from a) and coalesce(rw.is_test,false)=false
union all select 'real_asg_in_target', count(*)::text
from public.evaluation_assignments ea
join public.workers rw on rw.id = ea.worker_id
where ea.id in (select id from a) and coalesce(rw.is_test,false)=false
union all select 'real_res_in_target', count(*)::text
from public.evaluation_results r
join public.workers rw on rw.id = r.worker_id
where r.worker_id in (select id from w) and coalesce(rw.is_test,false)=false
`
  );

  const extraFk = parseKv(
    psql(
      conn,
      `
select 'fk_rows=' || count(*) from information_schema.table_constraints tc
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and ccu.table_name in ('workers','evaluation_assignments','evaluation_results','evaluation_campaigns');
select tc.table_name || '.' || kcu.column_name || '->' || ccu.table_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and ccu.table_name in ('workers','evaluation_assignments','evaluation_results')
order by 1;
`
    )
  );
  console.log("FK_MAP_COUNT=", extraFk.fk_rows ?? "?");
  const fkLines = extraFk
    ? Object.keys(extraFk).filter((k) => k.includes("->"))
    : [];
  if (fkLines.length) console.log("FK_KEYS=", fkLines.join(", "));

  const fkList = psql(
    conn,
    `
select tc.table_name || '.' || kcu.column_name || '->' || ccu.table_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and ccu.table_name in ('workers','evaluation_assignments','evaluation_results')
order by 1;
`
  );
  console.log("FK_LIST=\n" + fkList);

  const extraHits = kvQuery(
    conn,
    `
with w as (
  select id from public.workers
  where external_reference = '${TARGET_REF}' and is_test = true
),
a as (
  select id from public.evaluation_assignments where worker_id in (select id from w)
)
select 'syn_campaign_asg', count(*)::text
from public.evaluation_assignments ea
join public.evaluation_campaigns c on c.id = ea.campaign_id
where c.nombre = '${SYN_CAMPAIGN}'
union all
select 'syn_campaign_asg_real', count(*)::text
from public.evaluation_assignments ea
join public.evaluation_campaigns c on c.id = ea.campaign_id
join public.workers rw on rw.id = ea.worker_id
where c.nombre = '${SYN_CAMPAIGN}' and coalesce(rw.is_test,false)=false
union all
select 'syn_campaign_results', count(*)::text
from public.evaluation_results r
join public.evaluation_campaigns c on c.id = r.campaign_id
where c.nombre = '${SYN_CAMPAIGN}'
union all
select 'auth_linked', count(*)::text
from public.worker_accounts wa
join w on w.id = wa.worker_id
where wa.auth_user_id is not null
union all
select 'auth_is_admin', count(*)::text
from public.worker_accounts wa
join w on w.id = wa.worker_id
join public.admin_profiles ap on ap.id = wa.auth_user_id
union all
select 'username', coalesce((
  select wa.username_normalized from public.worker_accounts wa
  join w on w.id = wa.worker_id limit 1
), '—')
union all
select 'auth_user_id', coalesce((
  select wa.auth_user_id::text from public.worker_accounts wa
  join w on w.id = wa.worker_id limit 1
), '')
union all
select 'asg_other_workers', count(distinct ea.worker_id)::text
from public.evaluation_assignments ea
where ea.id in (select id from a)
  and ea.worker_id not in (select id from w)
`
  );

  const preReal = kvQuery(
    conn,
    `
select 'real_workers', count(*)::text from public.workers where coalesce(is_test,false)=false
union all
select 'real_completed', count(*)::text
from public.evaluation_assignments ea
join public.evaluation_campaigns c on c.id=ea.campaign_id
join public.workers w on w.id=ea.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false) and ea.status='completed'
union all
select 'real_pending', count(*)::text
from public.evaluation_assignments ea
join public.evaluation_campaigns c on c.id=ea.campaign_id
join public.workers w on w.id=ea.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false) and ea.status='pending'
union all
select 'real_results', count(*)::text
from public.evaluation_results r
join public.evaluation_campaigns c on c.id=r.campaign_id
join public.workers w on w.id=r.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)
union all
select 'real_answers', count(*)::text
from public.evaluation_answers ans
join public.evaluation_assignments ea on ea.id=ans.assignment_id
join public.workers w on w.id=ea.worker_id
where coalesce(w.is_test,false)=false
union all
select 'clinical', count(*)::text
from public.evaluation_results r
join public.evaluation_campaigns c on c.id=r.campaign_id
join public.workers w on w.id=r.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)
  and r.guia_i_requires_clinical_attention = true
union all
select 'ats', count(*)::text
from public.evaluation_answers ans
join public.evaluation_assignments ea on ea.id=ans.assignment_id
join public.evaluation_campaigns c on c.id=ea.campaign_id
join public.workers w on w.id=ea.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)
  and ans.question_id='guia_i_1'
  and lower(trim(coalesce(ans.answer_value::text, ans.answer_text, ''))) in ('si','sí','1','true','yes')
`
  );

  console.log("TARGET_TEST_WORKER_ACCOUNTS=", counts.accounts);
  console.log("TARGET_TEST_ASSIGNMENTS=", counts.assignments);
  console.log("TARGET_TEST_QUESTIONNAIRES=", counts.questionnaires);
  console.log("TARGET_TEST_SESSIONS=", counts.sessions);
  console.log("TARGET_TEST_DRAFTS=", counts.drafts);
  console.log("TARGET_TEST_ANSWERS=", counts.answers);
  console.log("TARGET_TEST_RESULTS=", counts.results);
  console.log("REAL_WORKERS_IN_TARGET=", counts.real_workers_in_target);
  console.log("REAL_ASSIGNMENTS_IN_TARGET=", counts.real_asg_in_target);
  console.log("REAL_RESULTS_IN_TARGET=", counts.real_res_in_target);
  console.log("ASG_OTHER_WORKERS=", extraHits.asg_other_workers);
  console.log("SYN_CAMPAIGN_ASG=", extraHits.syn_campaign_asg);
  console.log("SYN_CAMPAIGN_ASG_REAL=", extraHits.syn_campaign_asg_real);
  console.log("SYN_CAMPAIGN_RESULTS=", extraHits.syn_campaign_results);
  console.log("AUTH_LINKED=", extraHits.auth_linked);
  console.log("AUTH_IS_ADMIN=", extraHits.auth_is_admin);
  console.log("USERNAME=", extraHits.username ?? "—");
  console.log("PRE_REAL_WORKERS=", preReal.real_workers);
  console.log("PRE_REAL_COMPLETED=", preReal.real_completed);
  console.log("PRE_REAL_PENDING=", preReal.real_pending);
  console.log("PRE_REAL_RESULTS=", preReal.real_results);
  console.log("PRE_REAL_ANSWERS=", preReal.real_answers);
  console.log("PRE_ATS=", preReal.ats);
  console.log("PRE_CLINICAL=", preReal.clinical);

  if (Number(counts.real_workers_in_target) > 0) throw new Error("ABORT: overlap real workers");
  if (Number(counts.real_asg_in_target) > 0) throw new Error("ABORT: overlap real assignments");
  if (Number(counts.real_res_in_target) > 0) throw new Error("ABORT: overlap real results");
  if (Number(extraHits.asg_other_workers) > 0) throw new Error("ABORT: assignment de otro worker");
  if (Number(extraHits.auth_is_admin) > 0) throw new Error("ABORT: auth vinculado a admin");
  if (Number(preReal.real_workers) !== 83) throw new Error("ABORT: REAL_WORKERS ≠ 83");
  if (Number(preReal.real_results) !== 80) throw new Error("ABORT: REAL_RESULTS ≠ 80");
  if (Number(preReal.real_completed) !== 80) throw new Error("ABORT: REAL_COMPLETED ≠ 80");
  if (Number(preReal.real_pending) !== 3) throw new Error("ABORT: REAL_PENDING ≠ 3");

  const canDeleteSynCampaign =
    Number(extraHits.syn_campaign_asg_real) === 0 &&
    Number(extraHits.syn_campaign_results) === 0 &&
    Number(extraHits.syn_campaign_asg) <= Number(counts.assignments);

  console.log("CAN_DELETE_SYN_CAMPAIGN=", canDeleteSynCampaign);

  if (!EXECUTE) {
    console.log("DRY-RUN_OK=true");
    return;
  }

  const cleanupSql = `
begin;
lock table public.workers in row exclusive mode;

do $$
declare
  v_wid uuid;
  v_auth uuid;
  v_asg int;
  v_real int;
begin
  select id into v_wid
  from public.workers
  where external_reference = '${TARGET_REF}' and is_test = true;
  if v_wid is null then raise exception 'ABORT: worker no encontrado'; end if;
  if (select count(*) from public.workers where external_reference = '${TARGET_REF}' and is_test = true) <> 1 then
    raise exception 'ABORT: target no es exactamente 1';
  end if;

  select count(*) into v_real
  from public.evaluation_assignments ea
  join public.workers w on w.id = ea.worker_id
  where ea.worker_id = v_wid and coalesce(w.is_test,false)=false;
  if v_real <> 0 then raise exception 'ABORT: overlap real'; end if;

  select count(*) into v_asg from public.evaluation_assignments where worker_id = v_wid;
  if v_asg <> ${Number(counts.assignments)} then
    raise exception 'ABORT: assignments cambiaron (% vs %)', v_asg, ${Number(counts.assignments)};
  end if;

  select wa.auth_user_id into v_auth from public.worker_accounts wa where wa.worker_id = v_wid;

  delete from public.evaluation_answers
  where assignment_id in (select id from public.evaluation_assignments where worker_id = v_wid);
  delete from public.evaluation_drafts
  where assignment_id in (select id from public.evaluation_assignments where worker_id = v_wid);
  delete from public.evaluation_sessions
  where assignment_id in (select id from public.evaluation_assignments where worker_id = v_wid);
  delete from public.evaluation_results where worker_id = v_wid;
  delete from public.assignment_questionnaires
  where assignment_id in (select id from public.evaluation_assignments where worker_id = v_wid);
  delete from public.evaluation_assignments where worker_id = v_wid;
  delete from public.worker_accounts where worker_id = v_wid;
  delete from public.workers where id = v_wid and is_test = true and external_reference = '${TARGET_REF}';

  if (select count(*) from public.workers where is_test) <> 0 then
    raise exception 'ABORT: queda worker is_test';
  end if;
  if (select count(*) from public.workers where coalesce(is_test,false)=false) <> 83 then
    raise exception 'ABORT: REAL_WORKERS cambió';
  end if;

  ${
    canDeleteSynCampaign
      ? `
  if (
    (select count(*) from public.evaluation_assignments ea
     join public.evaluation_campaigns c on c.id=ea.campaign_id
     where c.nombre='${SYN_CAMPAIGN}') = 0
    and
    (select count(*) from public.evaluation_results r
     join public.evaluation_campaigns c on c.id=r.campaign_id
     where c.nombre='${SYN_CAMPAIGN}') = 0
  ) then
    delete from public.evaluation_campaigns where nombre = '${SYN_CAMPAIGN}';
  end if;
  `
      : ""
  }

  if not exists (select 1 from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}') then
    raise exception 'ABORT: campaña real desapareció';
  end if;
end $$;
commit;
`;

  const cleanupOut = execFileSync(
    "psql",
    [conn, "-v", "ON_ERROR_STOP=1", "-f", "-"],
    { encoding: "utf8", input: cleanupSql, timeout: 90_000 }
  );
  console.log("SQL_TX=", cleanupOut.includes("COMMIT") ? "COMMIT" : "UNKNOWN");

  const authId = extraHits.auth_user_id ?? "";
  const username = extraHits.username ?? "";
  let authDeleted = false;
  if (
    Number(extraHits.auth_linked) === 1 &&
    authId.length > 10 &&
    username &&
    !/^\d{3}$/.test(username) &&
    username !== "—"
  ) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: class {} as never },
    });
    const { data: userData, error: getErr } = await sb.auth.admin.getUserById(authId);
    if (getErr || !userData.user) {
      throw new Error("ABORT: Auth synthetic no encontrado de forma inequívoca");
    }
    const { data: stillLinked } = await sb
      .from("worker_accounts")
      .select("id")
      .eq("auth_user_id", authId)
      .limit(1);
    if (stillLinked && stillLinked.length > 0) {
      throw new Error("ABORT: Auth aún vinculado a worker_account");
    }
    const { error: delErr } = await sb.auth.admin.deleteUser(authId);
    if (delErr) throw new Error(`ABORT: no se pudo borrar Auth synthetic: ${delErr.message}`);
    authDeleted = true;
  }
  console.log("AUTH_SYNTHETIC_DELETED=", authDeleted);

  const post = kvQuery(
    conn,
    `
select 'test_workers', count(*)::text from public.workers where is_test
union all
select 'syn_ref', count(*)::text from public.workers where external_reference='${TARGET_REF}'
union all
select 'test_asg', count(*)::text
from public.evaluation_assignments ea
join public.workers w on w.id=ea.worker_id where w.is_test
union all
select 'test_results', count(*)::text
from public.evaluation_results r
join public.workers w on w.id=r.worker_id where w.is_test
union all
select 'test_answers', count(*)::text
from public.evaluation_answers ans
join public.evaluation_assignments ea on ea.id=ans.assignment_id
join public.workers w on w.id=ea.worker_id where w.is_test
union all
select 'test_sessions', count(*)::text
from public.evaluation_sessions s
join public.evaluation_assignments ea on ea.id=s.assignment_id
join public.workers w on w.id=ea.worker_id where w.is_test
union all
select 'test_q', count(*)::text
from public.assignment_questionnaires aq
join public.evaluation_assignments ea on ea.id=aq.assignment_id
join public.workers w on w.id=ea.worker_id where w.is_test
union all
select 'syn_campaign', count(*)::text from public.evaluation_campaigns where nombre='${SYN_CAMPAIGN}'
union all
select 'real_workers', count(*)::text from public.workers where coalesce(is_test,false)=false
union all
select 'real_completed', count(*)::text
from public.evaluation_assignments ea
join public.evaluation_campaigns c on c.id=ea.campaign_id
join public.workers w on w.id=ea.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false) and ea.status='completed'
union all
select 'real_pending', count(*)::text
from public.evaluation_assignments ea
join public.evaluation_campaigns c on c.id=ea.campaign_id
join public.workers w on w.id=ea.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false) and ea.status='pending'
union all
select 'real_results', count(*)::text
from public.evaluation_results r
join public.evaluation_campaigns c on c.id=r.campaign_id
join public.workers w on w.id=r.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)
union all
select 'real_answers', count(*)::text
from public.evaluation_answers ans
join public.evaluation_assignments ea on ea.id=ans.assignment_id
join public.workers w on w.id=ea.worker_id
where coalesce(w.is_test,false)=false
union all
select 'clinical', count(*)::text
from public.evaluation_results r
join public.evaluation_campaigns c on c.id=r.campaign_id
join public.workers w on w.id=r.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)
  and r.guia_i_requires_clinical_attention = true
union all
select 'ats', count(*)::text
from public.evaluation_answers ans
join public.evaluation_assignments ea on ea.id=ans.assignment_id
join public.evaluation_campaigns c on c.id=ea.campaign_id
join public.workers w on w.id=ea.worker_id
where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)
  and ans.question_id='guia_i_1'
  and lower(trim(coalesce(ans.answer_value::text, ans.answer_text, ''))) in ('si','sí','1','true','yes')
`
  );

  console.log("POST_TEST_WORKERS=", post.test_workers);
  console.log("POST_SYN_REF=", post.syn_ref);
  console.log("POST_TEST_ASSIGNMENTS=", post.test_asg);
  console.log("POST_TEST_RESULTS=", post.test_results);
  console.log("POST_TEST_ANSWERS=", post.test_answers);
  console.log("POST_TEST_SESSIONS=", post.test_sessions);
  console.log("POST_TEST_QUESTIONNAIRES=", post.test_q);
  console.log("POST_SYN_CAMPAIGN=", post.syn_campaign);
  console.log("POST_REAL_WORKERS=", post.real_workers);
  console.log("POST_REAL_COMPLETED=", post.real_completed);
  console.log("POST_REAL_PENDING=", post.real_pending);
  console.log("POST_REAL_RESULTS=", post.real_results);
  console.log("POST_REAL_ANSWERS=", post.real_answers);
  console.log("POST_ATS=", post.ats);
  console.log("POST_CLINICAL=", post.clinical);

  if (Number(post.test_workers) !== 0) throw new Error("FAIL: quedan test workers");
  if (Number(post.real_workers) !== 83) throw new Error("FAIL: REAL_WORKERS");
  if (Number(post.real_results) !== 80) throw new Error("FAIL: REAL_RESULTS");
  if (Number(post.real_answers) !== Number(preReal.real_answers)) {
    throw new Error("FAIL: REAL_ANSWERS cambió");
  }
  if (Number(post.ats) !== Number(preReal.ats)) throw new Error("FAIL: ATS cambió");
  if (Number(post.clinical) !== Number(preReal.clinical)) throw new Error("FAIL: clinical cambió");

  const stamp = new Date().toISOString();
  const outDir = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-backups",
    `${stamp.replace(/[:.]/g, "-")}-b4282-counts`
  );
  mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const payload = JSON.stringify({ stamp, preReal, post, counts }, null, 2);
  writeFileSync(resolve(outDir, "counts.json"), payload, { mode: 0o600 });
  writeFileSync(
    resolve(outDir, "manifest.json"),
    JSON.stringify({ createdAtUtc: stamp, sha256: sha256(payload) }, null, 2),
    { mode: 0o600 }
  );
  console.log("COUNTS_BACKUP_OK=true");
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
