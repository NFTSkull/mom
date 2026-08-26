/**
 * B4.23 — Cierre controlado + desactivar workers reales + revocar sesiones.
 *
 * Dry-run:
 *   ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY NOM035_TARGET_ENV=production \
 *   EXPECTED_… CONFIRM_… SUPABASE_DB_PASSWORD=… \
 *   npx tsx scripts/b423-close-campaign.ts
 *
 * Execute:
 *   … B423_PRE_BACKUP_SHA=<sha> B423_EXECUTE=1 npx tsx scripts/b423-close-campaign.ts
 */
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";

const REAL_CAMPAIGN = "Evaluación NOM-035 2026";

function sqlJson(q: string): Record<string, unknown> {
  const path = resolve(".tmp", `b423-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  mkdirSync(resolve(".tmp"), { recursive: true });
  writeFileSync(path, q, { mode: 0o600 });
  try {
    const raw = execFileSync(
      "npx",
      ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", path],
      { encoding: "utf8", env: process.env }
    ).replace(/\u001b\[[0-9;]*m/g, "");
    return (JSON.parse(raw) as { rows: Array<Record<string, unknown>> }).rows?.[0] ?? {};
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
  if (!process.env.SUPABASE_DB_PASSWORD) throw new Error("SUPABASE_DB_PASSWORD ausente");
  const { sanitized } = assertProductionPilotGuards({
    url: env.NEXT_PUBLIC_SUPABASE_URL!,
    env: {
      ...env,
      ALLOW_PRODUCTION_PILOT: process.env.ALLOW_PRODUCTION_PILOT,
      CONFIRM_SUPABASE_PROJECT_REF: process.env.CONFIRM_SUPABASE_PROJECT_REF,
      EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
      NOM035_TARGET_ENV: process.env.NOM035_TARGET_ENV ?? "production",
    },
  });

  const execute = process.env.B423_EXECUTE === "1";
  const snap = (sqlJson(`
select jsonb_build_object(
  'status', (select status::text from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'campaignId', (select id::text from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'testWorkers', (select count(*)::int from public.workers where is_test),
  'realMarkedTest', (select count(*)::int from public.workers where is_test and external_reference ~ '^[0-9]+$'),
  'asgReal', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id join public.workers w on w.id=ea.worker_id where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)),
  'pending', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id join public.workers w on w.id=ea.worker_id where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false) and ea.status='pending'),
  'inProgress', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id join public.workers w on w.id=ea.worker_id where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false) and ea.status='in_progress'),
  'completed', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id join public.workers w on w.id=ea.worker_id where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false) and ea.status='completed'),
  'resultsReal', (select count(*)::int from public.evaluation_results er join public.evaluation_campaigns c on c.id=er.campaign_id join public.workers w on w.id=er.worker_id where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)),
  'resultsTest', (select count(*)::int from public.evaluation_results er join public.workers w on w.id=er.worker_id where w.is_test),
  'waActiveReal', (select count(*)::int from public.worker_accounts wa join public.workers w on w.id=wa.worker_id where wa.is_active and not coalesce(w.is_test,false) and w.external_reference ~ '^[0-9]+$'),
  'answers', (select count(*)::int from public.evaluation_answers a join public.evaluation_assignments ea on ea.id=a.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'results', (select count(*)::int from public.evaluation_results er join public.evaluation_campaigns c on c.id=er.campaign_id where c.nombre='${REAL_CAMPAIGN}')
) as d;`).d ?? {}) as Record<string, unknown>;

  const report: Record<string, unknown> = {
    block: "B4.23",
    refSanitized: sanitized,
    dryRun: !execute,
    TARGET_CAMPAIGN: REAL_CAMPAIGN,
    CURRENT_STATUS: snap.status,
    TARGET_STATUS: "closed",
    ROWS_TO_UPDATE: snap.status === "active" ? 1 : 0,
    snapshot: snap,
    concasaTouched: false,
  };

  if (Number(snap.realMarkedTest ?? 0) !== 0) {
    report.veredicto = "ABORT — REAL_WORKERS_MARKED_TEST != 0";
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  if (snap.status !== "active") {
    report.veredicto = "ABORT — campaña no está active";
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  if (Number(snap.waActiveReal ?? 0) !== 83) {
    report.veredicto = `ABORT — waActiveReal=${snap.waActiveReal} esperado 83`;
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  if (!execute) {
    report.veredicto = "DRY-RUN OK — listo para B423_EXECUTE=1 (+ B423_PRE_BACKUP_SHA)";
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const sha = (process.env.B423_PRE_BACKUP_SHA ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha)) {
    throw new Error("ABORT: falta B423_PRE_BACKUP_SHA");
  }
  report.preBackupSha = sha;

  const closedAt = new Date().toISOString();
  const campaignId = String(snap.campaignId);
  const closeSql = `
begin;
do $$
declare
  v_updated int;
begin
  update public.evaluation_campaigns
  set status = 'closed',
      closed_at = '${closedAt}'::timestamptz,
      updated_at = timezone('utc', now())
  where nombre = '${REAL_CAMPAIGN}'
    and status = 'active';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'ABORT: rows_updated=% esperado 1', v_updated;
  end if;

  update public.worker_accounts wa
  set is_active = false,
      updated_at = timezone('utc', now())
  from public.workers w
  where wa.worker_id = w.id
    and wa.is_active = true
    and coalesce(w.is_test, false) = false
    and w.external_reference ~ '^[0-9]+$';

  if (select count(*) from public.worker_accounts wa
      join public.workers w on w.id=wa.worker_id
      where wa.is_active and coalesce(w.is_test,false)=false
        and w.external_reference ~ '^[0-9]+$') <> 0 then
    raise exception 'ABORT: ACTIVE_REAL_WORKER_ACCOUNTS != 0';
  end if;

  insert into public.audit_log(action, entity_type, entity_id, metadata)
  values (
    'b423_campaign_closed_workers_deactivated',
    'evaluation_campaign',
    '${campaignId}'::uuid,
    jsonb_build_object(
      'closedAt', '${closedAt}',
      'deactivateRealWorkers', 83,
      'preBackupShaPrefix', left('${sha}', 12)
    )
  );
end $$;
commit;

select jsonb_build_object(
  'status', status::text,
  'closed_at', closed_at
) as d from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}';
`;
  const path = resolve(".tmp", "b423-close.sql");
  writeFileSync(path, closeSql, { mode: 0o600 });
  const raw = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", path],
    { encoding: "utf8", env: process.env }
  ).replace(/\u001b\[[0-9;]*m/g, "");
  const parsed = JSON.parse(raw) as { rows: Array<{ d?: unknown }> };
  report.afterClose = parsed.rows?.[parsed.rows.length - 1]?.d ?? parsed.rows?.[0];

  // Revocar sesiones Auth de workers reales
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: class {} as never },
  });
  const authIds = (
    sqlJson(`
select coalesce(jsonb_agg(wa.auth_user_id::text), '[]'::jsonb) as d
from public.worker_accounts wa
join public.workers w on w.id=wa.worker_id
where coalesce(w.is_test,false)=false and w.external_reference ~ '^[0-9]+$';
    `).d ?? []
  ) as string[];

  let revoked = 0;
  let revokeErrors = 0;
  for (const id of authIds) {
    const { error } = await admin.auth.admin.signOut(id, "global");
    if (error) revokeErrors += 1;
    else revoked += 1;
  }
  // Also delete sessions table rows if accessible
  sqlJson(`
delete from auth.sessions s
using public.worker_accounts wa
join public.workers w on w.id=wa.worker_id
where s.user_id = wa.auth_user_id
  and coalesce(w.is_test,false)=false
  and w.external_reference ~ '^[0-9]+$';
select jsonb_build_object(
  'sessionsLeft', (
    select count(*)::int from auth.sessions s
    join public.worker_accounts wa on wa.auth_user_id=s.user_id
    join public.workers w on w.id=wa.worker_id
    where coalesce(w.is_test,false)=false and w.external_reference ~ '^[0-9]+$'
  )
) as d;
`);

  const finalSnap = (sqlJson(`
select jsonb_build_object(
  'status', (select status::text from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'closed_at', (select closed_at from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'waActiveReal', (select count(*)::int from public.worker_accounts wa join public.workers w on w.id=wa.worker_id where wa.is_active and not coalesce(w.is_test,false) and w.external_reference ~ '^[0-9]+$'),
  'answers', (select count(*)::int from public.evaluation_answers a join public.evaluation_assignments ea on ea.id=a.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'results', (select count(*)::int from public.evaluation_results er join public.evaluation_campaigns c on c.id=er.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'resultsReal', (select count(*)::int from public.evaluation_results er join public.evaluation_campaigns c on c.id=er.campaign_id join public.workers w on w.id=er.worker_id where c.nombre='${REAL_CAMPAIGN}' and not coalesce(w.is_test,false)),
  'resultsTestStored', (select count(*)::int from public.evaluation_results er join public.workers w on w.id=er.worker_id where w.is_test),
  'sessionsReal', (
    select count(*)::int from auth.sessions s
    join public.worker_accounts wa on wa.auth_user_id=s.user_id
    join public.workers w on w.id=wa.worker_id
    where coalesce(w.is_test,false)=false and w.external_reference ~ '^[0-9]+$'
  )
) as d;`).d ?? {}) as Record<string, unknown>;

  report.sessionRevoke = { attempted: authIds.length, revoked, revokeErrors };
  report.final = finalSnap;
  report.answersDeleted = Number(snap.answers) - Number(finalSnap.answers);
  report.resultsDeleted = Number(snap.results) - Number(finalSnap.results);
  report.veredicto =
    "CAMPAÑA NOM-035 CERRADA — HISTÓRICO PROTEGIDO — USUARIO DE PRUEBA EXCLUIDO DE MÉTRICAS";
  console.log(JSON.stringify(report, null, 2));
  if (Number(finalSnap.waActiveReal) !== 0 || Number(finalSnap.sessionsReal) !== 0) {
    process.exit(2);
  }
  if (Number(report.answersDeleted) !== 0 || Number(report.resultsDeleted) !== 0) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
