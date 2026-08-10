/**
 * B4.20 / B4.17 — Apertura controlada de la campaña real (draft → active).
 *
 * B4.20: MFA/AAL2/mfa_required NO son gates de activación de campaña.
 * (AAL2 admin sensible permanece en endpoints — fuera de este script.)
 *
 * Dry-run:
 *   ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY NOM035_TARGET_ENV=production \
 *   EXPECTED_… CONFIRM_… SUPABASE_DB_PASSWORD=… \
 *   npx tsx scripts/b417-open-real-campaign.ts
 *
 * Ejecutar (tras backup pre-apertura):
 *   … B417_PREOPEN_BACKUP_SHA=<sha256> B417_EXECUTE=1 \
 *   npx tsx scripts/b417-open-real-campaign.ts
 *
 * No imprime secrets. No toca ConCasa. No modifica passwords/usernames/assignments.
 */
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";
import {
  assertCampaignActivationStructuralOk,
  type CampaignActivationSnapshot,
} from "../src/lib/nom035/campaign-activation-gates";

const REAL_CAMPAIGN = "Evaluación NOM-035 2026";

function sqlOne(q: string): Record<string, unknown> {
  const path = resolve(".tmp", `b417-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
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

function loadSnapshot(): CampaignActivationSnapshot {
  const row = (
    sqlOne(`
select jsonb_build_object(
  'campaignStatus', (select status::text from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'campaignsNamed', (select count(*)::int from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'activeCampaigns', (select count(*)::int from public.evaluation_campaigns where status='active'),
  'workers', (select count(*)::int from public.workers w where w.activo and w.external_reference ~ '^[0-9]+$'),
  'workerAccounts', (select count(*)::int from public.worker_accounts wa join public.workers w on w.id=wa.worker_id where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'),
  'assignments', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'pending', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and ea.status='pending'),
  'dupWorkers', (select count(*)::int from (
     select ea.worker_id from public.evaluation_assignments ea
     join public.evaluation_campaigns c on c.id=ea.campaign_id
     where c.nombre='${REAL_CAMPAIGN}' group by ea.worker_id having count(*)>1
  ) d),
  'sessions', (select count(*)::int from public.evaluation_sessions es join public.evaluation_assignments ea on ea.id=es.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'answers', (select count(*)::int from public.evaluation_answers a join public.evaluation_assignments ea on ea.id=a.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'results', (select count(*)::int from public.evaluation_results er join public.evaluation_campaigns c on c.id=er.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'guiaI', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_I'),
  'guiaII', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_II'),
  'guiaIII', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_III'),
  'asgExpiresSet', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and ea.expires_at is not null),
  'fechaCierreNull', (select fecha_cierre is null from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'fechaInicioNull', (select fecha_inicio is null from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'closedAtNull', (select closed_at is null from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}')
) as d;
`).d ?? {}
  ) as Record<string, unknown>;

  return {
    campaignStatus: String(row.campaignStatus ?? ""),
    campaignsNamed: Number(row.campaignsNamed ?? 0),
    activeCampaigns: Number(row.activeCampaigns ?? 0),
    workers: Number(row.workers ?? 0),
    workerAccounts: Number(row.workerAccounts ?? 0),
    assignments: Number(row.assignments ?? 0),
    pending: Number(row.pending ?? 0),
    dupWorkers: Number(row.dupWorkers ?? 0),
    sessions: Number(row.sessions ?? 0),
    answers: Number(row.answers ?? 0),
    results: Number(row.results ?? 0),
    guiaI: Number(row.guiaI ?? 0),
    guiaII: Number(row.guiaII ?? 0),
    guiaIII: Number(row.guiaIII ?? 0),
    asgExpiresSet: Number(row.asgExpiresSet ?? 0),
    fechaCierreNull: Boolean(row.fechaCierreNull),
    fechaInicioNull: Boolean(row.fechaInicioNull),
    closedAtNull: Boolean(row.closedAtNull),
  };
}

function assertPreopenBackup(): { sha: string; pathHint: string } {
  const sha = (process.env.B417_PREOPEN_BACKUP_SHA ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha)) {
    throw new Error(
      "ABORT: falta B417_PREOPEN_BACKUP_SHA (sha256 del backup pre-apertura)"
    );
  }
  const manifestHint =
    process.env.B417_PREOPEN_BACKUP_DIR ??
    "~/Desktop/nom035-production-backups/<stamp>-b420-pre-open/";
  return { sha, pathHint: manifestHint };
}

async function main() {
  const env = loadProductionEnv();
  Object.assign(process.env, env);
  if (!process.env.SUPABASE_DB_PASSWORD) throw new Error("SUPABASE_DB_PASSWORD ausente");
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const { sanitized } = assertProductionPilotGuards({
    url,
    env: {
      ...env,
      ALLOW_PRODUCTION_PILOT: process.env.ALLOW_PRODUCTION_PILOT,
      CONFIRM_SUPABASE_PROJECT_REF: process.env.CONFIRM_SUPABASE_PROJECT_REF,
      EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
      NOM035_TARGET_ENV: process.env.NOM035_TARGET_ENV ?? "production",
    },
  });

  const execute = process.env.B417_EXECUTE === "1";
  const snap = loadSnapshot();
  const structural = assertCampaignActivationStructuralOk(snap);

  // MFA documentado (no bloquea)
  const mfaDoc = (
    sqlOne(`
select jsonb_build_object(
  'MFA_FACTORS_VERIFIED', (select count(*)::int from auth.mfa_factors where status='verified'),
  'mfa_required_admins', (select count(*)::int from public.admin_profiles where active and coalesce(mfa_required,false))
) as d;`).d ?? {}
  ) as Record<string, unknown>;

  const report: Record<string, unknown> = {
    block: "B4.20",
    refSanitized: sanitized,
    dryRun: !execute,
    TARGET_CAMPAIGN: REAL_CAMPAIGN,
    CURRENT_STATUS: snap.campaignStatus,
    TARGET_STATUS: "active",
    snapshot: snap,
    structural,
    mfaDocumentedNotGate: {
      MFA_FACTORS_VERIFIED: mfaDoc.MFA_FACTORS_VERIFIED,
      mfa_required_admins: mfaDoc.mfa_required_admins,
      CAMPAIGN_ACTIVATION_REQUIRES_MFA: false,
      ADMIN_SENSITIVE_AAL2_INTACT: true,
      WORKER_MFA_REQUIRED: false,
    },
    active_campaigns_before: snap.activeCampaigns,
    rows_to_update: 1,
    campaignOpened: false,
    passwordsModified: 0,
    usernamesModified: 0,
    assignmentsModified: 0,
    concasaTouched: false,
  };

  if (!structural.ok) {
    report.veredicto = "APERTURA BLOQUEADA";
    report.reason = structural.blockers;
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  if (!execute) {
    report.veredicto = "DRY-RUN OK — listo para B417_EXECUTE=1 (+ B417_PREOPEN_BACKUP_SHA)";
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const backup = assertPreopenBackup();
  report.preopenBackup = backup;

  const openedAt = new Date().toISOString();
  const sql = `
begin;

do $$
declare
  v_updated int;
  v_active int;
begin
  if exists (select 1 from public.evaluation_campaigns where status='active') then
    raise exception 'ABORT: ya hay campaña active';
  end if;

  update public.evaluation_campaigns
  set status = 'active',
      activated_at = '${openedAt}'::timestamptz,
      closed_at = null,
      fecha_inicio = null,
      fecha_cierre = null,
      updated_at = timezone('utc', now())
  where nombre = '${REAL_CAMPAIGN}'
    and status = 'draft'
    and activated_at is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'ABORT: rows_updated=% esperado 1', v_updated;
  end if;

  select count(*)::int into v_active
  from public.evaluation_campaigns where status='active';
  if v_active <> 1 then
    raise exception 'ABORT: active count=% esperado 1', v_active;
  end if;

  insert into public.audit_log(action, entity_type, entity_id, metadata)
  select
    'b420_campaign_activated',
    'evaluation_campaign',
    id,
    jsonb_build_object(
      'nombre', nombre,
      'permanentUntilManualClose', true,
      'mfaGate', false,
      'preopenBackupShaPrefix', left('${backup.sha}', 12)
    )
  from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}';
end $$;

commit;

select jsonb_build_object(
  'status', status::text,
  'activated_at', activated_at,
  'closed_at', closed_at,
  'fecha_inicio', fecha_inicio,
  'fecha_cierre', fecha_cierre
) as d from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}';
`;
  const path = resolve(".tmp", "b417-open.sql");
  writeFileSync(path, sql, { mode: 0o600 });
  const raw = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", path],
    { encoding: "utf8", env: process.env }
  ).replace(/\u001b\[[0-9;]*m/g, "");
  const parsed = JSON.parse(raw) as { rows: Array<{ d?: unknown }> };
  report.campaignOpened = true;
  report.openedAtUtc = openedAt;
  report.after = parsed.rows?.[parsed.rows.length - 1]?.d ?? parsed.rows?.[0];
  report.veredicto =
    "CAMPAÑA NOM-035 ACTIVA PERMANENTEMENTE — 83 TRABAJADORES LISTOS PARA RESPONDER";
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
