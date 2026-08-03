/**
 * B4.13 — Empresa mínima + saneamiento legacy productivo.
 *
 * Dry-run (default):
 *   ALLOW_PRODUCTION_SANITIZE=B413_LEGACY_ONLY NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   npx tsx scripts/b413-apply-minimal-company-and-legacy.ts
 *
 * Ejecutar escritura:
 *   … B413_EXECUTE=1 npx tsx scripts/b413-apply-minimal-company-and-legacy.ts
 *
 * Acciones al ejecutar:
 * - company: razon_social interna + total=83; opcionales NULL
 * - 165 asg sin actividad: eliminar
 * - 2 asg con draft: revocar (preservar drafts), no borrar
 * - campañas legacy: closed
 * - worker_account/worker sintéticos: is_active/activo=false
 *
 * No crea Auth de los 83. No abre campaña. No imprime PII/secrets.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadProductionEnv,
  sanitizeRef,
  resolveExpectedProjectRef,
  assertRefsMatch,
  extractProjectRefFromUrl,
} from "./lib/assert-production-only";

const ALLOW = "B413_LEGACY_ONLY";
const COMPANY_INTERNAL = "NOM035_EMPRESA_OPERATIVA";

function assertSanitizeAllow(env: Record<string, string | undefined>) {
  if ((env.ALLOW_PRODUCTION_SANITIZE ?? "").trim() !== ALLOW) {
    throw new Error(`ABORT: falta ALLOW_PRODUCTION_SANITIZE=${ALLOW}`);
  }
  const target = (env.NOM035_TARGET_ENV ?? "").trim();
  if (target && target !== "production") {
    throw new Error("ABORT: NOM035_TARGET_ENV debe ser production");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlRef = extractProjectRefFromUrl(url);
  const expected = resolveExpectedProjectRef(env);
  const confirmed = (env.CONFIRM_SUPABASE_PROJECT_REF ?? "").trim();
  assertRefsMatch({ urlRef, expected, confirmed });
  return { sanitized: sanitizeRef(urlRef) };
}

function queryRows(sql: string): Array<Record<string, unknown>> {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const path = resolve(".tmp", `b413-q-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(path, sql, { mode: 0o600 });
  try {
    const raw = execFileSync(
      "npx",
      ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", path],
      { encoding: "utf8", env: process.env }
    ).replace(/\u001b\[[0-9;]*m/g, "");
    const parsed = JSON.parse(raw) as { rows: Array<Record<string, unknown>> };
    return parsed.rows ?? [];
  } finally {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}

function queryOne(sql: string): Record<string, unknown> {
  return queryRows(sql)[0] ?? {};
}

async function main() {
  const env = loadProductionEnv();
  Object.assign(process.env, env);
  process.env.ALLOW_PRODUCTION_SANITIZE =
    process.env.ALLOW_PRODUCTION_SANITIZE ?? env.ALLOW_PRODUCTION_SANITIZE;
  process.env.CONFIRM_SUPABASE_PROJECT_REF =
    process.env.CONFIRM_SUPABASE_PROJECT_REF ?? env.CONFIRM_SUPABASE_PROJECT_REF;
  process.env.EXPECTED_SUPABASE_PROJECT_REF =
    process.env.EXPECTED_SUPABASE_PROJECT_REF ?? env.EXPECTED_SUPABASE_PROJECT_REF;
  process.env.NOM035_TARGET_ENV = process.env.NOM035_TARGET_ENV ?? "production";

  if (!process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("SUPABASE_DB_PASSWORD ausente");
  }

  const { sanitized } = assertSanitizeAllow({
    ...env,
    ALLOW_PRODUCTION_SANITIZE: process.env.ALLOW_PRODUCTION_SANITIZE,
    CONFIRM_SUPABASE_PROJECT_REF: process.env.CONFIRM_SUPABASE_PROJECT_REF,
    EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
    NOM035_TARGET_ENV: process.env.NOM035_TARGET_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const execute = process.env.B413_EXECUTE === "1";

  const beforeRow = queryOne(`
select jsonb_build_object(
  'workers_numeric', (select count(*)::int from public.workers where external_reference ~ '^[0-9]+$'),
  'workers_syn', (select count(*)::int from public.workers where external_reference ~* 'SYN|TST-|PRUEBA|PILOT|STAGING'),
  'asg_total', (select count(*)::int from public.evaluation_assignments),
  'asg_no_activity', (
    select count(*)::int from public.evaluation_assignments a
    where not exists (select 1 from public.evaluation_sessions s where s.assignment_id=a.id)
      and not exists (select 1 from public.evaluation_answers ans where ans.assignment_id=a.id)
      and not exists (select 1 from public.evaluation_drafts d where d.assignment_id=a.id)
      and not exists (select 1 from public.evaluation_results r where r.assignment_id=a.id)
  ),
  'asg_with_draft', (
    select count(*)::int from public.evaluation_assignments a
    where exists (select 1 from public.evaluation_drafts d where d.assignment_id=a.id)
  ),
  'asg_with_session_no_draft', (
    select count(*)::int from public.evaluation_assignments a
    where exists (select 1 from public.evaluation_sessions s where s.assignment_id=a.id)
      and not exists (select 1 from public.evaluation_drafts d where d.assignment_id=a.id)
  ),
  'drafts', (select count(*)::int from public.evaluation_drafts),
  'answers', (select count(*)::int from public.evaluation_answers),
  'results', (select count(*)::int from public.evaluation_results),
  'wa_active', (select count(*)::int from public.worker_accounts where is_active),
  'company_total', (select total_trabajadores from public.company_settings limit 1),
  'company_rfc_null', (select (rfc is null) from public.company_settings limit 1),
  'campaigns_not_closed', (select count(*)::int from public.evaluation_campaigns where status <> 'closed')
) as d;
`);
  const before = beforeRow.d as Record<string, unknown>;

  const plan = {
    ok: true,
    dryRun: !execute,
    refSanitized: sanitized,
    before,
    actions: {
      companyUpdate: {
        razon_social: COMPANY_INTERNAL,
        total_trabajadores: 83,
        nullables: [
          "rfc",
          "domicilio",
          "telefono",
          "actividad_principal",
          "responsable_nombre",
          "responsable_email",
          "responsable_telefono",
        ],
      },
      deleteAssignmentsNoActivity: before.asg_no_activity,
      revokeAssignmentsWithDraft: before.asg_with_draft,
      preserveDrafts: before.drafts,
      deactivateSyntheticAccounts: true,
      closeLegacyCampaigns: true,
      createAuth83: false,
      openCampaign: false,
      generatePasswords: false,
    },
    guards: {
      workersNumericMustRemain: 83,
      workersToDelete: 0,
      answersExpected: 0,
      resultsExpected: 0,
      draftsToPreserve: 2,
      unexpectedSessionOnlyAssignments: before.asg_with_session_no_draft,
    },
  };

  if (Number(before.workers_numeric) !== 83) {
    throw new Error(`ABORT: workers_numeric=${before.workers_numeric} esperado 83`);
  }
  if (Number(before.asg_with_draft) !== 2) {
    throw new Error(`ABORT: asg_with_draft=${before.asg_with_draft} esperado 2`);
  }
  if (Number(before.drafts) !== 2) {
    throw new Error(`ABORT: drafts=${before.drafts} esperado 2`);
  }
  if (Number(before.answers) !== 0 || Number(before.results) !== 0) {
    throw new Error("ABORT: answers/results inesperados");
  }
  if (Number(before.asg_with_session_no_draft) !== 0) {
    throw new Error(
      `ABORT: assignments con sesión sin draft=${before.asg_with_session_no_draft} — revisar manualmente`
    );
  }
  if (Number(before.asg_no_activity) !== 165) {
    throw new Error(`ABORT: asg_no_activity=${before.asg_no_activity} esperado 165`);
  }

  if (!execute) {
    console.log(JSON.stringify({ ...plan, execute: false }, null, 2));
    return;
  }

  const sql = `
begin;

update public.company_settings
set
  razon_social = '${COMPANY_INTERNAL}',
  total_trabajadores = 83,
  rfc = null,
  domicilio = null,
  telefono = null,
  actividad_principal = null,
  responsable_nombre = null,
  responsable_email = null,
  responsable_telefono = null,
  updated_at = timezone('utc', now());

create temporary table tmp_asg_delete on commit drop as
select a.id
from public.evaluation_assignments a
where not exists (select 1 from public.evaluation_sessions s where s.assignment_id = a.id)
  and not exists (select 1 from public.evaluation_answers ans where ans.assignment_id = a.id)
  and not exists (select 1 from public.evaluation_drafts d where d.assignment_id = a.id)
  and not exists (select 1 from public.evaluation_results r where r.assignment_id = a.id);

create temporary table tmp_asg_revoke on commit drop as
select a.id
from public.evaluation_assignments a
where exists (select 1 from public.evaluation_drafts d where d.assignment_id = a.id);

do $$
declare
  v_del int;
  v_rev int;
  v_drafts int;
  v_workers int;
begin
  select count(*) into v_del from tmp_asg_delete;
  select count(*) into v_rev from tmp_asg_revoke;
  select count(*) into v_drafts from public.evaluation_drafts;
  select count(*) into v_workers from public.workers where external_reference ~ '^[0-9]+$';
  if v_workers <> 83 then
    raise exception 'ABORT: workers numeric=% esperado 83', v_workers;
  end if;
  if v_rev <> 2 then
    raise exception 'ABORT: asg con draft=% esperado 2', v_rev;
  end if;
  if v_drafts <> 2 then
    raise exception 'ABORT: drafts=% esperado 2', v_drafts;
  end if;
  if v_del <> 165 then
    raise exception 'ABORT: asg_delete=% esperado 165', v_del;
  end if;
end $$;

delete from public.assignment_questionnaires where assignment_id in (select id from tmp_asg_delete);
delete from public.evaluation_sessions where assignment_id in (select id from tmp_asg_delete);
delete from public.evaluation_answers where assignment_id in (select id from tmp_asg_delete);
delete from public.evaluation_results where assignment_id in (select id from tmp_asg_delete);
delete from public.evaluation_assignments where id in (select id from tmp_asg_delete);

update public.evaluation_assignments
set
  status = 'revoked',
  revoked_at = timezone('utc', now()),
  revoked_reason = 'legacy_i_ii_preserved_draft',
  updated_at = timezone('utc', now())
where id in (select id from tmp_asg_revoke)
  and status <> 'revoked';

update public.evaluation_sessions
set revoked_at = coalesce(revoked_at, timezone('utc', now()))
where assignment_id in (select id from tmp_asg_revoke)
  and revoked_at is null;

update public.evaluation_campaigns
set
  status = 'closed',
  closed_at = coalesce(closed_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
where status <> 'closed';

update public.worker_accounts wa
set is_active = false, updated_at = timezone('utc', now())
from public.workers w
where wa.worker_id = w.id
  and (
    w.external_reference ~* 'SYN|TST-|PRUEBA|PILOT|STAGING'
    or wa.username_normalized ~* 'prueba|test|pilot|staging'
  );

update public.workers
set activo = false, updated_at = timezone('utc', now())
where external_reference ~* 'SYN|TST-|PRUEBA|PILOT|STAGING';

insert into public.audit_log (action, entity_type, entity_id, metadata)
select
  'b413_legacy_sanitized',
  'system',
  null,
  jsonb_build_object(
    'deleted_assignments', (select count(*) from tmp_asg_delete),
    'revoked_with_draft', (select count(*) from tmp_asg_revoke),
    'company', '${COMPANY_INTERNAL}',
    'total_trabajadores', 83
  );

do $$
declare
  v_workers int;
  v_asg_active int;
  v_drafts int;
  v_revoked int;
  v_total int;
  v_company int;
  v_wa_active_syn int;
begin
  select count(*) into v_workers from public.workers where external_reference ~ '^[0-9]+$';
  select count(*) into v_asg_active from public.evaluation_assignments where status in ('pending','in_progress','completed');
  select count(*) into v_drafts from public.evaluation_drafts;
  select count(*) into v_revoked from public.evaluation_assignments where status = 'revoked';
  select count(*) into v_total from public.evaluation_assignments;
  select total_trabajadores into v_company from public.company_settings limit 1;
  select count(*) into v_wa_active_syn
  from public.worker_accounts wa
  join public.workers w on w.id = wa.worker_id
  where wa.is_active and (
    w.external_reference ~* 'SYN|PRUEBA|PILOT|TST-'
    or wa.username_normalized ~* 'prueba|pilot|test'
  );

  if v_workers <> 83 then raise exception 'POST: workers=%', v_workers; end if;
  if v_company <> 83 then raise exception 'POST: company_total=%', v_company; end if;
  if v_drafts <> 2 then raise exception 'POST: drafts=%', v_drafts; end if;
  if v_revoked <> 2 then raise exception 'POST: revoked=%', v_revoked; end if;
  if v_total <> 2 then raise exception 'POST: asg_total=% esperado 2', v_total; end if;
  if v_asg_active <> 0 then raise exception 'POST: asg_active=%', v_asg_active; end if;
  if v_wa_active_syn <> 0 then raise exception 'POST: wa_active_syn=%', v_wa_active_syn; end if;
end $$;

commit;

select jsonb_build_object(
  'ok', true,
  'workers_numeric', (select count(*)::int from public.workers where external_reference ~ '^[0-9]+$'),
  'asg_total', (select count(*)::int from public.evaluation_assignments),
  'asg_revoked', (select count(*)::int from public.evaluation_assignments where status='revoked'),
  'asg_active', (select count(*)::int from public.evaluation_assignments where status in ('pending','in_progress','completed')),
  'drafts', (select count(*)::int from public.evaluation_drafts),
  'company_total', (select total_trabajadores from public.company_settings limit 1),
  'company_razon_len', (select length(razon_social) from public.company_settings limit 1),
  'company_rfc_null', (select (rfc is null) from public.company_settings limit 1),
  'company_domicilio_null', (select (domicilio is null) from public.company_settings limit 1),
  'wa_active', (select count(*)::int from public.worker_accounts where is_active),
  'campaigns_active', (select count(*)::int from public.evaluation_campaigns where status='active')
) as result;
`;

  mkdirSync(resolve(".tmp"), { recursive: true });
  const path = resolve(".tmp", "b413-execute.sql");
  writeFileSync(path, sql, { mode: 0o600 });
  const raw = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", path],
    { encoding: "utf8", env: process.env }
  ).replace(/\u001b\[[0-9;]*m/g, "");
  const parsed = JSON.parse(raw) as { rows: Array<{ result?: unknown }> };
  console.log(
    JSON.stringify(
      {
        ok: true,
        execute: true,
        refSanitized: sanitized,
        before,
        result: parsed.rows?.[parsed.rows.length - 1]?.result ?? parsed.rows?.[0],
        passwordPrinted: false,
        accountsCreated: 0,
        campaignOpened: false,
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
