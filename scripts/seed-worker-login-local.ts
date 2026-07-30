/**
 * Seed LOCAL del trabajador sintético de login (TST-0001).
 * Se niega fuera de localhost. No imprime passwords ni tokens.
 * Inserta vía service_role (tablas), no RPCs admin (requieren JWT admin).
 *
 *   WORKER_TEST_PASSWORD='...' npm run worker:seed:local
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const COMPANY = "EMPRESA_PRUEBA_LOGIN";
const CAMPAIGN = "CAMPAÑA_LOGIN_PRUEBA";
const WORKER_REF = "TST-0001";
const USERNAME = "trabajador.prueba";
const AUTH_EMAIL = "trabajador.prueba@nom035.test";
const WORKER_NAME = "Trabajador Prueba NOM035";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function assertLocal(url: string) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url)) {
    throw new Error("ABORT: solo localhost");
  }
  if (/supabase\.co|production|concasa|charolais|staging/i.test(url)) {
    throw new Error("ABORT: host remoto prohibido");
  }
}

function tokenHashPlaceholder(): { hash: string; last4: string } {
  const raw = randomBytes(32).toString("hex");
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    last4: raw.slice(-4),
  };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta .env.local");
  assertLocal(url);

  const password = env.WORKER_TEST_PASSWORD || "Nom035-Prueba#2026!";
  const options: {
    auth: object;
    realtime?: { transport: new () => unknown };
  } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: class {} as never };
  }
  const admin = createClient(url, secret, options as never);

  let companyId: string;
  const { data: companyExisting } = await admin
    .from("company_settings")
    .select("id,razon_social")
    .limit(1)
    .maybeSingle();
  if (companyExisting) {
    companyId = companyExisting.id;
    if (companyExisting.razon_social !== COMPANY) {
      await admin
        .from("company_settings")
        .update({
          razon_social: COMPANY,
          rfc: "EPL010101XXX",
          domicilio: "Local test",
          actividad_principal: "Prueba login trabajador",
          total_trabajadores: 1,
          responsable_nombre: "RH Prueba",
          responsable_email: "rh.prueba@nom035.test",
        })
        .eq("id", companyId);
    }
  } else {
    const { data, error } = await admin
      .from("company_settings")
      .insert({
        razon_social: COMPANY,
        rfc: "EPL010101XXX",
        domicilio: "Local test",
        actividad_principal: "Prueba login trabajador",
        total_trabajadores: 1,
        responsable_nombre: "RH Prueba",
        responsable_email: "rh.prueba@nom035.test",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "company insert");
    companyId = data.id;
  }

  let workerId: string;
  const { data: existingWorker } = await admin
    .from("workers")
    .select("id")
    .eq("external_reference", WORKER_REF)
    .maybeSingle();
  if (existingWorker) {
    workerId = existingWorker.id;
    await admin
      .from("workers")
      .update({
        nombre: WORKER_NAME,
        puesto: "Puesto de Prueba",
        departamento: "Departamento de Prueba",
        activo: true,
      })
      .eq("id", workerId);
  } else {
    const { data, error } = await admin
      .from("workers")
      .insert({
        nombre: WORKER_NAME,
        puesto: "Puesto de Prueba",
        departamento: "Departamento de Prueba",
        external_reference: WORKER_REF,
        activo: true,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "worker insert");
    workerId = data.id;
  }

  await admin
    .from("evaluation_campaigns")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active")
    .neq("nombre", CAMPAIGN);

  let campaignId: string;
  const { data: existingCamp } = await admin
    .from("evaluation_campaigns")
    .select("id,status")
    .eq("nombre", CAMPAIGN)
    .maybeSingle();
  if (existingCamp) {
    campaignId = existingCamp.id;
    if (existingCamp.status !== "active") {
      await admin
        .from("evaluation_campaigns")
        .update({
          status: "active",
          activated_at: new Date().toISOString(),
          closed_at: null,
        })
        .eq("id", campaignId);
    }
  } else {
    const { data, error } = await admin
      .from("evaluation_campaigns")
      .insert({
        nombre: CAMPAIGN,
        descripcion:
          "Campaña sintética login trabajador (Guía I+II; Guía III pendiente)",
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "campaign insert");
    campaignId = data.id;
  }

  const tok = tokenHashPlaceholder();
  const { data: asgExisting } = await admin
    .from("evaluation_assignments")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("worker_id", workerId)
    .maybeSingle();
  if (asgExisting) {
    // No se puede regresar completed→pending (trigger). Recrear assignment.
    await admin.from("evaluation_answers").delete().eq("assignment_id", asgExisting.id);
    await admin.from("evaluation_results").delete().eq("assignment_id", asgExisting.id);
    await admin.from("evaluation_drafts").delete().eq("assignment_id", asgExisting.id);
    await admin.from("evaluation_sessions").delete().eq("assignment_id", asgExisting.id);
    await admin.from("evaluation_assignments").delete().eq("id", asgExisting.id);
  }
  const { error: asgErr } = await admin.from("evaluation_assignments").insert({
    campaign_id: campaignId,
    worker_id: workerId,
    token_hash: tok.hash,
    token_last4: tok.last4,
    status: "pending",
    questionnaire_version: "nom035-stps-2018-guias-referencia-i-ii",
  });
  if (asgErr) throw new Error(asgErr.message);

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let authUser = listed.data.users.find(
    (u) => (u.email || "").toLowerCase() === AUTH_EMAIL
  );
  if (!authUser) {
    const created = await admin.auth.admin.createUser({
      email: AUTH_EMAIL,
      password,
      email_confirm: true,
      app_metadata: { role: "worker" },
      user_metadata: { synthetic: true, marker: "WORKER_LOGIN_TEST" },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message || "auth create failed");
    }
    authUser = created.data.user;
  } else {
    await admin.auth.admin.updateUserById(authUser.id, {
      password,
      app_metadata: { role: "worker" },
      email_confirm: true,
    });
  }

  const { error: accErr } = await admin.from("worker_accounts").upsert(
    {
      company_id: companyId,
      worker_id: workerId,
      auth_user_id: authUser.id,
      username_normalized: USERNAME,
      is_active: true,
      must_change_password: true,
    },
    { onConflict: "worker_id" }
  );
  if (accErr) throw new Error(accErr.message);

  console.log(
    JSON.stringify({
      ok: true,
      env: "local",
      username: USERNAME,
      workerRef: WORKER_REF,
      campaign: CAMPAIGN,
      mustChangePassword: true,
      guiaNote: "GUIA_I+II only; GUIA_III P0 pending",
    })
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
