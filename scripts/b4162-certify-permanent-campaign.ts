/**
 * B4.16.2 — Certificar campaña permanente (solo lectura Production).
 * NO abre la campaña. NO cambia passwords/usernames/assignments.
 *
 *   ALLOW_PRODUCTION_ACCOUNTS=B4162_CERTIFY NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   npx tsx scripts/b4162-certify-permanent-campaign.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadProductionEnv,
  sanitizeRef,
  resolveExpectedProjectRef,
  assertRefsMatch,
  extractProjectRefFromUrl,
} from "./lib/assert-production-only";
import {
  assertNoTimeBasedCampaignExpiry,
  checkAssignmentUsableAt,
} from "../src/lib/nom035/campaign-permanence";

const ALLOW = "B4162_CERTIFY";
const REAL = "Evaluación NOM-035 2026";

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
  if (urlRef.startsWith("fvtq")) throw new Error("ABORT: ConCasa");
  return { sanitized: sanitizeRef(urlRef) };
}

function sqlJson(file: string): Record<string, unknown> {
  const out = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  const parsed = JSON.parse(out) as { rows?: Array<{ d?: Record<string, unknown> }> };
  return (parsed.rows?.[0]?.d ?? {}) as Record<string, unknown>;
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
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
  };
  const { sanitized } = assertAllow(merged);

  if (!process.env.SUPABASE_DB_PASSWORD) {
    const p = resolve(
      process.env.HOME ?? "",
      "Desktop/nom035-production-secrets/db_password.txt"
    );
    if (existsSync(p)) process.env.SUPABASE_DB_PASSWORD = readFileSync(p, "utf8").trim();
  }

  mkdirSync(resolve(".tmp"), { recursive: true });
  const sqlPath = resolve(".tmp/b4162-cert.sql");
  writeFileSync(
    sqlPath,
    `select jsonb_build_object(
  'campaign_status', (select status::text from public.evaluation_campaigns where nombre='${REAL}' limit 1),
  'activated_at', (select activated_at is null from public.evaluation_campaigns where nombre='${REAL}' limit 1),
  'closed_at_null', (select closed_at is null from public.evaluation_campaigns where nombre='${REAL}' limit 1),
  'fecha_inicio_null', (select fecha_inicio is null from public.evaluation_campaigns where nombre='${REAL}' limit 1),
  'fecha_cierre_null', (select fecha_cierre is null from public.evaluation_campaigns where nombre='${REAL}' limit 1),
  'workers', (select count(*)::int from public.workers w where w.activo and w.external_reference ~ '^[0-9]+$'),
  'wa', (select count(*)::int from public.worker_accounts where is_active and username_normalized ~ '^[0-9]{3}$'),
  'auth', (select count(*)::int from public.worker_accounts wa join public.workers w on w.id=wa.worker_id join auth.users u on u.id=wa.auth_user_id where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'),
  'asg', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL}'),
  'asg_expires_null', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL}' and ea.expires_at is null),
  'asg_expires_set', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL}' and ea.expires_at is not null),
  'guia_i', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL}' and aq.questionnaire_type='GUIA_I'),
  'guia_ii', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL}' and aq.questionnaire_type='GUIA_II'),
  'guia_iii', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${REAL}' and aq.questionnaire_type='GUIA_III'),
  'real_campaigns', (select count(*)::int from public.evaluation_campaigns where nombre='${REAL}'),
  'check_fn', (select pg_get_functiondef('public.check_assignment_usable(public.evaluation_assignments)'::regprocedure)),
  'draft_cols', (select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='evaluation_drafts'),
  'cron_ext', (select count(*)::int from pg_extension where extname in ('pg_cron','pg_net')),
  'dup_u', (select count(*)::int from (select username_normalized from public.worker_accounts where is_active group by 1 having count(*)>1) s),
  'orphans', (select count(*)::int from public.worker_accounts wa where wa.is_active and not exists (select 1 from public.workers w where w.id=wa.worker_id and w.activo))
) as d;`
  );

  const d = sqlJson(sqlPath);
  const fn = String(d.check_fn ?? "");
  const gatesByFecha =
    /fecha_cierre\s*</.test(fn) || /fecha_inicio\s*>/.test(fn);

  const now = new Date();
  const sim = assertNoTimeBasedCampaignExpiry([1, 7, 30, 90], now);
  const completedBlocked =
    checkAssignmentUsableAt(
      {
        assignmentStatus: "completed",
        assignmentExpiresAt: null,
        workerActive: true,
        campaignStatus: "active",
      },
      now
    ) === "completed";

  const draftCols = (d.draft_cols as string[]) ?? [];
  const draftHasExpiry = draftCols.some((c) => /expir|ttl|deadline/i.test(c));

  const report = {
    ok:
      d.campaign_status === "draft" &&
      d.fecha_inicio_null === true &&
      d.fecha_cierre_null === true &&
      d.closed_at_null === true &&
      Number(d.workers) === 83 &&
      Number(d.wa) === 83 &&
      Number(d.auth) === 83 &&
      Number(d.asg) === 83 &&
      Number(d.asg_expires_null) === 83 &&
      Number(d.asg_expires_set) === 0 &&
      Number(d.guia_i) === 83 &&
      Number(d.guia_ii) === 0 &&
      Number(d.guia_iii) === 83 &&
      Number(d.real_campaigns) === 1 &&
      Number(d.cron_ext) === 0 &&
      Number(d.dup_u) === 0 &&
      Number(d.orphans) === 0 &&
      !gatesByFecha &&
      !draftHasExpiry &&
      sim.ok &&
      completedBlocked,
    refSanitized: sanitized,
    AUTO_EXPIRATION: gatesByFecha ? true : false,
    NO_TIME_BASED_EXPIRATION: !gatesByFecha && sim.ok,
    ASSIGNMENTS_DURABLE: Number(d.asg_expires_null),
    ASSIGNMENTS_EXPIRING: Number(d.asg_expires_set),
    CRON_JOBS: Number(d.cron_ext),
    campaignStillDraft: d.campaign_status === "draft",
    temporalFields: {
      campaign: ["activated_at", "closed_at", "fecha_inicio", "fecha_cierre"],
      assignment: ["expires_at (NULL en 83)"],
      session: ["expires_at (sesión navegador, no cuenta)"],
      draft: draftCols,
    },
    timeSimulation: sim.samples,
    completedProtected: completedBlocked,
    draftPersistentSchema: !draftHasExpiry,
    counts: {
      workers: d.workers,
      auth: d.auth,
      wa: d.wa,
      asg: d.asg,
      guia_i: d.guia_i,
      guia_ii: d.guia_ii,
      guia_iii: d.guia_iii,
    },
    passwordsModified: 0,
    usernamesModified: 0,
    assignmentsModified: 0,
    campaignOpened: false,
    concasa: "intact",
    verdict: "",
  };

  report.verdict = report.ok
    ? "CAMPAÑA PERMANENTE CERTIFICADA — APERTURA Y CIERRE EXCLUSIVAMENTE MANUALES"
    : "BLOQUEADO — revisar gates/fechas/conteos";

  // Avoid dumping function body
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
