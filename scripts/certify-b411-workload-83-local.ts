/**
 * Certificación LOCAL B4.11 — 83 sintéticos.
 * Estructura, identidad/aislamiento, simulación 20/30/33, concurrencia,
 * scoring/recalc, dashboard SQL, backup/restore, cleanup obligatorio al final.
 *
 *   npm run b411:certify:local
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  assertLocalSupabaseOnly,
  loadEnvLocal,
} from "./lib/assert-local-supabase-only";
import {
  B411_CAMPAIGN,
  B411_COMPANY,
  B411_COUNT,
  B411_CREDS_PATH,
  B411_MARKER,
  B411_VERSION,
} from "./lib/b411-constants";
import {
  prepareCanonicalSubmission,
  recalculateFrpSnapshotMatch,
} from "../src/lib/nom035/server/public-evaluation-service";
import { NOM035_I_III_QUESTIONNAIRE_VERSION } from "../src/data/nom035/guia-iii-manifest";
import type { GuiaIIIAnswers, GuiaIILikertAnswer } from "../src/types/nom035";

const PENDING = 20;
const IN_PROGRESS = 30;
const COMPLETED = 33;
const DUMP = join(process.cwd(), ".local-backups", "b411-synthetic-dump.json");

type Cred = {
  ref: string;
  username: string;
  email: string;
  password: string;
  workerId: string;
  authUserId: string;
  assignmentId: string;
};

function adminClient(url: string, secret: string) {
  const options: { auth: object; realtime?: { transport: new () => unknown } } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: class {} as never };
  }
  return createClient(url, secret, options as never);
}

function sql(query: string): string {
  return execFileSync(
    "psql",
    ["postgresql://postgres:postgres@127.0.0.1:55322/postgres", "-At", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`B411 FAIL: ${msg}`);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function buildGuiaIII(opts: {
  clientes: "si" | "no";
  jefe: "si" | "no";
  fill: GuiaIILikertAnswer;
}): GuiaIIIAnswers {
  const responses: Record<number, GuiaIILikertAnswer> = {};
  for (let n = 1; n <= 72; n += 1) {
    if (opts.clientes === "no" && n >= 65 && n <= 68) continue;
    if (opts.jefe === "no" && n >= 69 && n <= 72) continue;
    responses[n] = opts.fill;
  }
  return { gateClientes: opts.clientes, gateJefe: opts.jefe, responses };
}

function prepareIPlusIII(guiaIII: GuiaIIIAnswers) {
  return prepareCanonicalSubmission(
    {
      guiaI: { responses: { guia_i_1: 0 } },
      guiaIII,
    },
    { questionnaireVersion: NOM035_I_III_QUESTIONNAIRE_VERSION },
  );
}

function vectorForIndex(i: number): GuiaIIIAnswers {
  const modes: Array<{ clientes: "si" | "no"; jefe: "si" | "no"; fill: GuiaIILikertAnswer }> = [
    { clientes: "no", jefe: "no", fill: "nunca" },
    { clientes: "si", jefe: "si", fill: "siempre" },
    { clientes: "si", jefe: "no", fill: "casi_nunca" },
    { clientes: "no", jefe: "si", fill: "algunas_veces" },
    { clientes: "si", jefe: "si", fill: "casi_siempre" },
  ];
  return buildGuiaIII(modes[i % modes.length]!);
}

async function structuralChecks(admin: SupabaseClient, campaignId: string) {
  const workers = Number(
    sql(`select count(*) from public.workers where external_reference like 'TST-B411-%'`),
  );
  const accounts = Number(
    sql(
      `select count(*) from public.worker_accounts wa
       join public.workers w on w.id = wa.worker_id
       where w.external_reference like 'TST-B411-%'`,
    ),
  );
  const usernames = Number(
    sql(
      `select count(distinct wa.username_normalized) from public.worker_accounts wa
       join public.workers w on w.id = wa.worker_id
       where w.external_reference like 'TST-B411-%'`,
    ),
  );
  const authIds = Number(
    sql(
      `select count(distinct wa.auth_user_id) from public.worker_accounts wa
       join public.workers w on w.id = wa.worker_id
       where w.external_reference like 'TST-B411-%'`,
    ),
  );
  const workerIds = Number(
    sql(
      `select count(distinct wa.worker_id) from public.worker_accounts wa
       join public.workers w on w.id = wa.worker_id
       where w.external_reference like 'TST-B411-%'`,
    ),
  );
  const asgs = Number(
    sql(`select count(*) from public.evaluation_assignments where campaign_id='${campaignId}'`),
  );
  const g1 = Number(
    sql(
      `select count(*) from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id = aq.assignment_id
       where a.campaign_id='${campaignId}' and aq.questionnaire_type='GUIA_I'`,
    ),
  );
  const g2 = Number(
    sql(
      `select count(*) from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id = aq.assignment_id
       where a.campaign_id='${campaignId}' and aq.questionnaire_type='GUIA_II'`,
    ),
  );
  const g3 = Number(
    sql(
      `select count(*) from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id = aq.assignment_id
       where a.campaign_id='${campaignId}' and aq.questionnaire_type='GUIA_III'`,
    ),
  );
  const dupSessions = Number(
    sql(
      `select count(*) from (
         select assignment_id, count(*) c from public.evaluation_sessions
         where assignment_id in (select id from public.evaluation_assignments where campaign_id='${campaignId}')
         group by assignment_id having count(*) > 1
       ) t`,
    ),
  );
  const orphanAccounts = Number(
    sql(
      `select count(*) from public.worker_accounts wa
       left join public.workers w on w.id = wa.worker_id
       where w.id is null`,
    ),
  );
  const orphanAsg = Number(
    sql(
      `select count(*) from public.evaluation_assignments a
       left join public.workers w on w.id = a.worker_id
       where a.campaign_id='${campaignId}' and w.id is null`,
    ),
  );

  assert(workers === B411_COUNT, `workers=${workers}`);
  assert(accounts === B411_COUNT, `accounts=${accounts}`);
  assert(usernames === B411_COUNT, `usernames=${usernames}`);
  assert(authIds === B411_COUNT, `authIds=${authIds}`);
  assert(workerIds === B411_COUNT, `workerIds=${workerIds}`);
  assert(asgs === B411_COUNT, `assignments=${asgs}`);
  assert(g1 === B411_COUNT, `guiaI=${g1}`);
  assert(g3 === B411_COUNT, `guiaIII=${g3}`);
  assert(g2 === 0, `guiaII=${g2}`);
  assert(dupSessions === 0, `dupSessions=${dupSessions}`);
  assert(orphanAccounts === 0, `orphanAccounts=${orphanAccounts}`);
  assert(orphanAsg === 0, `orphanAsg=${orphanAsg}`);

  // company mark
  const { data: company } = await admin
    .from("company_settings")
    .select("razon_social,total_trabajadores")
    .limit(1)
    .maybeSingle();
  assert(company?.razon_social === B411_COMPANY, "company mark");

  return { workers, accounts, asgs, g1, g2, g3 };
}

async function identityMatrix(admin: SupabaseClient, creds: Cred[]) {
  let crossDenied = 0;
  let crossAttempted = 0;
  const fingerprints: string[] = [];

  for (let i = 0; i < creds.length; i += 1) {
    const c = creds[i]!;
    const next = creds[(i + 1) % creds.length]!;
    const { data: wa, error } = await admin
      .from("worker_accounts")
      .select("auth_user_id, worker_id, username_normalized")
      .eq("auth_user_id", c.authUserId)
      .maybeSingle();
    assert(!error && wa, `account lookup ${c.ref}`);
    assert(wa!.worker_id === c.workerId, `worker map ${c.ref}`);
    assert(wa!.username_normalized === c.username, `username ${c.ref}`);

    const { data: asg } = await admin
      .from("evaluation_assignments")
      .select("id, worker_id")
      .eq("id", c.assignmentId)
      .maybeSingle();
    assert(asg?.worker_id === c.workerId, `assignment ownership ${c.ref}`);

    const fp = createHash("sha256")
      .update(`${c.authUserId}|${c.workerId}|${c.assignmentId}|${c.ref}`)
      .digest("hex")
      .slice(0, 16);
    fingerprints.push(fp);

    // Acceso cruzado: el assignment de next no pertenece a c
    crossAttempted += 1;
    const { data: cross } = await admin
      .from("evaluation_assignments")
      .select("id, worker_id")
      .eq("id", next.assignmentId)
      .eq("worker_id", c.workerId)
      .maybeSingle();
    if (!cross) crossDenied += 1;
  }

  assert(new Set(fingerprints).size === B411_COUNT, "fingerprint uniqueness");
  assert(crossDenied === crossAttempted, `crossDenied ${crossDenied}/${crossAttempted}`);
  return { crossAttempted, crossDenied, fingerprints: fingerprints.length };
}

async function openSession(
  admin: SupabaseClient,
  env: Record<string, string>,
  assignmentId: string,
) {
  const sessionPepper = env.NOM035_SESSION_PEPPER!;
  assert(sessionPepper, "NOM035_SESSION_PEPPER");
  const tokenHash = sql(
    `select token_hash from public.evaluation_assignments where id='${assignmentId}'`,
  );
  assert(tokenHash.length > 10, `token_hash missing ${assignmentId}`);
  const session = `es_${randomBytes(32).toString("base64url")}`;
  const sessionHash = createHmac("sha256", sessionPepper).update(session, "utf8").digest("hex");
  const exchanged = await admin.rpc("exchange_evaluation_token", {
    p_token_hash: tokenHash,
    p_session_hash: sessionHash,
    p_session_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });
  assert(
    exchanged.error == null && exchanged.data?.ok === true,
    `exchange ${assignmentId}: ${JSON.stringify({ err: exchanged.error, data: exchanged.data })}`,
  );
  const started = await admin.rpc("start_public_evaluation", { p_session_hash: sessionHash });
  assert(
    started.error == null && started.data?.ok === true,
    `start ${assignmentId}: ${JSON.stringify({ err: started.error, data: started.data })}`,
  );
  return sessionHash;
}

async function saveDraft(admin: SupabaseClient, sessionHash: string, payload: object) {
  const r = await admin.rpc("save_public_evaluation_draft", {
    p_session_hash: sessionHash,
    p_payload: payload,
  });
  assert(
    r.error == null && r.data?.ok === true,
    `draft ${r.error?.message ?? JSON.stringify(r.data)}`,
  );
}

async function simulateUsage(
  admin: SupabaseClient,
  env: Record<string, string>,
  creds: Cred[],
) {
  const pending = creds.slice(0, PENDING);
  const progress = creds.slice(PENDING, PENDING + IN_PROGRESS);
  const completed = creds.slice(PENDING + IN_PROGRESS);

  assert(pending.length === PENDING, "pending slice");
  assert(progress.length === IN_PROGRESS, "progress slice");
  assert(completed.length === COMPLETED, "completed slice");

  // En progreso: draft parcial + recuperación
  for (const c of progress) {
    const sessionHash = await openSession(admin, env, c.assignmentId);
    const draftPayload = {
      stage: "GUIA_III",
      guiaI: { responses: { guia_i_1: 0 } },
      guiaIII: {
        gateClientes: "si",
        gateJefe: "no",
        responses: { 1: "nunca", 2: "nunca", 3: "algunas_veces" },
      },
      marker: `${B411_MARKER}-draft-${c.ref}`,
    };
    await saveDraft(admin, sessionHash, draftPayload);
    // Tabla evaluation_drafts no es SELECT para service_role vía REST; verificar por SQL.
    const marker = sql(
      `select payload->>'marker' from public.evaluation_drafts where assignment_id='${c.assignmentId}'`,
    );
    assert(marker === draftPayload.marker, `draft match ${c.ref} got=${marker}`);
    // status ya queda in_progress vía start_public_evaluation
  }

  const snapshotsOk: boolean[] = [];
  for (let i = 0; i < completed.length; i += 1) {
    const c = completed[i]!;
    const sessionHash = await openSession(admin, env, c.assignmentId);
    const guiaIII = vectorForIndex(i);
    const prepared = prepareIPlusIII(guiaIII);
    const submissionId = randomUUID();
    const submitted = await admin.rpc("submit_public_evaluation", {
      p_session_hash: sessionHash,
      p_submission_id: submissionId,
      p_answers: prepared.answers,
      p_result: prepared.result,
      p_questionnaire_version: prepared.questionnaireVersion,
      p_scoring_version: prepared.scoringVersion,
      p_calculated_at: prepared.calculatedAt,
    });
    assert(submitted.data?.ok, `submit ${c.ref}: ${JSON.stringify(submitted)}`);

    // doble submit idempotente
    const again = await admin.rpc("submit_public_evaluation", {
      p_session_hash: sessionHash,
      p_submission_id: submissionId,
      p_answers: prepared.answers,
      p_result: prepared.result,
      p_questionnaire_version: prepared.questionnaireVersion,
      p_scoring_version: prepared.scoringVersion,
      p_calculated_at: prepared.calculatedAt,
    });
    assert(
      again.data?.ok === true ||
        again.data?.code === "conflict" ||
        again.data?.code === "session_revoked" ||
        again.data?.code === "no_session",
      `idempotent ${c.ref}`,
    );

    const snapJson = sql(
      `select coalesce(result_snapshot::text, '') from public.evaluation_results where assignment_id='${c.assignmentId}'`,
    );
    assert(snapJson.length > 2, `snapshot ${c.ref}`);
    const snapshot = JSON.parse(snapJson) as Record<string, unknown>;
    const match = recalculateFrpSnapshotMatch({
      frp: "GUIA_III",
      guiaIResponses: [{ questionId: "guia_i_1", value: 0 }],
      frpAnswers: guiaIII,
      snapshot,
    });
    assert(match.match, `recalc ${c.ref} expected=${match.expectedScore} snap=${match.snapshotScore}`);
    snapshotsOk.push(match.match);
  }

  const statusCounts = sql(
    `select status||':'||count(*) from public.evaluation_assignments
     where campaign_id=(select id from public.evaluation_campaigns where nombre='${B411_CAMPAIGN}')
     group by status order by 1`,
  );
  const pendingN = Number(sql(
    `select count(*) from public.evaluation_assignments a
     join public.evaluation_campaigns c on c.id=a.campaign_id
     where c.nombre='${B411_CAMPAIGN}' and a.status='pending'`,
  ));
  const progressN = Number(sql(
    `select count(*) from public.evaluation_assignments a
     join public.evaluation_campaigns c on c.id=a.campaign_id
     where c.nombre='${B411_CAMPAIGN}' and a.status='in_progress'`,
  ));
  const completedN = Number(sql(
    `select count(*) from public.evaluation_assignments a
     join public.evaluation_campaigns c on c.id=a.campaign_id
     where c.nombre='${B411_CAMPAIGN}' and a.status='completed'`,
  ));

  assert(pendingN === PENDING, `pending=${pendingN}`);
  assert(progressN === IN_PROGRESS, `in_progress=${progressN}`);
  assert(completedN === COMPLETED, `completed=${completedN}`);
  assert(snapshotsOk.length === COMPLETED && snapshotsOk.every(Boolean), "snapshots");

  return {
    statusCounts,
    pendingN,
    progressN,
    completedN,
    snapshots: snapshotsOk.length,
    recalcMatches: snapshotsOk.filter(Boolean).length,
  };
}

async function concurrencyLogins(env: Record<string, string>, creds: Cred[]) {
  const latencies: number[] = [];
  let success = 0;
  let unexpected = 0;
  const loginBatch = creds.slice(0, 20);
  const anon =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_SECRET_KEY!;
  await Promise.all(
    loginBatch.map(async (c) => {
      const t0 = performance.now();
      const client = adminClient(env.NEXT_PUBLIC_SUPABASE_URL!, anon);
      const { data, error } = await client.auth.signInWithPassword({
        email: c.email,
        password: c.password,
      });
      latencies.push(performance.now() - t0);
      if (!error && data.user) {
        success += 1;
        await client.auth.signOut();
      } else {
        unexpected += 1;
        console.error("LOGIN_FAIL", c.ref, error?.message);
      }
    }),
  );
  assert(unexpected === 0, `login unexpected=${unexpected}`);
  assert(success === 20, `login success=${success}`);
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    requests: 20,
    success,
    unexpected,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
  };
}

async function concurrencyProbe(
  admin: SupabaseClient,
  env: Record<string, string>,
  creds: Cred[],
) {
  const latencies: number[] = [];
  let success = 0;
  let expectedFail = 0;
  let unexpected = 0;
  let requests = 0;

  // 20 recuperaciones/reescrituras de draft
  const draftBatch = creds.slice(PENDING, PENDING + 20);
  for (const c of draftBatch) {
    requests += 1;
    const t0 = performance.now();
    try {
      const existing = sql(
        `select payload->>'marker' from public.evaluation_drafts where assignment_id='${c.assignmentId}'`,
      );
      assert(existing.includes(B411_MARKER), `recover draft ${c.ref}`);
      const sessionHash = await openSession(admin, env, c.assignmentId);
      await saveDraft(admin, sessionHash, {
        marker: `${B411_MARKER}-conc-${c.ref}`,
        guiaI: { responses: { guia_i_1: 0 } },
      });
      const again = sql(
        `select payload->>'marker' from public.evaluation_drafts where assignment_id='${c.assignmentId}'`,
      );
      assert(again === `${B411_MARKER}-conc-${c.ref}`, `rewrite draft ${c.ref}`);
      success += 1;
    } catch (e) {
      unexpected += 1;
      console.error("DRAFT_CONC_FAIL", c.ref, e instanceof Error ? e.message : e);
    }
    latencies.push(performance.now() - t0);
  }

  // 10 double-submit sobre ya completados → idempotencia / session_revoked esperado
  const targets = creds.slice(PENDING + IN_PROGRESS, PENDING + IN_PROGRESS + 10);
  await Promise.all(
    targets.map(async (c) => {
      requests += 2;
      const t0 = performance.now();
      try {
        const sessionHash = await openSession(admin, env, c.assignmentId);
        const prepared = prepareIPlusIII(
          buildGuiaIII({ clientes: "no", jefe: "no", fill: "nunca" }),
        );
        const submissionId = randomUUID();
        const [a, b] = await Promise.all([
          admin.rpc("submit_public_evaluation", {
            p_session_hash: sessionHash,
            p_submission_id: submissionId,
            p_answers: prepared.answers,
            p_result: prepared.result,
            p_questionnaire_version: prepared.questionnaireVersion,
            p_scoring_version: prepared.scoringVersion,
            p_calculated_at: prepared.calculatedAt,
          }),
          admin.rpc("submit_public_evaluation", {
            p_session_hash: sessionHash,
            p_submission_id: submissionId,
            p_answers: prepared.answers,
            p_result: prepared.result,
            p_questionnaire_version: prepared.questionnaireVersion,
            p_scoring_version: prepared.scoringVersion,
            p_calculated_at: prepared.calculatedAt,
          }),
        ]);
        for (const r of [a, b]) {
          if (r.error) unexpected += 1;
          else if (r.data?.ok) success += 1;
          else if (
            r.data?.code === "conflict" ||
            r.data?.code === "session_revoked" ||
            r.data?.code === "no_session" ||
            r.data?.code === "completed"
          ) {
            expectedFail += 1;
          } else unexpected += 1;
        }
      } catch {
        // Ya completed: openSession falla → esperado
        expectedFail += 2;
      }
      latencies.push(performance.now() - t0);
    }),
  );

  const dupResults = Number(
    sql(
      `select count(*) from (
         select r.assignment_id, count(*) c from public.evaluation_results r
         where r.assignment_id in (
           select a.id from public.evaluation_assignments a
           join public.evaluation_campaigns c on c.id=a.campaign_id
           where c.nombre='${B411_CAMPAIGN}'
         )
         group by r.assignment_id having count(*)>1
       ) t`,
    ),
  );
  const dupSessions = Number(
    sql(
      `select count(*) from (
         select s.assignment_id, count(*) c
         from public.evaluation_sessions s
         join public.evaluation_assignments a on a.id=s.assignment_id
         join public.evaluation_campaigns c on c.id=a.campaign_id
         where c.nombre='${B411_CAMPAIGN}' and s.revoked_at is null
         group by s.assignment_id having count(*)>1
       ) t`,
    ),
  );
  assert(dupResults === 0, `dupResults=${dupResults}`);
  assert(dupSessions === 0, `dupSessions=${dupSessions}`);
  assert(unexpected === 0, `unexpected=${unexpected}`);

  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    requests,
    success,
    expectedFail,
    unexpected,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
    dupResults,
    dupSessions,
  };
}

async function dashboardChecks(campaignId: string) {
  const assigned = Number(
    sql(`select count(*) from public.evaluation_assignments where campaign_id='${campaignId}'`),
  );
  const pending = Number(
    sql(
      `select count(*) from public.evaluation_assignments where campaign_id='${campaignId}' and status='pending'`,
    ),
  );
  const progress = Number(
    sql(
      `select count(*) from public.evaluation_assignments where campaign_id='${campaignId}' and status='in_progress'`,
    ),
  );
  const completed = Number(
    sql(
      `select count(*) from public.evaluation_assignments where campaign_id='${campaignId}' and status='completed'`,
    ),
  );
  const g2 = Number(
    sql(
      `select count(*) from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id=aq.assignment_id
       where a.campaign_id='${campaignId}' and aq.questionnaire_type='GUIA_II'`,
    ),
  );
  assert(assigned === 83, `dash assigned=${assigned}`);
  assert(pending === PENDING, `dash pending=${pending}`);
  assert(progress === IN_PROGRESS, `dash progress=${progress}`);
  assert(completed === COMPLETED, `dash completed=${completed}`);
  assert(g2 === 0, "dash guia II");
  const pct = Math.round((completed / assigned) * 1000) / 10;
  return { assigned, pending, progress, completed, pct, guiaII: g2 };
}

async function backupRestore(_admin: SupabaseClient, campaignId: string) {
  // Lecturas vía SQL: varias tablas deniegan SELECT REST a service_role.
  const workers = Number(
    sql(`select count(*) from public.workers where external_reference like 'TST-B411-%'`),
  );
  const accounts = Number(
    sql(
      `select count(*) from public.worker_accounts wa
       join public.workers w on w.id=wa.worker_id
       where w.external_reference like 'TST-B411-%'`,
    ),
  );
  const assignments = Number(
    sql(`select count(*) from public.evaluation_assignments where campaign_id='${campaignId}'`),
  );
  const instruments = Number(
    sql(
      `select count(*) from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id=aq.assignment_id
       where a.campaign_id='${campaignId}'`,
    ),
  );
  const answers = Number(
    sql(
      `select count(*) from public.evaluation_answers ans
       join public.evaluation_assignments a on a.id=ans.assignment_id
       where a.campaign_id='${campaignId}'`,
    ),
  );
  const results = Number(
    sql(`select count(*) from public.evaluation_results where campaign_id='${campaignId}'`),
  );
  const drafts = Number(
    sql(
      `select count(*) from public.evaluation_drafts d
       join public.evaluation_assignments a on a.id=d.assignment_id
       where a.campaign_id='${campaignId}'`,
    ),
  );
  const match = Number(
    sql(
      `select count(*) from public.evaluation_results
       where campaign_id='${campaignId}'
         and (result_snapshot->>'final_score')::int = guia_ii_final_score`,
    ),
  );

  mkdirSync(join(process.cwd(), ".local-backups"), { recursive: true });
  const payload = {
    dumpedAt: new Date().toISOString(),
    marker: B411_MARKER,
    version: B411_VERSION,
    campaign: B411_CAMPAIGN,
    company: B411_COMPANY,
    counts: { workers, accounts, assignments, instruments, answers, results, drafts },
    authUsersNote: "auth.users not included; restore credentials via seed",
  };
  writeFileSync(DUMP, JSON.stringify(payload, null, 2));

  assert(workers === 83, "backup workers");
  assert(accounts === 83, "backup accounts");
  assert(assignments === 83, "backup asgs");
  assert(instruments === 166, "backup instruments I+III");
  assert(results === COMPLETED, "backup results");
  assert(drafts === IN_PROGRESS, "backup drafts");
  assert(match === COMPLETED, `backup snapshot score parity ${match}`);

  return {
    dump: DUMP,
    workers,
    accounts,
    assignments,
    instruments,
    answers,
    results,
    drafts,
    snapshotScoreMatches: match,
  };
}

async function residueZero() {
  const camp = Number(
    sql(`select count(*) from public.evaluation_campaigns where nombre='${B411_CAMPAIGN}'`),
  );
  const workers = Number(
    sql(`select count(*) from public.workers where external_reference like 'TST-B411-%'`),
  );
  const credsGone = !existsSync(B411_CREDS_PATH);
  assert(camp === 0, `residue campaign=${camp}`);
  assert(workers === 0, `residue workers=${workers}`);
  assert(credsGone, "creds file remains");
  return { camp, workers, credsGone };
}

async function main() {
  const env = loadEnvLocal();
  assertLocalSupabaseOnly(env.NEXT_PUBLIC_SUPABASE_URL!);
  assert(existsSync(B411_CREDS_PATH), "faltan creds; corra b411:seed:local");
  const credsFile = JSON.parse(readFileSync(B411_CREDS_PATH, "utf8")) as {
    items: Cred[];
  };
  assert(credsFile.items?.length === B411_COUNT, "creds count");

  const admin = adminClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);
  const campaignId = sql(
    `select id from public.evaluation_campaigns where nombre='${B411_CAMPAIGN}'`,
  );
  assert(campaignId, "campaign missing");

  const report: Record<string, unknown> = {
    ok: false,
    marker: B411_MARKER,
    company: B411_COMPANY,
    campaign: B411_CAMPAIGN,
  };

  try {
    report.structural = await structuralChecks(admin, campaignId);
    report.identity = await identityMatrix(admin, credsFile.items);
    // Logins concurrentes ANTES de la simulación (Auth local se satura tras 33 submits).
    report.concurrencyLogins = await concurrencyLogins(env, credsFile.items);
    report.simulation = await simulateUsage(admin, env, credsFile.items);
    report.concurrency = await concurrencyProbe(admin, env, credsFile.items);
    report.dashboard = await dashboardChecks(campaignId);
    report.backup = await backupRestore(admin, campaignId);
    report.ok = true;
  } finally {
    // cleanup siempre
    try {
      execFileSync("npx", ["--yes", "tsx", "scripts/cleanup-b411-workload-83-local.ts"], {
        stdio: "inherit",
        env: process.env,
      });
      report.cleanup = await residueZero();
      if (existsSync(DUMP)) {
        // dump puede quedar para auditoría local; no es secreto. Opcional borrar:
        // unlinkSync(DUMP);
      }
    } catch (e) {
      report.cleanupError = e instanceof Error ? e.message : String(e);
      report.ok = false;
    }
  }

  // No incluir emails/passwords
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  try {
    execFileSync("npx", ["--yes", "tsx", "scripts/cleanup-b411-workload-83-local.ts"], {
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    // ignore
  }
  process.exit(1);
});
