/**
 * Smoke productivo del piloto: login HTTP + flujo I→III vía RPC + seguridad básica.
 * No imprime passwords.
 *
 *   CONFIRM_PRODUCTION_PILOT=YES NOM035_TARGET_ENV=production npm run b412:pilot:smoke
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";
import { assertNoCsvImport } from "./lib/b412-pilot-policy";
import {
  B412_PILOT_CAMPAIGN,
  B412_PILOT_CREDS_PATH,
  B412_PILOT_MARKER,
  B412_PILOT_REF,
  B412_PILOT_VERSION,
} from "./lib/b412-pilot-constants";
import {
  prepareCanonicalSubmission,
  recalculateFrpSnapshotMatch,
} from "../src/lib/nom035/server/public-evaluation-service";
import { NOM035_I_III_QUESTIONNAIRE_VERSION } from "../src/data/nom035/guia-iii-manifest";
import type { GuiaIIIAnswers, GuiaIILikertAnswer } from "../src/types/nom035";

type Creds = {
  username: string;
  password: string;
  workerId: string;
  authUserId: string;
  assignmentId: string;
  campaignId: string;
};

function loadCreds(): Creds {
  if (!existsSync(B412_PILOT_CREDS_PATH)) {
    throw new Error("Falta creds piloto; ejecute b412:pilot:seed");
  }
  return JSON.parse(readFileSync(B412_PILOT_CREDS_PATH, "utf8")) as Creds;
}

function sqlScalar(q: string): string {
  const pw = process.env.SUPABASE_DB_PASSWORD;
  if (!pw) throw new Error("SUPABASE_DB_PASSWORD requerido");
  const out = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--output", "json", q],
    {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_DB_PASSWORD: pw },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const parsed = JSON.parse(out.replace(/\u001b\[[0-9;]*m/g, "").trim()) as {
    rows?: Array<Record<string, unknown>>;
  };
  const row = parsed.rows?.[0];
  if (!row) return "";
  const v = Object.values(row)[0];
  return v == null ? "" : String(v);
}

function buildGuiaIII(): GuiaIIIAnswers {
  const responses: Record<number, GuiaIILikertAnswer> = {};
  for (let n = 1; n <= 64; n += 1) responses[n] = "nunca";
  return { gateClientes: "no", gateJefe: "no", responses };
}

function prepareIPlusIII(guiaIII: GuiaIIIAnswers) {
  return prepareCanonicalSubmission(
    { guiaI: { responses: { guia_i_1: 0 } }, guiaIII },
    { questionnaireVersion: NOM035_I_III_QUESTIONNAIRE_VERSION }
  );
}

async function main() {
  const env = loadProductionEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY!;
  const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://nom035-production.vercel.app").replace(
    /\/$/,
    ""
  );
  assertNoCsvImport(env);
  assertProductionPilotGuards({ url, env });
  if (!process.env.SUPABASE_DB_PASSWORD) throw new Error("SUPABASE_DB_PASSWORD ausente");

  const creds = loadCreds();
  const report: Record<string, unknown> = { marker: B412_PILOT_MARKER, appUrl };

  const originHeaders = {
    "content-type": "application/json",
    origin: appUrl,
  };

  const bad = await fetch(`${appUrl}/api/trabajador/login`, {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ username: creds.username, password: "not-the-password" }),
  });
  const badBody = (await bad.json().catch(() => ({}))) as { code?: string; message?: string };
  report.invalidLoginStatus = bad.status;
  report.invalidLoginGeneric =
    bad.status === 401 && badBody.code === "invalid_credentials";

  const good = await fetch(`${appUrl}/api/trabajador/login`, {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  report.loginStatus = good.status;
  report.loginCookies = Boolean(good.headers.get("set-cookie"));

  const adminDenied = await fetch(`${appUrl}/api/admin/nom035/dashboard`);
  report.adminApiUnauth = adminDenied.status;

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });

  const sessionPepper = env.NOM035_SESSION_PEPPER!;
  const tokenHash = sqlScalar(
    `select token_hash as v from public.evaluation_assignments where id='${creds.assignmentId}'`
  );
  if (tokenHash.length < 10) throw new Error("token_hash missing");

  const session = `es_${randomBytes(32).toString("base64url")}`;
  const sessionHash = createHmac("sha256", sessionPepper).update(session, "utf8").digest("hex");
  const exchanged = await admin.rpc("exchange_evaluation_token", {
    p_token_hash: tokenHash,
    p_session_hash: sessionHash,
    p_session_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });
  if (exchanged.error || exchanged.data?.ok !== true) {
    throw new Error(`exchange failed ${JSON.stringify({ err: exchanged.error, data: exchanged.data })}`);
  }
  const started = await admin.rpc("start_public_evaluation", { p_session_hash: sessionHash });
  if (started.error || started.data?.ok !== true) {
    throw new Error(`start failed ${JSON.stringify(started)}`);
  }

  const draftMarker = `${B412_PILOT_MARKER}-draft`;
  const saved = await admin.rpc("save_public_evaluation_draft", {
    p_session_hash: sessionHash,
    p_payload: {
      stage: "GUIA_III",
      guiaI: { responses: { guia_i_1: 0 } },
      guiaIII: { gateClientes: "no", gateJefe: "no", responses: { 1: "nunca" } },
      marker: draftMarker,
    },
  });
  if (saved.error || saved.data?.ok !== true) {
    throw new Error(`draft ${JSON.stringify(saved)}`);
  }
  report.draftRecovered =
    sqlScalar(
      `select payload->>'marker' as v from public.evaluation_drafts where assignment_id='${creds.assignmentId}'`
    ) === draftMarker;

  const guiaIII = buildGuiaIII();
  const built = prepareIPlusIII(guiaIII);
  const submissionId = randomUUID();
  const submitted = await admin.rpc("submit_public_evaluation", {
    p_session_hash: sessionHash,
    p_submission_id: submissionId,
    p_answers: built.answers,
    p_result: built.result,
    p_questionnaire_version: built.questionnaireVersion,
    p_scoring_version: built.scoringVersion,
    p_calculated_at: built.calculatedAt,
  });
  report.submitOk = submitted.data?.ok === true;
  if (!report.submitOk) throw new Error(`submit ${JSON.stringify(submitted)}`);

  const again = await admin.rpc("submit_public_evaluation", {
    p_session_hash: sessionHash,
    p_submission_id: submissionId,
    p_answers: built.answers,
    p_result: built.result,
    p_questionnaire_version: built.questionnaireVersion,
    p_scoring_version: built.scoringVersion,
    p_calculated_at: built.calculatedAt,
  });
  report.idempotentSubmit =
    again.data?.ok === true ||
    ["conflict", "session_revoked", "no_session", "already_submitted"].includes(
      String(again.data?.code ?? "")
    );

  const snapJson = sqlScalar(
    `select coalesce(result_snapshot::text,'') as v from public.evaluation_results where assignment_id='${creds.assignmentId}'`
  );
  const snapshot = JSON.parse(snapJson || "{}") as Record<string, unknown>;
  const match = recalculateFrpSnapshotMatch({
    frp: "GUIA_III",
    guiaIResponses: [{ questionId: "guia_i_1", value: 0 }],
    frpAnswers: guiaIII,
    snapshot,
  });
  report.snapshotMatch = match.match;

  const g1 = Number(
    sqlScalar(
      `select count(*)::text as v from public.assignment_questionnaires where assignment_id='${creds.assignmentId}' and questionnaire_type='GUIA_I' and status='submitted'`
    )
  );
  const g2 = Number(
    sqlScalar(
      `select count(*)::text as v from public.assignment_questionnaires where assignment_id='${creds.assignmentId}' and questionnaire_type='GUIA_II'`
    )
  );
  const g3 = Number(
    sqlScalar(
      `select count(*)::text as v from public.assignment_questionnaires where assignment_id='${creds.assignmentId}' and questionnaire_type='GUIA_III' and status='submitted'`
    )
  );
  const dupResults = Number(
    sqlScalar(
      `select count(*)::text as v from (select 1 from public.evaluation_results where assignment_id='${creds.assignmentId}' group by assignment_id having count(*)>1) s`
    )
  );

  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: leak, error: leakErr } = await anonClient
    .from("evaluation_results")
    .select("id")
    .eq("assignment_id", creds.assignmentId);
  report.anonResultsDenied = leakErr != null || !leak || leak.length === 0;

  report.db = {
    ref: B412_PILOT_REF,
    campaign: B412_PILOT_CAMPAIGN,
    version: B412_PILOT_VERSION,
    guiaISubmitted: g1,
    guiaII: g2,
    guiaIIISubmitted: g3,
    dupResults,
    asgStatus: sqlScalar(
      `select status as v from public.evaluation_assignments where id='${creds.assignmentId}'`
    ),
  };

  const ok =
    report.invalidLoginGeneric === true &&
    Number(report.loginStatus) === 200 &&
    Number(report.adminApiUnauth) !== 200 &&
    report.draftRecovered === true &&
    report.submitOk === true &&
    report.snapshotMatch === true &&
    g1 === 1 &&
    g2 === 0 &&
    g3 === 1 &&
    dupResults === 0 &&
    report.anonResultsDenied === true;

  console.log(JSON.stringify({ ok, ...report }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
