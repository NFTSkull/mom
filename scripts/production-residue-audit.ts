/**
 * Auditoría no destructiva de residuos sintéticos en nom035-production.
 * Guarda: ref agbl…kubf + nombre lógico production. No imprime PII ni secretos.
 *
 * Uso: npx tsx scripts/production-residue-audit.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_REF_PREFIX = "agbl";
const EXPECTED_REF_SUFFIX = "kubf";
const EXPECTED_NAME = "nom035-production";

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

function loadEnv(): Record<string, string> {
  return {
    ...loadEnvFile(".env.staging.local"),
    ...loadEnvFile(".env.production.local"),
    ...(process.env as Record<string, string>),
  };
}

function assertProductionTarget(url: string) {
  if (/localhost|127\.0\.0\.1/i.test(url)) throw new Error("ABORT: localhost");
  if (/concasa|charolais/i.test(url)) throw new Error("ABORT: proyecto ajeno");
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  if (!ref.startsWith(EXPECTED_REF_PREFIX) || !ref.endsWith(EXPECTED_REF_SUFFIX)) {
    throw new Error("ABORT: project ref no coincide con producción autorizada");
  }
  const nameFile = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-secrets/project_name.txt"
  );
  if (existsSync(nameFile)) {
    const name = readFileSync(nameFile, "utf8").trim();
    if (name !== EXPECTED_NAME) throw new Error(`ABORT: nombre lógico ${name}`);
  }
  return ref;
}

async function countIlike(
  admin: ReturnType<typeof createClient>,
  table: string,
  col: string,
  pattern: string
) {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .ilike(col, pattern);
  return { table, col, pattern, count: error ? -1 : (count ?? 0), error: error?.message };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta URL/secret de producción");
  const ref = assertProductionTarget(url);

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  } as never);

  const patterns = [
    "STAGING_TEST%",
    "%STAGING_TEST%",
    "LOCAL_IMPORT_TEST_83%",
    "%LOCAL_IMPORT%",
    "NOM035_LOCAL%",
  ];

  const residueChecks = [];
  for (const pattern of patterns) {
    residueChecks.push(await countIlike(admin, "workers", "nombre", pattern));
    residueChecks.push(await countIlike(admin, "workers", "sucursal", pattern));
    residueChecks.push(await countIlike(admin, "evaluation_campaigns", "nombre", pattern));
    residueChecks.push(await countIlike(admin, "confidential_complaints", "description", pattern));
    residueChecks.push(await countIlike(admin, "policy_documents", "title", pattern));
    residueChecks.push(await countIlike(admin, "action_plans", "description", pattern));
    residueChecks.push(await countIlike(admin, "evidence_items", "title", pattern));
  }

  const company = await admin
    .from("company_settings")
    .select("id,razon_social,rfc,total_trabajadores,responsable_email,domicilio")
    .maybeSingle();
  const companyName = company.data?.razon_social ?? null;
  const companyLooksSynthetic = /STAGING|TEST|LOCAL_IMPORT|NOM035_LOCAL|ACME|fictici/i.test(
    companyName ?? ""
  );

  const head = async (table: string, filter?: { col: string; eq: unknown }) => {
    let q = admin.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter.col, filter.eq as never);
    const { count, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  };

  const { data: authList, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (authErr) throw authErr;
  const users = authList.users ?? [];
  const syntheticUsers = users.filter((u) => {
    const e = (u.email ?? "").toLowerCase();
    return /staging|test|e2e|local|@nom035\.|example\.com|example\.org/.test(e);
  });

  const profiles = await admin.from("admin_profiles").select("id,email,role,activo,nombre");
  const bucket = await admin.storage.from("nom035-evidence").list("", { limit: 100 });
  const stagingObjs = (bucket.data ?? []).filter((f) => /staging|test/i.test(f.name));

  const report = {
    expectedName: EXPECTED_NAME,
    refSanitized: `${ref.slice(0, 4)}…${ref.slice(-4)}`,
    company: {
      present: Boolean(company.data),
      razonLooksSynthetic: companyLooksSynthetic,
      razonLength: companyName?.length ?? 0,
      hasRfc: Boolean(company.data?.rfc),
      hasDomicilio: Boolean(company.data?.domicilio),
      totalTrabajadoresField: company.data?.total_trabajadores ?? null,
      hasResponsableEmail: Boolean(company.data?.responsable_email),
    },
    counts: {
      workers: await head("workers"),
      workersActive: await head("workers", { col: "activo", eq: true }),
      campaigns: await head("evaluation_campaigns"),
      assignments: await head("evaluation_assignments"),
      results: await head("evaluation_results"),
      complaints: await head("confidential_complaints"),
      plans: await head("action_plans"),
      policies: await head("policy_documents"),
      evidence: await head("evidence_items"),
      rateLimits: await head("public_rate_limits"),
      authUsers: users.length,
      syntheticAuthUsers: syntheticUsers.length,
      adminProfiles: profiles.data?.length ?? 0,
      storageTopLevel: bucket.data?.length ?? 0,
      stagingLikeStorage: stagingObjs.length,
    },
    residueHits: residueChecks.filter((c) => (c.count ?? 0) > 0 || c.error),
    adminProfilesSanitized: (profiles.data ?? []).map((p) => ({
      role: p.role,
      activo: p.activo,
      emailDomain: (p.email ?? "").includes("@") ? p.email.split("@")[1] : null,
      nombreLength: (p.nombre ?? "").length,
    })),
    authSyntheticSanitized: syntheticUsers.map((u) => ({
      domain: (u.email ?? "").split("@")[1] ?? null,
      localPrefix: `${(u.email ?? "").slice(0, 3)}…`,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
