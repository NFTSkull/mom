/**
 * Seed LOCAL B4.11 — 83 trabajadores sintéticos I+III (0 II).
 * Solo localhost. Credenciales en archivo temporal ignorado; no imprime passwords.
 *
 *   B411_TEST_PASSWORD_PREFIX='...' npm run b411:seed:local
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertLocalSupabaseOnly,
  loadEnvLocal,
} from "./lib/assert-local-supabase-only";
import {
  B411_CAMPAIGN,
  B411_COMPANY,
  B411_COUNT,
  B411_CREDS_PATH,
  B411_EMAIL_DOMAIN,
  B411_MARKER,
  B411_VERSION,
} from "./lib/b411-constants";

export {
  B411_CAMPAIGN,
  B411_COMPANY,
  B411_COUNT,
  B411_CREDS_PATH,
  B411_EMAIL_DOMAIN,
  B411_MARKER,
  B411_VERSION,
} from "./lib/b411-constants";

function tokenPlaceholder() {
  const raw = randomBytes(32).toString("hex");
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    last4: raw.slice(-4),
  };
}

function workerSpec(i: number) {
  const n = String(i).padStart(3, "0");
  return {
    ref: `TST-B411-${n}`,
    nombre: `Trabajador Sintetico B411 ${n}`,
    username: `tst.b411.${n}`,
    email: `tst.b411.${n}@${B411_EMAIL_DOMAIN}`,
    departamento: `Dept Sintetico B411 ${((i - 1) % 5) + 1}`,
    puesto: `Puesto Sintetico B411 ${((i - 1) % 7) + 1}`,
  };
}

function uniquePassword(prefix: string, i: number): string {
  return `${prefix}${String(i).padStart(3, "0")}-${randomBytes(6).toString("hex")}`;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta .env.local");
  assertLocalSupabaseOnly(url);

  const passwordPrefix = env.B411_TEST_PASSWORD_PREFIX || "Nom035-B411#Local";
  const options: { auth: object; realtime?: { transport: new () => unknown } } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: class {} as never };
  }
  const admin = createClient(url, secret, options as never);

  let companyId: string;
  const { data: companyExisting } = await admin
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (companyExisting) {
    companyId = companyExisting.id;
    const { error } = await admin
      .from("company_settings")
      .update({
        razon_social: B411_COMPANY,
        rfc: "EB4110000XXX",
        domicilio: "Local sintetico B411",
        actividad_principal: "Prueba carga B411",
        total_trabajadores: B411_COUNT,
        responsable_nombre: "RH Sintetico B411",
        responsable_email: `rh.b411@${B411_EMAIL_DOMAIN}`,
      })
      .eq("id", companyId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from("company_settings")
      .insert({
        razon_social: B411_COMPANY,
        rfc: "EB4110000XXX",
        domicilio: "Local sintetico B411",
        actividad_principal: "Prueba carga B411",
        total_trabajadores: B411_COUNT,
        responsable_nombre: "RH Sintetico B411",
        responsable_email: `rh.b411@${B411_EMAIL_DOMAIN}`,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "company");
    companyId = data.id;
  }

  await admin
    .from("evaluation_campaigns")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active")
    .neq("nombre", B411_CAMPAIGN);

  let campaignId: string;
  const { data: existingCamp } = await admin
    .from("evaluation_campaigns")
    .select("id")
    .eq("nombre", B411_CAMPAIGN)
    .maybeSingle();
  if (existingCamp) {
    campaignId = existingCamp.id;
    await admin
      .from("evaluation_campaigns")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
        closed_at: null,
        questionnaire_version: B411_VERSION,
        descripcion: "Campana sintetica B411 I+III (83)",
      })
      .eq("id", campaignId);
  } else {
    const { data, error } = await admin
      .from("evaluation_campaigns")
      .insert({
        nombre: B411_CAMPAIGN,
        descripcion: "Campana sintetica B411 I+III (83)",
        status: "active",
        activated_at: new Date().toISOString(),
        questionnaire_version: B411_VERSION,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "campaign");
    campaignId = data.id;
  }

  const creds: Array<{
    ref: string;
    username: string;
    email: string;
    password: string;
    workerId: string;
    authUserId: string;
    assignmentId: string;
  }> = [];

  for (let i = 1; i <= B411_COUNT; i += 1) {
    const w = workerSpec(i);
    const password = uniquePassword(passwordPrefix, i);

    let workerId: string;
    const { data: existingWorker } = await admin
      .from("workers")
      .select("id")
      .eq("external_reference", w.ref)
      .maybeSingle();
    if (existingWorker) {
      workerId = existingWorker.id;
      await admin
        .from("workers")
        .update({
          nombre: w.nombre,
          puesto: w.puesto,
          departamento: w.departamento,
          sucursal: B411_MARKER,
          activo: true,
        })
        .eq("id", workerId);
    } else {
      const { data, error } = await admin
        .from("workers")
        .insert({
          nombre: w.nombre,
          puesto: w.puesto,
          departamento: w.departamento,
          sucursal: B411_MARKER,
          external_reference: w.ref,
          activo: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? `worker ${w.ref}`);
      workerId = data.id;
    }

    const { data: asgExisting } = await admin
      .from("evaluation_assignments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("worker_id", workerId)
      .maybeSingle();
    if (asgExisting) {
      await admin.from("assignment_questionnaires").delete().eq("assignment_id", asgExisting.id);
      await admin.from("evaluation_answers").delete().eq("assignment_id", asgExisting.id);
      await admin.from("evaluation_results").delete().eq("assignment_id", asgExisting.id);
      await admin.from("evaluation_drafts").delete().eq("assignment_id", asgExisting.id);
      await admin.from("evaluation_sessions").delete().eq("assignment_id", asgExisting.id);
      await admin.from("evaluation_assignments").delete().eq("id", asgExisting.id);
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
        questionnaire_version: B411_VERSION,
      })
      .select("id")
      .single();
    if (asgErr || !asg) throw new Error(asgErr?.message ?? `assignment ${w.ref}`);

    const ensured = await admin.rpc("ensure_assignment_questionnaires", {
      p_assignment_id: asg.id,
    });
    if (ensured.error) throw new Error(ensured.error.message);

    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let authUser = listed.data.users.find(
      (u) => (u.email || "").toLowerCase() === w.email,
    );
    if (!authUser) {
      const created = await admin.auth.admin.createUser({
        email: w.email,
        password,
        email_confirm: true,
        app_metadata: { role: "worker" },
        user_metadata: { synthetic: true, marker: B411_MARKER },
      });
      if (created.error || !created.data.user) {
        throw new Error(created.error?.message || `auth ${w.ref}`);
      }
      authUser = created.data.user;
    } else {
      await admin.auth.admin.updateUserById(authUser.id, {
        password,
        app_metadata: { role: "worker" },
        email_confirm: true,
        user_metadata: { synthetic: true, marker: B411_MARKER },
      });
    }

    const { error: accErr } = await admin.from("worker_accounts").upsert(
      {
        company_id: companyId,
        worker_id: workerId,
        auth_user_id: authUser.id,
        username_normalized: w.username,
        is_active: true,
        must_change_password: true,
      },
      { onConflict: "worker_id" },
    );
    if (accErr) throw new Error(accErr.message);

    creds.push({
      ref: w.ref,
      username: w.username,
      email: w.email,
      password,
      workerId,
      authUserId: authUser.id,
      assignmentId: asg.id,
    });
  }

  mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
  writeFileSync(
    B411_CREDS_PATH,
    JSON.stringify(
      {
        marker: B411_MARKER,
        company: B411_COMPANY,
        campaign: B411_CAMPAIGN,
        createdAt: new Date().toISOString(),
        count: creds.length,
        items: creds,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );

  console.log(
    JSON.stringify({
      ok: true,
      env: "local",
      marker: B411_MARKER,
      company: B411_COMPANY,
      campaign: B411_CAMPAIGN,
      questionnaireVersion: B411_VERSION,
      instruments: ["GUIA_I", "GUIA_III"],
      workers: creds.length,
      credsPath: B411_CREDS_PATH,
      passwordsPrinted: false,
    }),
  );
}

const invokedDirectly = process.argv[1]?.includes("seed-b411-workload-83-local");
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
