/**
 * B4.17 — Apertura controlada de la campaña real (draft → active).
 *
 * Dry-run (default):
 *   ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY NOM035_TARGET_ENV=production \
 *   EXPECTED_… CONFIRM_… SUPABASE_DB_PASSWORD=… \
 *   npx tsx scripts/b417-open-real-campaign.ts
 *
 * Ejecutar SOLO si precondiciones MFA/AAL2/backup PASS:
 *   … B417_EXECUTE=1 npx tsx scripts/b417-open-real-campaign.ts
 *
 * No imprime secrets. No toca ConCasa. No modifica passwords/assignments.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";

const REAL_CAMPAIGN = "Evaluación NOM-035 2026";

function sqlOne(q: string): Record<string, unknown> {
  const path = resolve(".tmp", `b417-${Date.now()}.sql`);
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

function backupPolicyAccepted(): boolean {
  const p = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-secrets/backup-policy-accepted.txt"
  );
  if (!existsSync(p)) return false;
  const v = readFileSync(p, "utf8").trim().toUpperCase();
  return ["TRUE", "YES", "1", "ACCEPTED", "RIESGO TEMPORAL ACEPTADO"].includes(v);
}

function preconditions() {
  const row = (
    sqlOne(`
select jsonb_build_object(
  'MFA_FACTORS_VERIFIED', (select count(*)::int from auth.mfa_factors where status='verified'),
  'admin_active', (select count(*)::int from public.admin_profiles where active),
  'mfa_required_true', (select count(*)::int from public.admin_profiles where active and coalesce(mfa_required,false)=true),
  'campaign_status', (select status::text from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'activated_at_null', (select activated_at is null from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}')
) as d;
`).d ?? {}
  ) as Record<string, unknown>;

  const mfaFactors = Number(row.MFA_FACTORS_VERIFIED ?? 0);
  const mfaRequired = Number(row.mfa_required_true ?? 0) > 0;
  const backupOk = backupPolicyAccepted();
  const pitrEnabled = process.env.PITR_ENABLED === "true"; // solo si operación lo setea tras verificación Dashboard
  // AAL2 no medible sin sesión admin; con MFA factors=0 es imposible AAL2=true.
  const adminAal2 = mfaFactors >= 1 && process.env.ADMIN_AAL2_VERIFIED === "true";

  const blockers: string[] = [];
  if (mfaFactors < 1) blockers.push("MFA_FACTORS_VERIFIED < 1");
  if (!adminAal2) blockers.push("ADMIN_AAL2 != true");
  if (!mfaRequired) blockers.push("mfa_required != true");
  if (!pitrEnabled && !backupOk) blockers.push("PITR_ENABLED=false y BACKUP_POLICY_ACCEPTED=false");

  return {
    MFA_FACTORS_VERIFIED: mfaFactors,
    ADMIN_AAL2: adminAal2,
    MFA_REQUIRED: mfaRequired,
    PITR_ENABLED: pitrEnabled,
    BACKUP_POLICY_ACCEPTED: backupOk,
    campaignStatus: row.campaign_status,
    activatedAtNull: row.activated_at_null,
    adminActive: row.admin_active,
    blockers,
    ok: blockers.length === 0,
  };
}

function dryRunCounts() {
  return (
    sqlOne(`
select jsonb_build_object(
  'campaigns_named', (select count(*)::int from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'status', (select status::text from public.evaluation_campaigns where nombre='${REAL_CAMPAIGN}'),
  'assignments', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'pending', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and ea.status='pending'),
  'dup_workers', (select count(*)::int from (
     select ea.worker_id from public.evaluation_assignments ea
     join public.evaluation_campaigns c on c.id=ea.campaign_id
     where c.nombre='${REAL_CAMPAIGN}' group by ea.worker_id having count(*)>1
  ) d),
  'sessions', (select count(*)::int from public.evaluation_sessions es join public.evaluation_assignments ea on ea.id=es.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'answers', (select count(*)::int from public.evaluation_answers a join public.evaluation_assignments ea on ea.id=a.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'results', (select count(*)::int from public.evaluation_results er join public.evaluation_campaigns c on c.id=er.campaign_id where c.nombre='${REAL_CAMPAIGN}'),
  'guia_i', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_I'),
  'guia_ii', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_II'),
  'guia_iii', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_III')
) as d;
`).d ?? {}
  );
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
  const pre = preconditions();
  const counts = dryRunCounts() as Record<string, unknown>;

  const report: Record<string, unknown> = {
    block: "B4.17",
    refSanitized: sanitized,
    dryRun: !execute,
    campaign: REAL_CAMPAIGN,
    preconditions: pre,
    dryRunCounts: counts,
    campaignOpened: false,
    passwordsModified: 0,
    usernamesModified: 0,
    concasaTouched: false,
    credentialsDelivered: false,
  };

  if (!pre.ok) {
    report.veredicto = "APERTURA BLOQUEADA";
    report.reason = pre.blockers;
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  if (
    counts.campaigns_named !== 1 ||
    counts.status !== "draft" ||
    Number(counts.assignments) !== 83 ||
    Number(counts.pending) !== 83 ||
    Number(counts.dup_workers) !== 0 ||
    Number(counts.sessions) !== 0 ||
    Number(counts.answers) !== 0 ||
    Number(counts.results) !== 0
  ) {
    report.veredicto = "APERTURA BLOQUEADA";
    report.reason = ["dry-run counts mismatch"];
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  if (!execute) {
    report.veredicto = "DRY-RUN OK — listo para B417_EXECUTE=1";
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Abrir: status=active, activated_at=now() (columna real; no opened_at)
  const openedAt = new Date().toISOString();
  const sql = `
begin;
update public.evaluation_campaigns
set status = 'active',
    activated_at = '${openedAt}'::timestamptz,
    updated_at = timezone('utc', now())
where nombre = '${REAL_CAMPAIGN}'
  and status = 'draft'
  and activated_at is null;
do $$
declare n int;
begin
  get diagnostics n = row_count;
  -- row_count after UPDATE in DO is not portable; re-check:
  select count(*) into n from public.evaluation_campaigns
   where nombre='${REAL_CAMPAIGN}' and status='active' and activated_at is not null;
  if n <> 1 then
    raise exception 'ABORT: active count=% esperado 1', n;
  end if;
end $$;
commit;
select jsonb_build_object(
  'status', status,
  'activated_at', activated_at
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
  report.veredicto = "CAMPAÑA ABIERTA — LISTA PARA 83 TRABAJADORES";
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
