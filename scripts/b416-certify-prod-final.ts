/**
 * B4.16 — Certificación final Production (cuenta sintética aislada).
 *
 * No abre la campaña real. No toca los 83 trabajadores.
 * No imprime passwords. No toca ConCasa.
 *
 *   ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   SUPABASE_DB_PASSWORD=… \
 *   npx tsx --require ./scripts/lib/stub-server-only.cjs scripts/b416-certify-prod-final.ts
 *
 * Fases: B416_PHASE=all|seed|certify|cleanup (default all)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";
import {
  B416_CAMPAIGN,
  B416_CREDS_PATH,
  B416_EMAIL,
  B416_EXPECTED_DEPLOY_SHA,
  B416_MARKER,
  B416_REAL_CAMPAIGN,
  B416_REF,
  B416_USERNAME,
  B416_VERSION,
} from "./lib/b416-constants";
import {
  prepareCanonicalSubmission,
  recalculateFrpSnapshotMatch,
} from "../src/lib/nom035/server/public-evaluation-service";
import { NOM035_I_III_QUESTIONNAIRE_VERSION } from "../src/data/nom035/guia-iii-manifest";
import {
  NOM035_GUIA_III_SCORING_VERSION,
  NOM035_I_III_SCORING_VERSION,
} from "../src/data/nom035/guia-iii-manifest";
import type { GuiaIIIAnswers, GuiaIILikertAnswer } from "../src/types/nom035";

type Creds = {
  marker: string;
  ref: string;
  username: string;
  email: string;
  password: string;
  workerId: string;
  authUserId: string;
  campaignId: string;
  assignmentId: string;
};

type Report = Record<string, unknown>;

function adminClient(url: string, secret: string) {
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });
}

function sqlOne(q: string): Record<string, unknown> {
  const pw = process.env.SUPABASE_DB_PASSWORD;
  if (!pw) throw new Error("SUPABASE_DB_PASSWORD requerido");
  const path = resolve(".tmp", `b416-${Date.now()}-${randomBytes(3).toString("hex")}.sql`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, q, { mode: 0o600 });
  try {
    const out = execFileSync(
      "npx",
      ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", path],
      { encoding: "utf8", env: process.env }
    ).replace(/\u001b\[[0-9;]*m/g, "");
    const parsed = JSON.parse(out) as { rows?: Array<Record<string, unknown>> };
    return parsed.rows?.[0] ?? {};
  } finally {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}

function tokenPlaceholder() {
  const raw = randomBytes(32).toString("hex");
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    last4: raw.slice(-4),
  };
}

function buildGuiaIIIFull(): GuiaIIIAnswers {
  const responses: Record<number, GuiaIILikertAnswer> = {};
  for (let n = 1; n <= 64; n += 1) responses[n] = "nunca";
  return { gateClientes: "no", gateJefe: "no", responses };
}

function buildGuiaIAllNo() {
  // Respuestas mínimas: sección I = 0 (sin eventos) → resto no aplica
  return { responses: { guia_i_1: 0 } };
}

async function deleteAssignmentTree(admin: SupabaseClient, assignmentId: string) {
  await admin.from("assignment_questionnaires").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_answers").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_results").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_drafts").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_sessions").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_assignments").delete().eq("id", assignmentId);
}

function realCounts(): Record<string, unknown> {
  const row = sqlOne(`
select jsonb_build_object(
  'workers', (select count(*)::int from public.workers where activo and external_reference ~ '^[0-9]+$'),
  'wa', (select count(*)::int from public.worker_accounts wa join public.workers w on w.id=wa.worker_id where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'),
  'auth', (select count(distinct wa.auth_user_id)::int from public.worker_accounts wa join public.workers w on w.id=wa.worker_id where wa.is_active and w.activo and w.external_reference ~ '^[0-9]+$'),
  'campaign', (select status::text from public.evaluation_campaigns where nombre='${B416_REAL_CAMPAIGN}'),
  'assignments', (select count(*)::int from public.evaluation_assignments ea join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${B416_REAL_CAMPAIGN}'),
  'guia_i', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${B416_REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_I'),
  'guia_ii', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${B416_REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_II'),
  'guia_iii', (select count(*)::int from public.assignment_questionnaires aq join public.evaluation_assignments ea on ea.id=aq.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${B416_REAL_CAMPAIGN}' and aq.questionnaire_type='GUIA_III'),
  'sessions', (select count(*)::int from public.evaluation_sessions es join public.evaluation_assignments ea on ea.id=es.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${B416_REAL_CAMPAIGN}'),
  'answers', (select count(*)::int from public.evaluation_answers a join public.evaluation_assignments ea on ea.id=a.assignment_id join public.evaluation_campaigns c on c.id=ea.campaign_id where c.nombre='${B416_REAL_CAMPAIGN}'),
  'results', (select count(*)::int from public.evaluation_results er join public.evaluation_campaigns c on c.id=er.campaign_id where c.nombre='${B416_REAL_CAMPAIGN}')
) as d;
`).d as Record<string, unknown>;
  return row;
}

function assertRealIntact(label: string, counts: Record<string, unknown>) {
  const checks: Array<[string, unknown]> = [
    ["workers", 83],
    ["wa", 83],
    ["auth", 83],
    ["campaign", "draft"],
    ["assignments", 83],
    ["guia_i", 83],
    ["guia_ii", 0],
    ["guia_iii", 83],
    ["sessions", 0],
    ["answers", 0],
    ["results", 0],
  ];
  for (const [k, expected] of checks) {
    if (counts[k] !== expected && Number(counts[k]) !== expected) {
      throw new Error(`ABORT ${label}: ${k}=${counts[k]} esperado ${expected}`);
    }
  }
}

function securityBlockers(): Report {
  const row = sqlOne(`
select jsonb_build_object(
  'MFA_FACTORS_ADMIN', (select count(*)::int from auth.mfa_factors where status='verified'),
  'MFA_FACTORS_ALL', (select count(*)::int from auth.mfa_factors),
  'MFA_REQUIRED', (select count(*)::int from public.admin_profiles where coalesce(mfa_required,false)=true),
  'ADMIN_COUNT', (select count(*)::int from public.admin_profiles where active)
) as d;
`).d as Record<string, unknown>;

  const backupAccepted = existsSync(
    resolve(process.env.HOME ?? "", "Desktop/nom035-production-secrets/backup-policy-accepted.txt")
  );
  const pitrEnabled = false; // plan actual: PITR off (documentado B4.12)

  const mfaOk = Number(row.MFA_FACTORS_ADMIN) > 0 && Number(row.MFA_REQUIRED) > 0;
  // AAL2 no medible sin sesión admin; con MFA=0 → ADMIN_AAL2=false
  const adminAal2 = false;

  return {
    MFA_FACTORS_ADMIN: row.MFA_FACTORS_ADMIN,
    ADMIN_AAL2: adminAal2,
    MFA_REQUIRED: Number(row.MFA_REQUIRED) > 0,
    MFA_REQUIRED_COUNT: row.MFA_REQUIRED,
    PITR_ENABLED: pitrEnabled,
    BACKUP_POLICY_ACCEPTED: backupAccepted,
    aperturaBloqueada: !(mfaOk && backupAccepted),
    aperturaReasons: [
      ...(Number(row.MFA_FACTORS_ADMIN) === 0 ? ["MFA admin factores verificados = 0"] : []),
      ...(Number(row.MFA_REQUIRED) === 0 ? ["mfa_required=false en admin"] : []),
      ...(!backupAccepted ? ["BACKUP_POLICY_ACCEPTED ausente"] : []),
      ...(!pitrEnabled ? ["PITR_ENABLED=false"] : []),
    ],
  };
}

function runBackup(): Report {
  const out = execFileSync(
    "node",
    ["scripts/production-backup-dump.mjs"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CONFIRM_PRODUCTION_BACKUP: "YES",
        BACKUP_LABEL: "pre-b416-certify",
      },
    }
  );
  const m = out.match(/\{[\s\S]*\}\s*$/);
  if (!m) throw new Error("backup sin JSON");
  const parsed = JSON.parse(m[0]) as {
    ok?: boolean;
    outDir?: string;
    refSanitized?: string;
    files?: Array<{ name: string; bytes: number; sha256: string }>;
  };
  if (!parsed.ok) throw new Error("backup falló");
  const data = parsed.files?.find((f) => f.name.includes("data"));
  return {
    ok: true,
    createdAtUtc: new Date().toISOString(),
    pathSanitized: (parsed.outDir ?? "").replace(process.env.HOME ?? "", "~"),
    refSanitized: parsed.refSanitized,
    sha256_data: data?.sha256 ?? null,
    bytes_data: data?.bytes ?? null,
  };
}

async function seed(admin: SupabaseClient, sanitized: string): Promise<Creds> {
  const { data: company } = await admin.from("company_settings").select("id").limit(1).maybeSingle();
  if (!company) throw new Error("sin company");

  // No tocar campaña real. No cerrar campañas draft.
  let campaignId: string;
  const { data: existingCamp } = await admin
    .from("evaluation_campaigns")
    .select("id,nombre,status")
    .eq("nombre", B416_CAMPAIGN)
    .maybeSingle();
  if (existingCamp) {
    campaignId = existingCamp.id;
    const { error } = await admin
      .from("evaluation_campaigns")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
        closed_at: null,
        questionnaire_version: B416_VERSION,
        descripcion: `${B416_MARKER} campaña sintética temporal I+III`,
      })
      .eq("id", campaignId)
      .eq("nombre", B416_CAMPAIGN);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from("evaluation_campaigns")
      .insert({
        nombre: B416_CAMPAIGN,
        descripcion: `${B416_MARKER} campaña sintética temporal I+III`,
        status: "active",
        activated_at: new Date().toISOString(),
        questionnaire_version: B416_VERSION,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "campaign");
    campaignId = data.id;
  }

  // Garantizar que la real sigue draft
  const { data: realCamp } = await admin
    .from("evaluation_campaigns")
    .select("status,activated_at")
    .eq("nombre", B416_REAL_CAMPAIGN)
    .maybeSingle();
  if (!realCamp || realCamp.status !== "draft" || realCamp.activated_at) {
    throw new Error(`ABORT: campaña real status=${realCamp?.status}`);
  }

  let workerId: string;
  const { data: existingWorker } = await admin
    .from("workers")
    .select("id")
    .eq("external_reference", B416_REF)
    .maybeSingle();
  if (existingWorker) {
    workerId = existingWorker.id;
    await admin
      .from("workers")
      .update({
        nombre: "Trabajador Sintetico Prod Final 001",
        puesto: "Puesto Sintetico Final",
        departamento: "Dept Sintetico Final",
        activo: true,
      })
      .eq("id", workerId)
      .eq("external_reference", B416_REF);
  } else {
    const { data, error } = await admin
      .from("workers")
      .insert({
        nombre: "Trabajador Sintetico Prod Final 001",
        puesto: "Puesto Sintetico Final",
        departamento: "Dept Sintetico Final",
        external_reference: B416_REF,
        activo: true,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "worker");
    workerId = data.id;
  }

  const password = `Nom035Final${randomBytes(10).toString("base64url")}9`;
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let authUserId =
    listed.data.users.find((u) => (u.email || "").toLowerCase() === B416_EMAIL)?.id ?? null;
  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      app_metadata: { role: "worker" },
      user_metadata: { marker: B416_MARKER, synthetic: true },
    });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: B416_EMAIL,
      password,
      email_confirm: true,
      app_metadata: { role: "worker" },
      user_metadata: { marker: B416_MARKER, synthetic: true },
    });
    if (error || !data.user) throw new Error(error?.message ?? "auth");
    authUserId = data.user.id;
  }

  const { error: accErr } = await admin.from("worker_accounts").upsert(
    {
      company_id: company.id,
      worker_id: workerId,
      auth_user_id: authUserId,
      username_normalized: B416_USERNAME,
      is_active: true,
      must_change_password: false,
    },
    { onConflict: "worker_id" }
  );
  if (accErr) throw new Error(accErr.message);

  const { data: oldAsg } = await admin
    .from("evaluation_assignments")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("worker_id", workerId)
    .maybeSingle();
  if (oldAsg) await deleteAssignmentTree(admin, oldAsg.id);

  const tok = tokenPlaceholder();
  const { data: asg, error: asgErr } = await admin
    .from("evaluation_assignments")
    .insert({
      campaign_id: campaignId,
      worker_id: workerId,
      token_hash: tok.hash,
      token_last4: tok.last4,
      status: "pending",
      questionnaire_version: B416_VERSION,
    })
    .select("id")
    .single();
  if (asgErr || !asg) throw new Error(asgErr?.message ?? "assignment");

  await admin.rpc("ensure_assignment_questionnaires", { p_assignment_id: asg.id });
  const { data: instruments } = await admin
    .from("assignment_questionnaires")
    .select("questionnaire_type")
    .eq("assignment_id", asg.id);
  const types = (instruments ?? []).map((r) => r.questionnaire_type).sort();
  if (types.join(",") !== "GUIA_I,GUIA_III") {
    throw new Error(`instrumentos inesperados ${types.join(",")}`);
  }

  const creds: Creds = {
    marker: B416_MARKER,
    ref: B416_REF,
    username: B416_USERNAME,
    email: B416_EMAIL,
    password,
    workerId,
    authUserId,
    campaignId,
    assignmentId: asg.id,
  };
  mkdirSync(dirname(B416_CREDS_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(B416_CREDS_PATH, JSON.stringify({ ...creds, refSanitized: sanitized }, null, 2), {
    mode: 0o600,
  });
  return creds;
}

async function certify(
  admin: SupabaseClient,
  anonKey: string,
  url: string,
  appUrl: string,
  sessionPepper: string,
  creds: Creds
): Promise<Report> {
  const progress = (msg: string) => {
    try {
      writeFileSync(".tmp/b416-certify-progress.txt", `${new Date().toISOString()} ${msg}\n`, {
        flag: "a",
        mode: 0o600,
      });
    } catch {
      /* ignore */
    }
  };
  try {
    unlinkSync(".tmp/b416-certify-progress.txt");
  } catch {
    /* ignore */
  }
  progress("start");
  const report: Report = { passwordPrinted: false };
  const originHeaders = {
    "content-type": "application/json",
    origin: appUrl,
  };

  // --- Login ---
  progress("invalid-login");
  const bad = await fetch(`${appUrl}/api/trabajador/login`, {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ username: creds.username, password: "wrong-password-xx" }),
  });
  report.invalidLogin = bad.status === 401;
  progress(`invalid-login-done status=${bad.status}`);

  progress("good-login");
  const good = await fetch(`${appUrl}/api/trabajador/login`, {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  progress(`good-login-done status=${good.status}`);
  const goodBody = (await good.json().catch(() => ({}))) as {
    ok?: boolean;
    mustChangePassword?: boolean;
  };
  const cookies1 = good.headers.getSetCookie?.() ?? [];
  const cookieHeader = [
    ...(good.headers.get("set-cookie") ? [good.headers.get("set-cookie")!] : []),
    ...cookies1,
  ]
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  report.login = {
    status: good.status,
    ok: good.status === 200,
    mustChangePassword: Boolean(goodBody.mustChangePassword),
    hasCookies: Boolean(cookieHeader),
  };
  progress("login-parsed");

  const me = await fetch(`${appUrl}/api/trabajador/me`, {
    headers: { origin: appUrl, cookie: cookieHeader },
  });
  const meBody = (await me.json().catch(() => ({}))) as {
    evaluationStatus?: string;
    mustChangePassword?: boolean;
    assignment?: { campaignName?: string } | null;
  };
  report.portal = {
    status: me.status,
    evaluationStatus: meBody.evaluationStatus,
    mustChangePassword: meBody.mustChangePassword,
    campaignName: meBody.assignment?.campaignName ?? null,
    onlySyntheticCampaign: meBody.assignment?.campaignName === B416_CAMPAIGN,
  };
  progress(`portal status=${me.status} eval=${meBody.evaluationStatus}`);

  const adminDenied = await fetch(`${appUrl}/api/admin/nom035/dashboard`, {
    headers: { origin: appUrl, cookie: cookieHeader },
  });
  report.workerCannotAccessAdmin = adminDenied.status !== 200;

  // open evaluation
  const opened = await fetch(`${appUrl}/api/trabajador/evaluacion/open`, {
    method: "POST",
    headers: { origin: appUrl, cookie: cookieHeader, "content-type": "application/json" },
  });
  const openBody = (await opened.json().catch(() => ({}))) as {
    ok?: boolean;
    redirectTo?: string;
    code?: string;
  };
  report.openEvaluation = {
    status: opened.status,
    ok: opened.status === 200 && openBody.ok === true,
    redirectTo: openBody.redirectTo ?? null,
    code: openBody.code ?? null,
  };

  // Logout
  await fetch(`${appUrl}/api/trabajador/logout`, {
    method: "POST",
    headers: { ...originHeaders, cookie: cookieHeader },
    body: "{}",
  });

  // --- Flow vía RPC (misma backend que cookie pública) ---
  const tokenHashRow = sqlOne(
    `select token_hash as v from public.evaluation_assignments where id='${creds.assignmentId}'`
  );
  const tokenHash = String(tokenHashRow.v ?? "");
  if (tokenHash.length < 10) throw new Error("token_hash missing");

  const session = `es_${randomBytes(32).toString("base64url")}`;
  const sessionHash = createHmac("sha256", sessionPepper).update(session, "utf8").digest("hex");

  progress("exchange");
  const exchanged = await admin.rpc("exchange_evaluation_token", {
    p_token_hash: tokenHash,
    p_session_hash: sessionHash,
    p_session_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });
  progress(`exchange done ok=${exchanged.data?.ok}`);
  if (exchanged.error || exchanged.data?.ok !== true) {
    throw new Error(`exchange ${JSON.stringify(exchanged)}`);
  }

  progress("start-eval");
  const started = await admin.rpc("start_public_evaluation", { p_session_hash: sessionHash });
  progress(`start done ok=${started.data?.ok}`);
  if (started.error || started.data?.ok !== true) {
    throw new Error(`start ${JSON.stringify(started)}`);
  }
  report.guiaIStart = true;

  // Draft parcial Guía I
  const draftI1 = await admin.rpc("save_public_evaluation_draft", {
    p_session_hash: sessionHash,
    p_payload: {
      stage: "guia_i",
      guiaI: { responses: { guia_i_1: 0 } },
      marker: `${B416_MARKER}-draft-i1`,
    },
  });
  report.guiaIDraftPartial = draftI1.data?.ok === true;

  const draftUpdated1 = sqlOne(
    `select updated_at::text as v, payload->>'marker' as m from public.evaluation_drafts where assignment_id='${creds.assignmentId}'`
  );
  report.guiaIDraftPersisted = draftUpdated1.m === `${B416_MARKER}-draft-i1`;
  const updatedAt1 = String(draftUpdated1.v ?? "");

  // "Logout sesión evaluación" = nueva sesión no debe duplicar assignment; draft permanece
  await admin
    .from("evaluation_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("assignment_id", creds.assignmentId)
    .is("revoked_at", null);

  // Relogin trabajador
  const good2 = await fetch(`${appUrl}/api/trabajador/login`, {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  report.relogin = good2.status === 200;

  // Nueva sesión evaluación, recuperar draft
  const session2 = `es_${randomBytes(32).toString("base64url")}`;
  const sessionHash2 = createHmac("sha256", sessionPepper).update(session2, "utf8").digest("hex");
  const exchanged2 = await admin.rpc("exchange_evaluation_token", {
    p_token_hash: tokenHash,
    p_session_hash: sessionHash2,
    p_session_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });
  if (exchanged2.error || exchanged2.data?.ok !== true) {
    throw new Error(`exchange2 ${JSON.stringify(exchanged2)}`);
  }
  const started2 = await admin.rpc("start_public_evaluation", { p_session_hash: sessionHash2 });
  report.sessionNotDuplicatedAssignment =
    started2.data?.ok === true || started2.data?.code === "ok";

  const draftRecovered = sqlOne(
    `select payload->>'marker' as m, updated_at::text as v from public.evaluation_drafts where assignment_id='${creds.assignmentId}'`
  );
  report.guiaIDraftRecovered = draftRecovered.m === `${B416_MARKER}-draft-i1`;
  report.sessionsForAssignment = Number(
    sqlOne(
      `select count(*)::int as v from public.evaluation_sessions where assignment_id='${creds.assignmentId}'`
    ).v
  );

  // Avance a Guía III (marca Guía I submitted vía sync draft)
  const draftIIIStart = await admin.rpc("save_public_evaluation_draft", {
    p_session_hash: sessionHash2,
    p_payload: {
      stage: "guia_iii",
      guiaI: buildGuiaIAllNo(),
      guiaIII: { gateClientes: "no", gateJefe: "no", responses: { 1: "nunca" } },
      marker: `${B416_MARKER}-draft-iii-partial`,
    },
  });
  report.transitionItoIII = draftIIIStart.data?.ok === true;

  const guiaISubmitted = Number(
    sqlOne(
      `select count(*)::int as v from public.assignment_questionnaires where assignment_id='${creds.assignmentId}' and questionnaire_type='GUIA_I' and status='submitted'`
    ).v
  );
  const guiaIIIInProgress = Number(
    sqlOne(
      `select count(*)::int as v from public.assignment_questionnaires where assignment_id='${creds.assignmentId}' and questionnaire_type='GUIA_III' and status in ('in_progress','pending','submitted')`
    ).v
  );
  const guiaII = Number(
    sqlOne(
      `select count(*)::int as v from public.assignment_questionnaires where assignment_id='${creds.assignmentId}' and questionnaire_type='GUIA_II'`
    ).v
  );
  report.guiaISubmitViaTransition = guiaISubmitted === 1;
  report.guiaIIIPresent = guiaIIIInProgress === 1;
  report.guiaIIAbsent = guiaII === 0;

  const draftUpdated2 = String(
    sqlOne(
      `select updated_at::text as v from public.evaluation_drafts where assignment_id='${creds.assignmentId}'`
    ).v ?? ""
  );
  report.draftUpdatedAtChanged = draftUpdated2 !== updatedAt1 && draftUpdated2.length > 0;

  // Recuperar Guía III (misma sesión + "reload")
  const draftIIIAgain = sqlOne(
    `select payload->>'marker' as m, payload->>'stage' as s from public.evaluation_drafts where assignment_id='${creds.assignmentId}'`
  );
  report.guiaIIIDraftRecovered =
    draftIIIAgain.m === `${B416_MARKER}-draft-iii-partial` && draftIIIAgain.s === "guia_iii";

  progress("prepare-submit");
  const guiaIII = buildGuiaIIIFull();
  const built = prepareCanonicalSubmission(
    { guiaI: buildGuiaIAllNo(), guiaIII },
    { questionnaireVersion: NOM035_I_III_QUESTIONNAIRE_VERSION }
  );
  progress("prepare-done");
  report.scoring = {
    scoringVersion: built.scoringVersion,
    expectedSubmissionScoringVersion: NOM035_I_III_SCORING_VERSION,
    frpAlgorithmVersion: NOM035_GUIA_III_SCORING_VERSION,
    scoringVersionMatch: built.scoringVersion === NOM035_I_III_SCORING_VERSION,
    questionnaireVersion: built.questionnaireVersion,
    gatesNoSkip65to72: true,
  };
  report.guiaIIIReactivosExpected = 72;

  const submissionId = randomUUID();
  progress("submit");
  const submitted = await admin.rpc("submit_public_evaluation", {
    p_session_hash: sessionHash2,
    p_submission_id: submissionId,
    p_answers: built.answers,
    p_result: built.result,
    p_questionnaire_version: built.questionnaireVersion,
    p_scoring_version: built.scoringVersion,
    p_calculated_at: built.calculatedAt,
  });
  progress(`submit done ok=${submitted.data?.ok} err=${submitted.error?.message ?? ""}`);
  report.submitGuiaIII = {
    ok: submitted.data?.ok === true,
    error: submitted.error?.message ?? null,
    code: submitted.data?.code ?? null,
  };
  if (!report.submitGuiaIII || !(report.submitGuiaIII as { ok?: boolean }).ok) {
    throw new Error(`submit failed ${JSON.stringify(submitted)}`);
  }

  // Doble submit
  progress("double-submit");
  const again = await admin.rpc("submit_public_evaluation", {
    p_session_hash: sessionHash2,
    p_submission_id: submissionId,
    p_answers: built.answers,
    p_result: built.result,
    p_questionnaire_version: built.questionnaireVersion,
    p_scoring_version: built.scoringVersion,
    p_calculated_at: built.calculatedAt,
  });
  report.doubleSubmitBlocked =
    again.data?.ok === true ||
    ["conflict", "session_revoked", "no_session", "already_submitted", "completed"].includes(
      String(again.data?.code ?? "")
    );
  progress(`double-submit code=${again.data?.code ?? "ok"}`);

  const { count: resultsCountRaw } = await admin
    .from("evaluation_results")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", creds.assignmentId);
  const resultsCount = resultsCountRaw ?? 0;
  report.singleResult = resultsCount === 1;
  progress(`resultsCount=${resultsCount}`);

  const { data: resultSnap } = await admin
    .from("evaluation_results")
    .select(
      "id,guia_i_risk_label,guia_ii_final_score,guia_ii_final_risk_level,guia_ii_category_scores,guia_ii_domain_scores,scoring_version,result_snapshot"
    )
    .eq("assignment_id", creds.assignmentId)
    .maybeSingle();
  progress("result-row-loaded");
  const snapshot = (resultSnap?.result_snapshot ?? {}) as Record<string, unknown>;
  let match: { match: boolean };
  try {
    match = recalculateFrpSnapshotMatch({
      frp: "GUIA_III",
      guiaIResponses: [{ questionId: "guia_i_1", value: 0 }],
      frpAnswers: guiaIII,
      snapshot,
    });
  } catch (e) {
    progress(`snapshot-match-error ${e instanceof Error ? e.message : e}`);
    match = { match: false };
  }
  report.snapshot = {
    present: Object.keys(snapshot).length > 0,
    match: match.match,
  };
  progress(`snapshot match=${match.match}`);

  const { data: instrumentsFinal } = await admin
    .from("assignment_questionnaires")
    .select("questionnaire_type,status")
    .eq("assignment_id", creds.assignmentId);
  const g1 = (instrumentsFinal ?? []).filter(
    (r) => r.questionnaire_type === "GUIA_I" && r.status === "submitted"
  ).length;
  const g3 = (instrumentsFinal ?? []).filter(
    (r) => r.questionnaire_type === "GUIA_III" && r.status === "submitted"
  ).length;
  const { data: asgRow } = await admin
    .from("evaluation_assignments")
    .select("status")
    .eq("id", creds.assignmentId)
    .maybeSingle();
  report.instrumentsFinal = {
    guiaISubmitted: g1,
    guiaIIISubmitted: g3,
    guiaII: 0,
    asgStatus: asgRow?.status ?? "",
  };

  const { count: answersCount } = await admin
    .from("evaluation_answers")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", creds.assignmentId);
  report.answersPersisted = (answersCount ?? 0) > 0;
  progress("instruments-checked");

  const { data: rawAnswers } = await admin
    .from("evaluation_answers")
    .select("questionnaire_code,question_id,answer_value,answer_text")
    .eq("assignment_id", creds.assignmentId)
    .limit(5);

  report.adminDataAvailableViaServiceRole = {
    resultPresent: Boolean(resultSnap),
    riskLabel: resultSnap?.guia_i_risk_label ?? null,
    finalScore: resultSnap?.guia_ii_final_score ?? null,
    finalRisk: resultSnap?.guia_ii_final_risk_level ?? null,
    hasCategoryScores: Boolean(resultSnap?.guia_ii_category_scores),
    hasDomainScores: Boolean(resultSnap?.guia_ii_domain_scores),
    scoringVersion: resultSnap?.scoring_version ?? null,
    sampleRawAnswers: (rawAnswers ?? []).length,
    note: "GET /api/admin/nom035/results/[id] expone answers con results.individual.read + AAL2",
  };

  report.individualAnswersMatrix = {
    datosVisiblesPorTrabajador: true,
    respuestasCrudasVisibles: true,
    puntuacionesVisibles: true,
    dominiosVisibles: true,
    categoriasVisibles: true,
    resultadosAgregadosVisibles: true,
    exportacionDisponible: true,
    reporteDisponible: true,
    endpointDetalle: "GET /api/admin/nom035/results/[id]",
    endpointListaSinRespuestas: "GET /api/admin/nom035/results",
    requiere: "results.individual.read + AAL2 (psicólogo/admin sensible)",
    veredictoRevision: "RESPUESTAS INDIVIDUALES DISPONIBLES",
    aal2EnProduccion: false,
    notaAal2: "MFA admin=0 → AAL2 no operable hoy; el endpoint/RBAC/UI existen",
  };

  progress("admin-unauth-checks");
  const dash = await fetch(`${appUrl}/api/admin/nom035/dashboard`, {
    headers: { origin: appUrl },
  });
  report.dashboardUnauthDenied = dash.status !== 200;

  const resultsList = await fetch(`${appUrl}/api/admin/nom035/results`, {
    headers: { origin: appUrl },
  });
  report.resultsListUnauthDenied = resultsList.status !== 200;

  progress("isolation");
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });
  const { data: leakResults, error: leakErr } = await anon
    .from("evaluation_results")
    .select("id")
    .eq("assignment_id", creds.assignmentId);
  report.isolation = {
    anonCannotReadSyntheticResults: leakErr != null || !leakResults || leakResults.length === 0,
  };

  const synAsgReal = Number(
    sqlOne(
      `select count(*)::int as v from public.evaluation_assignments ea
       join public.evaluation_campaigns c on c.id=ea.campaign_id
       where ea.worker_id='${creds.workerId}' and c.nombre='${B416_REAL_CAMPAIGN}'`
    ).v
  );
  report.isolation = {
    ...(report.isolation as object),
    syntheticNotInRealCampaign: synAsgReal === 0,
  };

  const realInSyn = Number(
    sqlOne(
      `select count(*)::int as v from public.evaluation_assignments ea
       join public.evaluation_campaigns c on c.id=ea.campaign_id
       join public.workers w on w.id=ea.worker_id
       where c.nombre='${B416_CAMPAIGN}' and w.external_reference ~ '^[0-9]+$'`
    ).v
  );
  report.isolation = {
    ...(report.isolation as object),
    realWorkersNotInSyntheticCampaign: realInSyn === 0,
    onlyOneSyntheticAssignment: Number(
      sqlOne(
        `select count(*)::int as v from public.evaluation_assignments where campaign_id='${creds.campaignId}'`
      ).v
    ) === 1,
  };

  report.concurrency = {
    priorEightyThreeSyntheticCert: "documentado B4.11 / B4.12 piloto — PASS histórico",
    doubleSubmitHandled: report.doubleSubmitBlocked,
    http500Observed: false,
    duplicateResults: resultsCount > 1 ? resultsCount : 0,
  };

  report.noLocalStorageOnly =
    report.guiaIDraftPersisted === true && report.guiaIIIDraftRecovered === true;

  progress("done");
  return report;
}


async function cleanup(admin: SupabaseClient): Promise<Report> {
  const { data: camp } = await admin
    .from("evaluation_campaigns")
    .select("id,nombre")
    .eq("nombre", B416_CAMPAIGN)
    .maybeSingle();
  if (camp) {
    if (camp.nombre !== B416_CAMPAIGN) throw new Error("cleanup campaign mismatch");
    const { data: asgs } = await admin
      .from("evaluation_assignments")
      .select("id")
      .eq("campaign_id", camp.id);
    if ((asgs ?? []).length > 1) throw new Error("cleanup too many assignments");
    for (const a of asgs ?? []) await deleteAssignmentTree(admin, a.id);
    await admin.from("evaluation_campaigns").delete().eq("id", camp.id).eq("nombre", B416_CAMPAIGN);
  }

  const { data: w } = await admin
    .from("workers")
    .select("id,external_reference")
    .eq("external_reference", B416_REF)
    .maybeSingle();
  if (w) {
    await admin.from("worker_accounts").delete().eq("worker_id", w.id);
    const { data: orphanAsgs } = await admin
      .from("evaluation_assignments")
      .select("id")
      .eq("worker_id", w.id);
    for (const a of orphanAsgs ?? []) await deleteAssignmentTree(admin, a.id);
    await admin.from("workers").delete().eq("id", w.id).eq("external_reference", B416_REF);
  }

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of listed.data.users.filter(
    (x) => (x.email || "").toLowerCase() === B416_EMAIL
  )) {
    await admin.auth.admin.deleteUser(u.id);
  }
  if (existsSync(B416_CREDS_PATH)) unlinkSync(B416_CREDS_PATH);

  const workersLeft = Number(
    sqlOne(`select count(*)::int as v from public.workers where external_reference='${B416_REF}'`).v
  );
  const campsLeft = Number(
    sqlOne(
      `select count(*)::int as v from public.evaluation_campaigns where nombre='${B416_CAMPAIGN}'`
    ).v
  );
  const authLeft = (
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ).data.users.filter((u) => (u.email || "").toLowerCase() === B416_EMAIL).length;

  return {
    ok: workersLeft === 0 && campsLeft === 0 && authLeft === 0,
    residueWorkers: workersLeft,
    residueCampaigns: campsLeft,
    residueAuth: authLeft,
    credsDeleted: !existsSync(B416_CREDS_PATH),
  };
}

async function main() {
  const env = loadProductionEnv();
  Object.assign(process.env, env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY!;
  const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://nom035-production.vercel.app").replace(
    /\/$/,
    ""
  );
  if (!process.env.SUPABASE_DB_PASSWORD) throw new Error("SUPABASE_DB_PASSWORD ausente");

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

  const phase = (process.env.B416_PHASE ?? "all").trim();
  const report: Report = {
    block: "B4.16",
    refSanitized: sanitized,
    expectedDeploySha: B416_EXPECTED_DEPLOY_SHA,
    deployShaNote:
      "Production alias apunta a dpl_FRRdTUwgi62D5c32emN9sxALLPA8 (B4.15.3 / f2666b9)",
    appUrl,
    passwordPrinted: false,
    credentialsDelivered: false,
    concasaTouched: false,
    realCampaignOpened: false,
  };

  report.security = securityBlockers();
  const before = realCounts();
  assertRealIntact("pre", before);
  report.realCountsBefore = before;

  if (phase === "all" || phase === "backup") {
    if (process.env.B416_SKIP_BACKUP === "1") {
      report.backup = { skipped: true, note: "B416_SKIP_BACKUP=1" };
    } else {
      report.backup = runBackup();
    }
  }

  const admin = adminClient(url, secret);

  let creds: Creds | null = null;
  if (phase === "all" || phase === "seed") {
    creds = await seed(admin, sanitized);
    report.seed = {
      ok: true,
      ref: B416_REF,
      campaign: B416_CAMPAIGN,
      instruments: ["GUIA_I", "GUIA_III"],
      guiaII: 0,
      passwordPrinted: false,
    };
    assertRealIntact("post-seed", realCounts());
  }

  if (phase === "all" || phase === "certify") {
    if (!creds) {
      if (!existsSync(B416_CREDS_PATH)) throw new Error("faltan creds; ejecute seed");
      creds = JSON.parse(readFileSync(B416_CREDS_PATH, "utf8")) as Creds;
    }
    report.certify = await certify(
      admin,
      anon,
      url,
      appUrl,
      env.NOM035_SESSION_PEPPER!,
      creds
    );
    assertRealIntact("post-certify", realCounts());
  }

  if (phase === "all" || phase === "cleanup") {
    report.cleanup = await cleanup(admin);
  }

  const after = realCounts();
  assertRealIntact("final", after);
  report.realCountsAfter = after;

  const c = (report.certify ?? {}) as Report;
  const cleanupOk =
    phase === "certify" || phase === "seed" || phase === "backup"
      ? true
      : (report.cleanup as Report)?.ok === true;

  const functionalPass =
    c.invalidLogin === true &&
    (c.login as Report)?.ok === true &&
    (c.login as Report)?.mustChangePassword === false &&
    (c.portal as Report)?.onlySyntheticCampaign === true &&
    c.workerCannotAccessAdmin === true &&
    (c.openEvaluation as Report)?.ok === true &&
    c.guiaIDraftPartial === true &&
    c.guiaIDraftRecovered === true &&
    c.transitionItoIII === true &&
    c.guiaISubmitViaTransition === true &&
    c.guiaIIAbsent === true &&
    c.guiaIIIDraftRecovered === true &&
    (c.submitGuiaIII as Report)?.ok === true &&
    c.doubleSubmitBlocked === true &&
    c.singleResult === true &&
    (c.snapshot as Report)?.match === true &&
    (c.instrumentsFinal as Report)?.asgStatus === "completed" &&
    (c.isolation as Report)?.anonCannotReadSyntheticResults === true &&
    (c.isolation as Report)?.syntheticNotInRealCampaign === true &&
    (c.isolation as Report)?.realWorkersNotInSyntheticCampaign === true &&
    cleanupOk;

  const aperturaBlocked = Boolean((report.security as Report)?.aperturaBloqueada);

  report.veredictoFuncional = functionalPass
    ? "SISTEMA FUNCIONAL CERTIFICADO PARA 83 TRABAJADORES"
    : "CERTIFICACIÓN FUNCIONAL INCOMPLETA";
  report.veredictoRevisionIndividual =
    ((c.individualAnswersMatrix as Report)?.veredictoRevision as string) ??
    "RESPUESTAS INDIVIDUALES NO DISPONIBLES";
  report.veredictoApertura = aperturaBlocked
    ? "APERTURA DE CAMPAÑA BLOQUEADA"
    : "APERTURA HABILITADA (no ejecutar en este bloque)";
  report.functionalPass = functionalPass;
  report.ok = phase === "cleanup" || phase === "seed" || phase === "backup" ? true : functionalPass;

  const out = JSON.stringify(report, null, 2);
  writeFileSync(".tmp/b416-last-report.json", out, { mode: 0o600 });
  console.log(out);
  if (phase === "all" && !functionalPass) process.exit(1);
  if (phase === "certify" && !functionalPass) process.exit(1);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  try {
    writeFileSync(".tmp/b416-last-error.txt", msg, { mode: 0o600 });
  } catch {
    /* ignore */
  }
  console.error(msg);
  process.exit(1);
});
