/**
 * B4.15.2 — Campaña draft + 83 assignments I+III (0 II).
 * No crea Auth, no toca passwords, no abre campaña.
 *
 * Dry-run:
 *   ALLOW_PRODUCTION_ACCOUNTS=B414_CREATE_83 NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   npx tsx scripts/b4152-create-campaign-assignments-83.ts
 *
 * Ejecutar:
 *   … B4152_EXECUTE=1 npx tsx scripts/b4152-create-campaign-assignments-83.ts
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  loadProductionEnv,
  sanitizeRef,
  resolveExpectedProjectRef,
  assertRefsMatch,
  extractProjectRefFromUrl,
} from "./lib/assert-production-only";

const ALLOW = "B414_CREATE_83";
const CAMPAIGN_NAME = "Evaluación NOM-035 2026";
const VERSION = "nom035-stps-2018-guias-referencia-i-iii";
const BATCH = 15;

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

function tokenPlaceholder() {
  const raw = randomBytes(32).toString("hex");
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    last4: raw.slice(-4),
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function refHash(ref: string): string {
  return createHash("sha256").update(ref).digest("hex").slice(0, 12);
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
  const { sanitized } = assertAllow(merged);
  const execute = process.env.B4152_EXECUTE === "1";

  const url = merged.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta URL/secret");

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });

  const { data: company } = await admin
    .from("company_settings")
    .select("id,razon_social,total_trabajadores")
    .limit(1)
    .maybeSingle();
  if (!company || company.razon_social !== "NOM035_EMPRESA_OPERATIVA") {
    throw new Error("ABORT: empresa operativa incorrecta");
  }
  if (company.total_trabajadores !== 83) {
    throw new Error(`ABORT: total_trabajadores=${company.total_trabajadores}`);
  }

  const { data: workersRaw } = await admin
    .from("workers")
    .select("id,external_reference,activo")
    .eq("activo", true);
  const workers = (workersRaw ?? []).filter(
    (w) => w.external_reference && /^[0-9]+$/.test(String(w.external_reference))
  );
  if (workers.length !== 83) throw new Error(`ABORT: workers=${workers.length}`);

  const { data: accounts } = await admin
    .from("worker_accounts")
    .select("worker_id,auth_user_id,is_active,must_change_password,username_normalized");
  const accByWorker = new Map((accounts ?? []).map((a) => [a.worker_id, a]));

  let linked = 0;
  let mustFalse = 0;
  let withoutAccount = 0;
  for (const w of workers) {
    const a = accByWorker.get(w.id);
    if (!a || !a.is_active) {
      withoutAccount += 1;
      continue;
    }
    linked += 1;
    if (!a.must_change_password) mustFalse += 1;
  }
  if (linked !== 83) throw new Error(`ABORT: wa_linked=${linked}`);
  if (mustFalse !== 83) throw new Error(`ABORT: must_false=${mustFalse}`);
  if (withoutAccount !== 0) throw new Error(`ABORT: withoutAccount=${withoutAccount}`);

  const orphanAccounts = (accounts ?? []).filter((a) => !workers.some((w) => w.id === a.worker_id));
  // orphanos activos numéricos: 0 (pueden existir sintéticos inactivos)
  const orphanActive = orphanAccounts.filter((a) => a.is_active);
  if (orphanActive.length !== 0) {
    throw new Error(`ABORT: orphanActive=${orphanActive.length}`);
  }

  const { data: existingCamp } = await admin
    .from("evaluation_campaigns")
    .select("id,nombre,status,questionnaire_version,activated_at")
    .eq("nombre", CAMPAIGN_NAME)
    .maybeSingle();

  let campaignId = existingCamp?.id ?? null;
  const campaignExists = !!existingCamp;

  let existingAsgCount = 0;
  if (campaignId) {
    const { count } = await admin
      .from("evaluation_assignments")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .neq("status", "revoked");
    existingAsgCount = count ?? 0;
  }

  const { count: asgActiveOther } = await admin
    .from("evaluation_assignments")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "in_progress", "completed"]);

  const { count: legacyRevoked } = await admin
    .from("evaluation_assignments")
    .select("id", { count: "exact", head: true })
    .eq("status", "revoked");

  const { count: draftsLegacy } = await admin
    .from("evaluation_drafts")
    .select("assignment_id", { count: "exact", head: true });

  const toCreate = campaignExists ? Math.max(0, 83 - existingAsgCount) : 83;

  const plan = {
    ok: true,
    dryRun: !execute,
    refSanitized: sanitized,
    campaignName: CAMPAIGN_NAME,
    campaignExists,
    campaignStatus: existingCamp?.status ?? null,
    campaignWouldCreate: campaignExists ? 0 : 1,
    workersEligible: 83,
    workerAccountsActive: 83,
    authLinked: 83,
    workersWithoutAccount: 0,
    accountsWithoutWorkerActive: 0,
    assignmentsExistingOnCampaign: existingAsgCount,
    assignmentsToCreate: toCreate,
    guiaIToCreate: toCreate,
    guiaIIIToCreate: toCreate,
    guiaIIToCreate: 0,
    asgActiveOther: asgActiveOther ?? 0,
    legacyRevoked: legacyRevoked ?? 0,
    draftsLegacy: draftsLegacy ?? 0,
    passwordsTouched: false,
    campaignOpen: false,
  };

  if ((asgActiveOther ?? 0) > 0 && existingAsgCount === 0) {
    throw new Error(`ABORT: hay assignments activos fuera del plan (${asgActiveOther})`);
  }
  if ((legacyRevoked ?? 0) !== 2) {
    throw new Error(`ABORT: legacy_revoked=${legacyRevoked} esperado 2`);
  }
  if ((draftsLegacy ?? 0) !== 2) {
    throw new Error(`ABORT: drafts=${draftsLegacy} esperado 2`);
  }

  if (!execute) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  // Crear campaña draft si no existe
  if (!campaignId) {
    const { data, error } = await admin
      .from("evaluation_campaigns")
      .insert({
        nombre: CAMPAIGN_NAME,
        descripcion: "Campaña productiva NOM-035 · Guía I + Guía III · N=83",
        status: "draft",
        questionnaire_version: VERSION,
        activated_at: null,
        closed_at: null,
      })
      .select("id,status")
      .single();
    if (error || !data) throw new Error(error?.message ?? "campaign create");
    if (data.status !== "draft") throw new Error("ABORT: campaña no quedó en draft");
    campaignId = data.id;
    await admin.from("audit_log").insert({
      action: "b4152_campaign_draft_created",
      entity_type: "evaluation_campaign",
      entity_id: campaignId,
      metadata: { nombre: CAMPAIGN_NAME, version: VERSION, n: 83 },
    });
  } else {
    if (existingCamp!.status !== "draft") {
      throw new Error(`ABORT: campaña existente status=${existingCamp!.status}`);
    }
    if (existingCamp!.activated_at) {
      throw new Error("ABORT: campaña tiene activated_at");
    }
    // Asegurar version I+III
    if (existingCamp!.questionnaire_version !== VERSION) {
      const { error } = await admin
        .from("evaluation_campaigns")
        .update({ questionnaire_version: VERSION })
        .eq("id", campaignId)
        .eq("status", "draft");
      if (error) throw new Error(error.message);
    }
  }

  // Workers sin assignment en esta campaña
  const { data: existingAsgs } = await admin
    .from("evaluation_assignments")
    .select("worker_id")
    .eq("campaign_id", campaignId);
  const hasAsg = new Set((existingAsgs ?? []).map((a) => a.worker_id));
  const pendingWorkers = workers.filter((w) => !hasAsg.has(w.id));

  let createdAsg = 0;
  let createdI = 0;
  let createdIII = 0;
  const createdII = 0;

  for (let i = 0; i < pendingWorkers.length; i += BATCH) {
    const batch = pendingWorkers.slice(i, i + BATCH);
    for (const w of batch) {
      const acc = accByWorker.get(w.id);
      if (!acc?.is_active) {
        throw new Error(`ABORT: sin cuenta activa refHash=${refHash(String(w.external_reference))}`);
      }

      // Re-check existencia (idempotencia segura)
      const { data: again } = await admin
        .from("evaluation_assignments")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("worker_id", w.id)
        .maybeSingle();
      if (again) continue;

      const tok = tokenPlaceholder();
      const { data: asg, error: asgErr } = await admin
        .from("evaluation_assignments")
        .insert({
          campaign_id: campaignId,
          worker_id: w.id,
          token_hash: tok.hash,
          token_last4: tok.last4,
          status: "pending",
          questionnaire_version: VERSION,
        })
        .select("id")
        .single();
      if (asgErr || !asg) {
        throw new Error(
          `assignment refHash=${refHash(String(w.external_reference))}: ${asgErr?.message}`
        );
      }
      createdAsg += 1;

      const ensured = await admin.rpc("ensure_assignment_questionnaires", {
        p_assignment_id: asg.id,
      });
      if (ensured.error) {
        throw new Error(`AQ refHash=${refHash(String(w.external_reference))}: ${ensured.error.message}`);
      }

      const { data: instruments } = await admin
        .from("assignment_questionnaires")
        .select("questionnaire_type")
        .eq("assignment_id", asg.id);
      const types = (instruments ?? []).map((r) => r.questionnaire_type).sort();
      if (types.join(",") !== "GUIA_I,GUIA_III") {
        throw new Error(
          `ABORT instrumentos ${types.join(",")} refHash=${refHash(String(w.external_reference))}`
        );
      }
      createdI += 1;
      createdIII += 1;

      await admin.from("audit_log").insert({
        action: "b4152_assignment_created",
        entity_type: "evaluation_assignment",
        entity_id: asg.id,
        metadata: {
          campaignId,
          workerRefHash: refHash(String(w.external_reference)),
          instruments: ["GUIA_I", "GUIA_III"],
        },
      });
    }
    if (i + BATCH < pendingWorkers.length) await sleep(200);
  }

  // Conteos finales
  const { count: asgFinal } = await admin
    .from("evaluation_assignments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const { data: allAsgIds } = await admin
    .from("evaluation_assignments")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  const ids = (allAsgIds ?? []).map((a) => a.id);

  let guiaI = 0;
  let guiaIII = 0;
  let guiaII = 0;
  if (ids.length) {
    const { data: aq } = await admin
      .from("assignment_questionnaires")
      .select("questionnaire_type")
      .in("assignment_id", ids);
    for (const row of aq ?? []) {
      if (row.questionnaire_type === "GUIA_I") guiaI += 1;
      else if (row.questionnaire_type === "GUIA_III") guiaIII += 1;
      else if (row.questionnaire_type === "GUIA_II") guiaII += 1;
    }
  }

  const { count: sessionsNew } = await admin
    .from("evaluation_sessions")
    .select("id", { count: "exact", head: true })
    .in("assignment_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const { count: answersNew } = await admin
    .from("evaluation_answers")
    .select("id", { count: "exact", head: true })
    .in("assignment_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const { count: resultsNew } = await admin
    .from("evaluation_results")
    .select("id", { count: "exact", head: true })
    .in("assignment_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  if ((asgFinal ?? 0) !== 83) throw new Error(`POST: asg_pending=${asgFinal}`);
  if (guiaI !== 83 || guiaIII !== 83 || guiaII !== 0) {
    throw new Error(`POST: I=${guiaI} III=${guiaIII} II=${guiaII}`);
  }
  if ((sessionsNew ?? 0) !== 0) throw new Error(`POST: sessions=${sessionsNew}`);
  if ((answersNew ?? 0) !== 0) throw new Error(`POST: answers=${answersNew}`);
  if ((resultsNew ?? 0) !== 0) throw new Error(`POST: results=${resultsNew}`);

  const { data: camp } = await admin
    .from("evaluation_campaigns")
    .select("id,status,activated_at,nombre")
    .eq("id", campaignId)
    .single();

  console.log(
    JSON.stringify(
      {
        ok: true,
        execute: true,
        refSanitized: sanitized,
        campaignIdSanitized: String(campaignId).slice(0, 8) + "…",
        campaignName: camp?.nombre,
        campaignStatus: camp?.status,
        activatedAt: camp?.activated_at,
        createdThisRun: {
          campaign: campaignExists ? 0 : 1,
          assignments: createdAsg,
          guiaI: createdI,
          guiaIII: createdIII,
          guiaII: createdII,
        },
        totals: {
          assignmentsPending: asgFinal,
          guiaI,
          guiaIII,
          guiaII,
          sessions: sessionsNew ?? 0,
          answers: answersNew ?? 0,
          results: resultsNew ?? 0,
          legacyRevoked: 2,
          draftsLegacy: 2,
        },
        passwordsModified: 0,
        usernamesModified: 0,
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
