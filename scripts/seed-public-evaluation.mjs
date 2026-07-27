// Script SOLO de desarrollo. Emite un assignment de evaluación pública en
// Supabase LOCAL y muestra el enlace una sola vez en Terminal.
// - Se niega a ejecutar si la URL no es localhost/127.0.0.1.
// - Guarda únicamente el hash del token (nunca el token en claro).
// - No escribe el token en archivo ni lo versiona. Datos ficticios.
//
// Nota (B4.3): se implementa como .mjs (ESM) para reutilizar @supabase/supabase-js
// y node:crypto sin añadir tooling de TypeScript ni dependencias nuevas
// (Node 20 no strippea tipos y el objetivo es mantener npm audit en cero).

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    // ignora; se validará abajo
  }
  return { ...env, ...process.env };
}

function fail(message) {
  console.error(`\n[seed] ERROR: ${message}\n`);
  process.exit(1);
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  const pepper = env.NOM035_TOKEN_PEPPER;
  const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!url || !secret || !pepper) {
    fail("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / NOM035_TOKEN_PEPPER en .env.local");
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url)) {
    fail(`Rechazado: la URL no es local (${url}). Este script solo opera en Supabase local.`);
  }

  const seedOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  if (typeof globalThis.WebSocket === "undefined") {
    // Node 20 sin WebSocket global: transport inerte (no usamos realtime).
    seedOptions.realtime = { transport: class {} };
  }
  const admin = createClient(url, secret, seedOptions);

  // company_settings (singleton)
  const { data: companyExisting } = await admin.from("company_settings").select("id").limit(1);
  if (!companyExisting || companyExisting.length === 0) {
    const { error } = await admin.from("company_settings").insert({
      razon_social: "Empresa Demo NOM-035 (ficticia)",
      total_trabajadores: 30,
    });
    if (error) fail(`company_settings: ${error.message}`);
  }

  // worker ficticio (reutiliza por nombre)
  const workerName = "Trabajador Demo B4.3";
  let workerId;
  const { data: workerExisting } = await admin
    .from("workers")
    .select("id")
    .eq("nombre", workerName)
    .limit(1);
  if (workerExisting && workerExisting.length > 0) {
    workerId = workerExisting[0].id;
  } else {
    const { data, error } = await admin
      .from("workers")
      .insert({ nombre: workerName, activo: true, departamento: "Demo", puesto: "Demo" })
      .select("id")
      .single();
    if (error) fail(`workers: ${error.message}`);
    workerId = data.id;
  }

  // campaña active (reutiliza por nombre)
  const campaignName = "Campaña Demo B4.3";
  let campaignId;
  const { data: campaignExisting } = await admin
    .from("evaluation_campaigns")
    .select("id")
    .eq("nombre", campaignName)
    .limit(1);
  if (campaignExisting && campaignExisting.length > 0) {
    campaignId = campaignExisting[0].id;
  } else {
    const today = new Date();
    const start = new Date(today.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("evaluation_campaigns")
      .insert({ nombre: campaignName, status: "active", fecha_inicio: start, fecha_cierre: end })
      .select("id")
      .single();
    if (error) fail(`campaigns: ${error.message}`);
    campaignId = data.id;
  }

  // Elimina assignment previo del mismo par (para reemitir un enlace fresco).
  await admin
    .from("evaluation_assignments")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("worker_id", workerId);

  // Token criptográfico (mismo esquema que evaluation-token.ts)
  const token = `ev_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHmac("sha256", pepper).update(token, "utf8").digest("hex");
  const tokenLast4 = token.slice(-4);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: created, error } = await admin.rpc("create_public_evaluation_assignment", {
    p_campaign_id: campaignId,
    p_worker_id: workerId,
    p_token_hash: tokenHash,
    p_token_last4: tokenLast4,
    p_expires_at: expiresAt,
    p_questionnaire_version: "nom035-stps-2018-guias-referencia-i-ii",
  });
  if (error) fail(`create_public_evaluation_assignment: ${error.message}`);
  if (!created || created.ok !== true) fail(`emisión rechazada: ${JSON.stringify(created)}`);

  const link = `${appUrl}/evaluacion/${token}`;
  console.log("\n=============================================================");
  console.log(" NOM-035 · Enlace de evaluación pública (SOLO se muestra 1 vez)");
  console.log("=============================================================");
  console.log(` assignmentId : ${created.assignmentId}`);
  console.log(` expira       : ${expiresAt}`);
  console.log(` token_last4  : ${tokenLast4}`);
  console.log(` ENLACE       : ${link}`);
  console.log("=============================================================");
  console.log(" No se guarda el token en disco. Solo se persiste su hash.\n");
}

main().catch((e) => fail(e?.message ?? String(e)));
