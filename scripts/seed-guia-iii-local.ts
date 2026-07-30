/**
 * Seed LOCAL Guía III (EMPRESA_GUIA_III_TEST, WORKER-G3-A/B).
 * Solo localhost. No imprime passwords.
 *
 *   GUIDE_III_TEST_PASSWORD='...' npm run guia3:seed:local
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const COMPANY = "EMPRESA_GUIA_III_TEST";
const CAMPAIGN = "CAMPAÑA_GUIA_III_TEST";
const VERSION = "nom035-stps-2018-guias-referencia-i-iii";
const WORKERS = [
  {
    ref: "WORKER-G3-A",
    nombre: "Trabajador Sintetico G3 A",
    username: "worker.g3.a",
    email: "worker.g3.a@nom035.test",
  },
  {
    ref: "WORKER-G3-B",
    nombre: "Trabajador Sintetico G3 B",
    username: "worker.g3.b",
    email: "worker.g3.b@nom035.test",
  },
] as const;

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

function tokenPlaceholder() {
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
  const password = env.GUIDE_III_TEST_PASSWORD || "Nom035-G3#Local2026!";

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
    await admin
      .from("company_settings")
      .update({
        razon_social: COMPANY,
        rfc: "EG3000000XXX",
        domicilio: "Local sintetico G3",
        actividad_principal: "Prueba Guia III",
        total_trabajadores: 83,
        responsable_nombre: "RH Sintetico G3",
        responsable_email: "rh.g3@nom035.test",
      })
      .eq("id", companyId);
  } else {
    const { data, error } = await admin
      .from("company_settings")
      .insert({
        razon_social: COMPANY,
        rfc: "EG3000000XXX",
        domicilio: "Local sintetico G3",
        actividad_principal: "Prueba Guia III",
        total_trabajadores: 83,
        responsable_nombre: "RH Sintetico G3",
        responsable_email: "rh.g3@nom035.test",
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
    .neq("nombre", CAMPAIGN);

  let campaignId: string;
  const { data: existingCamp } = await admin
    .from("evaluation_campaigns")
    .select("id,status")
    .eq("nombre", CAMPAIGN)
    .maybeSingle();
  if (existingCamp) {
    campaignId = existingCamp.id;
    await admin
      .from("evaluation_campaigns")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
        closed_at: null,
        questionnaire_version: VERSION,
        descripcion: "Campana sintetica I+III (83 trabajadores)",
      })
      .eq("id", campaignId);
  } else {
    const { data, error } = await admin
      .from("evaluation_campaigns")
      .insert({
        nombre: CAMPAIGN,
        descripcion: "Campana sintetica I+III (83 trabajadores)",
        status: "active",
        activated_at: new Date().toISOString(),
        questionnaire_version: VERSION,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "campaign");
    campaignId = data.id;
  }

  const seeded: Array<{ ref: string; username: string }> = [];

  for (const w of WORKERS) {
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
          puesto: "Puesto Sintetico G3",
          departamento: "Dept Sintetico G3",
          activo: true,
        })
        .eq("id", workerId);
    } else {
      const { data, error } = await admin
        .from("workers")
        .insert({
          nombre: w.nombre,
          puesto: "Puesto Sintetico G3",
          departamento: "Dept Sintetico G3",
          external_reference: w.ref,
          activo: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "worker");
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
        questionnaire_version: VERSION,
      })
      .select("id")
      .single();
    if (asgErr || !asg) throw new Error(asgErr?.message ?? "assignment");

    await admin.rpc("ensure_assignment_questionnaires", { p_assignment_id: asg.id });

    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let authUser = listed.data.users.find(
      (u) => (u.email || "").toLowerCase() === w.email
    );
    if (!authUser) {
      const created = await admin.auth.admin.createUser({
        email: w.email,
        password,
        email_confirm: true,
        app_metadata: { role: "worker" },
        user_metadata: { synthetic: true, marker: "GUIA_III_TEST" },
      });
      if (created.error || !created.data.user) {
        throw new Error(created.error?.message || "auth create");
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
        username_normalized: w.username,
        is_active: true,
        must_change_password: false,
      },
      { onConflict: "worker_id" }
    );
    if (accErr) throw new Error(accErr.message);

    seeded.push({ ref: w.ref, username: w.username });
  }

  console.log(
    JSON.stringify({
      ok: true,
      env: "local",
      company: COMPANY,
      campaign: CAMPAIGN,
      questionnaireVersion: VERSION,
      instruments: ["GUIA_I", "GUIA_III"],
      workers: seeded,
      passwordsPrinted: false,
    })
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
