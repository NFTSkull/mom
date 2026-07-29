/**
 * Seed de fixtures STAGING/TEST para nom035-staging.
 * Se niega a correr fuera del ref esperado. No imprime secretos ni tokens.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_NAME = "nom035-staging";
const MARK = "STAGING_TEST";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.staging.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  } catch {
    // optional
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function assertStaging(url: string, expectedRef: string) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url.replace(/\/$/, ""))) {
    throw new Error("URL staging inválida");
  }
  const host = new URL(url).hostname;
  const ref = host.split(".")[0] ?? "";
  if (ref !== expectedRef) throw new Error("project ref no coincide con staging verificado");
  if (ref.length < 8) throw new Error("project ref inválido");
  if (/prod|production|concasa|charolais/i.test(url)) {
    throw new Error("URL parece producción u otro proyecto prohibido");
  }
}

function adminClient(url: string, secret: string) {
  class NoopRealtimeTransport {
    // stub para Node sin WebSocket nativo
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopRealtimeTransport as never },
  } as never);
}

function minimalPdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pepper = env.NOM035_TOKEN_PEPPER;
  const appUrl =
    env.NEXT_PUBLIC_APP_URL ||
    "https://mom-git-release-nom035-staging-rc1-viozs-projects.vercel.app";
  if (!url || !secret || !pepper || !publishable) {
    throw new Error("Falta .env.staging.local (URL + secret + publishable + pepper)");
  }
  const refFile = resolve(".tmp/staging-project-ref.txt");
  if (!existsSync(refFile)) throw new Error("Falta .tmp/staging-project-ref.txt");
  const expectedRef = readFileSync(refFile, "utf8").trim();
  assertStaging(url, expectedRef);
  if (env.STAGING_PROJECT_NAME && env.STAGING_PROJECT_NAME !== EXPECTED_NAME) {
    throw new Error("STAGING_PROJECT_NAME debe ser nom035-staging");
  }

  const admin = adminClient(url, secret);

  // Empresa singleton
  const company = await admin.from("company_settings").upsert(
    {
      singleton_lock: true,
      razon_social: `${MARK} Empresa Ficticia SA de CV`,
      rfc: "STG010101XXX",
      domicilio: "Calle Staging 1, Ciudad Test",
      actividad_principal: "Servicios de prueba NOM-035",
      total_trabajadores: 25,
      responsable_nombre: `${MARK} Representante`,
      responsable_email: "contacto@nom035.staging.local",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "singleton_lock" }
  );
  if (company.error) throw new Error(`company: ${company.error.message}`);

  // Cerrar campañas STAGING active previas
  await admin
    .from("evaluation_campaigns")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active")
    .like("nombre", `${MARK}%`);

  const campaignId = randomUUID();
  const workerIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const id = randomUUID();
    workerIds.push(id);
    const w = await admin.from("workers").insert({
      id,
      nombre: `${MARK} Trabajador ${i}`,
      departamento: i === 1 ? `${MARK} Ops` : `${MARK} RH`,
      activo: true,
    });
    if (w.error) throw new Error(`worker: ${w.error.message}`);
  }

  const camp = await admin.from("evaluation_campaigns").insert({
    id: campaignId,
    nombre: `${MARK} Campaña ${campaignId.slice(0, 8)}`,
    status: "active",
    activated_at: new Date().toISOString(),
    fecha_inicio: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    fecha_cierre: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  if (camp.error) throw new Error(`campaign: ${camp.error.message}`);

  const tokens: Array<{
    workerId: string;
    token: string;
    assignmentId: string;
    url: string;
  }> = [];
  for (const workerId of workerIds) {
    const token = `ev_${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHmac("sha256", pepper).update(token, "utf8").digest("hex");
    const created = await admin.rpc("create_public_evaluation_assignment", {
      p_campaign_id: campaignId,
      p_worker_id: workerId,
      p_token_hash: tokenHash,
      p_token_last4: token.slice(-4),
      p_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      p_questionnaire_version: "nom035-stps-2018-guias-referencia-i-ii",
    });
    if (!created.data?.ok) {
      throw new Error(`assignment: ${JSON.stringify(created.error || created.data)}`);
    }
    tokens.push({
      workerId,
      token,
      assignmentId: created.data.assignmentId as string,
      url: `${appUrl}/evaluacion/${token}`,
    });
  }

  const anon = await admin.rpc("public_submit_confidential_complaint", {
    p_complaint_type: "violencia_laboral",
    p_description: `${MARK} Queja anónima de prueba controlada.`,
    p_is_anonymous: true,
    p_reporter_name: null,
    p_reporter_contact: null,
  });
  const identified = await admin.rpc("public_submit_confidential_complaint", {
    p_complaint_type: "entorno_organizacional",
    p_description: `${MARK} Queja identificada de prueba controlada.`,
    p_is_anonymous: false,
    p_reporter_name: `${MARK} Reportero`,
    p_reporter_contact: "reportero@nom035.staging.local",
  });

  const pdf = minimalPdfBytes();
  const sha = createHash("sha256").update(pdf).digest("hex");
  const path = `staging/${MARK.toLowerCase()}/${randomUUID()}.pdf`;
  const up = await admin.storage.from("nom035-evidence").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) throw new Error(`storage upload: ${up.error.message}`);

  const evidenceId = randomUUID();
  const evIns = await admin.from("evidence_items").insert({
    id: evidenceId,
    campaign_id: campaignId,
    title: `${MARK} Evidencia PDF`,
    description: `${MARK} Archivo PDF ficticio`,
    evidence_type: "politica",
    evidence_source: "upload",
    storage_bucket: "nom035-evidence",
    storage_path: path,
    original_file_name: "staging-test.pdf",
    safe_file_name: "staging-test.pdf",
    mime_type: "application/pdf",
    size_bytes: pdf.byteLength,
    sha256: sha,
    version: 1,
  });

  const external = await admin.from("evidence_items").insert({
    id: randomUUID(),
    campaign_id: campaignId,
    title: `${MARK} Evidencia externa`,
    description: `${MARK} URL externa ficticia HTTPS`,
    evidence_type: "capacitacion",
    evidence_source: "external",
    external_url: "https://example.com/staging-nom035-test.pdf",
    version: 1,
  });

  const plan = await admin.from("action_plans").insert({
    id: randomUUID(),
    campaign_id: campaignId,
    area: `${MARK} Area`,
    risk_factor: "ambiente_trabajo",
    risk_level: "medio",
    action_level: "primer_nivel",
    action_type: "organizacional",
    responsible: `${MARK} Responsable`,
    description: `${MARK} Plan de acción ficticio`,
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: "pendiente",
    source: "manual",
    version: 1,
  });

  const policy = await admin.from("policy_documents").insert({
    id: randomUUID(),
    title: `${MARK} Política de prevención`,
    version: "v-staging-1",
    version_label: "v-staging-1",
    version_number: 1,
    content: `${MARK} Contenido de política ficticia para certificación.`,
    status: "borrador",
  });

  // Acceso público Storage denegado
  const pub = adminClient(url, publishable);
  const pubList = await pub.storage.from("nom035-evidence").list("staging");
  const publicDenied = Boolean(pubList.error) || (pubList.data?.length ?? 0) === 0;

  const outDir = resolve(".tmp");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "staging-fixtures.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        projectName: EXPECTED_NAME,
        mark: MARK,
        campaignId,
        workerIds,
        tokens: tokens.map((t) => ({
          workerId: t.workerId,
          assignmentId: t.assignmentId,
          tokenLast4: t.token.slice(-4),
          token: t.token,
          url: t.url,
        })),
        complaints: {
          anonOk: Boolean(anon.data?.ok ?? !anon.error),
          identifiedOk: Boolean(identified.data?.ok ?? !identified.error),
          anonError: anon.error?.message ?? null,
          identifiedError: identified.error?.message ?? null,
        },
        evidence: {
          uploadOk: !evIns.error,
          evidenceError: evIns.error?.message ?? null,
          path,
          sha256: sha,
          externalOk: !external.error,
          evidenceId: !evIns.error ? evidenceId : null,
        },
        planOk: !plan.error,
        planError: plan.error?.message ?? null,
        policyOk: !policy.error,
        policyError: policy.error?.message ?? null,
        storagePublicDenied: publicDenied,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  if (!publicDenied) {
    throw new Error("Storage público listó objetos staging — bucket no privado");
  }

  console.log(
    `Seed fixtures OK: campaign=${campaignId.slice(0, 8)} workers=${workerIds.length} tokens=${tokens.length} publicDenied=${publicDenied}`
  );
}

main().catch((e) => {
  console.error("seed-staging-fixtures FAIL:", e);
  process.exit(1);
});
