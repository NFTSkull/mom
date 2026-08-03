/**
 * B4.15.1 — Quitar must_change_password obligatorio en los 83 workers reales.
 *
 * Dry-run (default):
 *   ALLOW_PRODUCTION_ACCOUNTS=B414_CREATE_83 NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   npx tsx scripts/b4151-clear-must-change-password.ts
 *
 * Ejecutar:
 *   … B4151_EXECUTE=1 npx tsx scripts/b4151-clear-must-change-password.ts
 *
 * No toca Auth passwords, usernames, admin ni ConCasa.
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

const ALLOW = "B414_CREATE_83"; // reutilizar allow ya usado para mutaciones de cuentas worker

function assertAllow(env: Record<string, string | undefined>) {
  if ((env.ALLOW_PRODUCTION_ACCOUNTS ?? "").trim() !== ALLOW) {
    throw new Error(`ABORT: falta ALLOW_PRODUCTION_ACCOUNTS=${ALLOW}`);
  }
  if ((env.NOM035_TARGET_ENV ?? "").trim() !== "production") {
    throw new Error("ABORT: NOM035_TARGET_ENV=production requerido");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlRef = extractProjectRefFromUrl(url);
  const expected = resolveExpectedProjectRef(env);
  const confirmed = (env.CONFIRM_SUPABASE_PROJECT_REF ?? "").trim();
  assertRefsMatch({ urlRef, expected, confirmed });
  return { sanitized: sanitizeRef(urlRef) };
}

function queryOne(sql: string): Record<string, unknown> {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const path = resolve(".tmp", `b4151-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(path, sql, { mode: 0o600 });
  try {
    const raw = execFileSync(
      "npx",
      ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", path],
      { encoding: "utf8", env: process.env }
    ).replace(/\u001b\[[0-9;]*m/g, "");
    const parsed = JSON.parse(raw) as { rows: Array<Record<string, unknown>> };
    return parsed.rows?.[0] ?? {};
  } finally {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const env = loadProductionEnv();
  Object.assign(process.env, env);
  const merged = {
    ...env,
    ALLOW_PRODUCTION_ACCOUNTS: process.env.ALLOW_PRODUCTION_ACCOUNTS,
    CONFIRM_SUPABASE_PROJECT_REF: process.env.CONFIRM_SUPABASE_PROJECT_REF,
    EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
    NOM035_TARGET_ENV: process.env.NOM035_TARGET_ENV ?? "production",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
  };
  if (!process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("SUPABASE_DB_PASSWORD ausente");
  }
  const { sanitized } = assertAllow(merged);
  const execute = process.env.B4151_EXECUTE === "1";

  const before = queryOne(`
select jsonb_build_object(
  'company', (select razon_social from public.company_settings limit 1),
  'wa_active_numeric', (
    select count(*)::int from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'
  ),
  'must_true', (
    select count(*)::int from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'
      and wa.must_change_password = true
  ),
  'must_false', (
    select count(*)::int from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'
      and wa.must_change_password = false
  ),
  'syn_must_true', (
    select count(*)::int from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where wa.must_change_password = true
      and (
        w.external_reference ~* 'SYN|TST-|PRUEBA|PILOT|STAGING'
        or wa.username_normalized ~* 'prueba|test|pilot|staging'
      )
  ),
  'admin_must_true', (
    select count(*)::int from public.admin_profiles where must_change_password = true
  ),
  'admins', (select count(*)::int from public.admin_profiles)
) as d;
`).d as Record<string, unknown>;

  if (String(before.company) !== "NOM035_EMPRESA_OPERATIVA") {
    throw new Error(`ABORT: company inesperada len=${String(before.company).length}`);
  }
  if (Number(before.wa_active_numeric) !== 83) {
    throw new Error(`ABORT: wa_active_numeric=${before.wa_active_numeric}`);
  }
  if (Number(before.must_true) !== 83 && execute) {
    // Allow re-run if already cleared (must_true=0)
    if (Number(before.must_true) !== 0) {
      throw new Error(`ABORT: must_true=${before.must_true} esperado 83 o 0`);
    }
  }

  const toUpdate = Number(before.must_true);
  const plan = {
    ok: true,
    dryRun: !execute,
    refSanitized: sanitized,
    before,
    accountsToUpdate: toUpdate,
    adminsToUpdate: 0,
    syntheticToUpdate: 0,
    legacyToUpdate: 0,
    passwordsTouched: false,
    usernamesTouched: false,
  };

  if (!execute) {
    if (toUpdate !== 83 && toUpdate !== 0) {
      throw new Error(`ABORT dry-run: must_true=${toUpdate}`);
    }
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (toUpdate === 0) {
    console.log(JSON.stringify({ ...plan, message: "idempotent_noop", rowsUpdated: 0 }, null, 2));
    return;
  }

  const sql = `
begin;

-- Default futuro
alter table public.worker_accounts
  alter column must_change_password set default false;

create temporary table tmp_wa_clear on commit drop as
select wa.id
from public.worker_accounts wa
join public.workers w on w.id = wa.worker_id
join public.company_settings cs on cs.id = wa.company_id
where wa.is_active
  and wa.must_change_password = true
  and w.activo
  and w.external_reference ~ '^[0-9]+$'
  and cs.razon_social = 'NOM035_EMPRESA_OPERATIVA';

do $$
declare v_n int;
begin
  select count(*) into v_n from tmp_wa_clear;
  if v_n <> 83 then
    raise exception 'ABORT: filas a actualizar=% esperado 83', v_n;
  end if;
end $$;

update public.worker_accounts wa
set
  must_change_password = false,
  updated_at = timezone('utc', now())
where wa.id in (select id from tmp_wa_clear);

insert into public.audit_log (action, entity_type, entity_id, metadata)
select
  'b4151_clear_must_change_password',
  'system',
  null,
  jsonb_build_object('updated', 83, 'passwords_touched', false);

do $$
declare
  v_true int;
  v_false int;
  v_users int;
  v_auth int;
begin
  select count(*) into v_true
  from public.worker_accounts wa
  join public.workers w on w.id = wa.worker_id
  where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'
    and wa.must_change_password;
  select count(*) into v_false
  from public.worker_accounts wa
  join public.workers w on w.id = wa.worker_id
  where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'
    and not wa.must_change_password;
  select count(distinct wa.username_normalized) into v_users
  from public.worker_accounts wa
  join public.workers w on w.id = wa.worker_id
  where wa.is_active and w.external_reference ~ '^[0-9]+$';
  select count(distinct wa.auth_user_id) into v_auth
  from public.worker_accounts wa
  join public.workers w on w.id = wa.worker_id
  where wa.is_active and w.external_reference ~ '^[0-9]+$';

  if v_true <> 0 then raise exception 'POST: must_true=%', v_true; end if;
  if v_false <> 83 then raise exception 'POST: must_false=%', v_false; end if;
  if v_users <> 83 then raise exception 'POST: usernames=%', v_users; end if;
  if v_auth <> 83 then raise exception 'POST: auth_ids=%', v_auth; end if;
end $$;

commit;

select jsonb_build_object(
  'ok', true,
  'rowsUpdated', 83,
  'must_true', (
    select count(*)::int from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'
      and wa.must_change_password
  ),
  'must_false', (
    select count(*)::int from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'
      and not wa.must_change_password
  ),
  'usernames_unique', (
    select count(distinct username_normalized)::int from public.worker_accounts wa
    join public.workers w on w.id = wa.worker_id
    where wa.is_active and w.external_reference ~ '^[0-9]+$'
  ),
  'admin_must_true', (select count(*)::int from public.admin_profiles where must_change_password)
) as result;
`;

  const path = resolve(".tmp", "b4151-execute.sql");
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
        passwordsModified: 0,
        usernamesModified: 0,
        authUserIdsModified: 0,
        adminModified: false,
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
