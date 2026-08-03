/**
 * Piloto sintético único en nom035-production (TST-PROD-PILOT-001).
 * No usa CSV; no imprime password; dry-run con B412_PILOT_DRY_RUN=1.
 *
 * Requiere:
 *   ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY
 *   EXPECTED_SUPABASE_PROJECT_REF=<ref>
 *   CONFIRM_SUPABASE_PROJECT_REF=<mismo ref>
 *   NOM035_TARGET_ENV=production
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";
import {
  assertExactPilotCampaign,
  assertExactPilotWorkerRef,
  assertNoCsvImport,
  assertNotMassOperation,
  assertPilotEmail,
  assertPilotUsername,
  assertSinglePilotCount,
  isPilotDryRun,
} from "./lib/b412-pilot-policy";
import {
  B412_PILOT_CAMPAIGN,
  B412_PILOT_CREDS_PATH,
  B412_PILOT_EMAIL,
  B412_PILOT_MARKER,
  B412_PILOT_REF,
  B412_PILOT_USERNAME,
  B412_PILOT_VERSION,
} from "./lib/b412-pilot-constants";

function tokenPlaceholder() {
  const raw = randomBytes(32).toString("hex");
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    last4: raw.slice(-4),
  };
}

async function main() {
  const env = loadProductionEnv();
  assertNoCsvImport(env);
  assertExactPilotWorkerRef(B412_PILOT_REF);
  assertExactPilotCampaign(B412_PILOT_CAMPAIGN);
  assertPilotEmail(B412_PILOT_EMAIL);
  assertPilotUsername(B412_PILOT_USERNAME);

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta URL/secret de producción");
  const { sanitized } = assertProductionPilotGuards({ url, env });
  const dryRun = isPilotDryRun(env);

  if (dryRun) {
    console.log(
      JSON.stringify({
        ok: true,
        dryRun: true,
        writes: false,
        ref: B412_PILOT_REF,
        campaign: B412_PILOT_CAMPAIGN,
        refSanitized: sanitized,
        passwordPrinted: false,
      })
    );
    return;
  }

  const password = `Nom035-Pilot#${randomBytes(12).toString("base64url")}`;
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });

  const { data: company } = await admin
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!company) {
    throw new Error("ABORT: company_settings vacío");
  }

  const { data: pilotWorkers } = await admin
    .from("workers")
    .select("external_reference")
    .like("external_reference", "TST-PROD-PILOT%");
  assertSinglePilotCount((pilotWorkers ?? []).map((w) => w.external_reference ?? ""));
  assertNotMassOperation((pilotWorkers ?? []).length <= 1 ? (pilotWorkers ?? []).length : 99, 1);

  // Una sola campaña active: cerrar otras sin borrarlas.
  await admin
    .from("evaluation_campaigns")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active")
    .neq("nombre", B412_PILOT_CAMPAIGN);

  let campaignId: string;
  const { data: existingCamp } = await admin
    .from("evaluation_campaigns")
    .select("id,nombre")
    .eq("nombre", B412_PILOT_CAMPAIGN)
    .maybeSingle();
  if (existingCamp) {
    assertExactPilotCampaign(existingCamp.nombre);
    campaignId = existingCamp.id;
    const { error } = await admin
      .from("evaluation_campaigns")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
        closed_at: null,
        questionnaire_version: B412_PILOT_VERSION,
        descripcion: `${B412_PILOT_MARKER} campaña temporal I+III`,
      })
      .eq("id", campaignId)
      .eq("nombre", B412_PILOT_CAMPAIGN);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from("evaluation_campaigns")
      .insert({
        nombre: B412_PILOT_CAMPAIGN,
        descripcion: `${B412_PILOT_MARKER} campaña temporal I+III`,
        status: "active",
        activated_at: new Date().toISOString(),
        questionnaire_version: B412_PILOT_VERSION,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "campaign");
    campaignId = data.id;
  }

  let workerId: string;
  const { data: existingWorker } = await admin
    .from("workers")
    .select("id,external_reference")
    .eq("external_reference", B412_PILOT_REF)
    .maybeSingle();
  if (existingWorker) {
    assertExactPilotWorkerRef(existingWorker.external_reference);
    workerId = existingWorker.id;
    await admin
      .from("workers")
      .update({
        nombre: "Trabajador Sintetico Prod Pilot 001",
        puesto: "Puesto Sintetico Pilot",
        departamento: "Dept Sintetico Pilot",
        activo: true,
      })
      .eq("id", workerId)
      .eq("external_reference", B412_PILOT_REF);
  } else {
    const { data, error } = await admin
      .from("workers")
      .insert({
        nombre: "Trabajador Sintetico Prod Pilot 001",
        puesto: "Puesto Sintetico Pilot",
        departamento: "Dept Sintetico Pilot",
        external_reference: B412_PILOT_REF,
        activo: true,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "worker");
    workerId = data.id;
  }

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let authUserId =
    listed.data.users.find((u) => (u.email || "").toLowerCase() === B412_PILOT_EMAIL)?.id ??
    null;
  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      app_metadata: { role: "worker" },
      user_metadata: { marker: B412_PILOT_MARKER, synthetic: true },
    });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: B412_PILOT_EMAIL,
      password,
      email_confirm: true,
      app_metadata: { role: "worker" },
      user_metadata: { marker: B412_PILOT_MARKER, synthetic: true },
    });
    if (error || !data.user) throw new Error(error?.message ?? "auth create");
    authUserId = data.user.id;
  }

  const { error: accErr } = await admin.from("worker_accounts").upsert(
    {
      company_id: company.id,
      worker_id: workerId,
      auth_user_id: authUserId,
      username_normalized: B412_PILOT_USERNAME,
      is_active: true,
      must_change_password: true,
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
  if (oldAsg) {
    await admin.from("assignment_questionnaires").delete().eq("assignment_id", oldAsg.id);
    await admin.from("evaluation_answers").delete().eq("assignment_id", oldAsg.id);
    await admin.from("evaluation_results").delete().eq("assignment_id", oldAsg.id);
    await admin.from("evaluation_drafts").delete().eq("assignment_id", oldAsg.id);
    await admin.from("evaluation_sessions").delete().eq("assignment_id", oldAsg.id);
    await admin.from("evaluation_assignments").delete().eq("id", oldAsg.id);
  }

  const tok = tokenPlaceholder();
  const { data: asg, error: asgErr } = await admin
    .from("evaluation_assignments")
    .insert({
      campaign_id: campaignId,
      worker_id: workerId,
      token_hash: tok.hash,
      token_last4: tok.last4,
      status: "pending",
      questionnaire_version: B412_PILOT_VERSION,
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
    throw new Error(`ABORT: instrumentos inesperados ${types.join(",")}`);
  }

  mkdirSync(dirname(B412_PILOT_CREDS_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(
    B412_PILOT_CREDS_PATH,
    JSON.stringify(
      {
        marker: B412_PILOT_MARKER,
        ref: B412_PILOT_REF,
        username: B412_PILOT_USERNAME,
        email: B412_PILOT_EMAIL,
        password,
        workerId,
        authUserId,
        campaignId,
        assignmentId: asg.id,
        createdAtUtc: new Date().toISOString(),
        refSanitized: sanitized,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  console.log(
    JSON.stringify({
      ok: true,
      dryRun: false,
      ref: B412_PILOT_REF,
      campaign: B412_PILOT_CAMPAIGN,
      instruments: types,
      guiaII: 0,
      credsPath: B412_PILOT_CREDS_PATH,
      refSanitized: sanitized,
      passwordPrinted: false,
    })
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
