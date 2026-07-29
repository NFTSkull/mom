#!/usr/bin/env node
/**
 * Restaura dump public en base aislada del Postgres de Supabase local.
 * Verifica conteos, FKs, RLS, funciones. No toca staging/producción.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-staging-backup-verified"
);
const DB_NAME = "nom035_restore_verify";
const REPORT = resolve(OUT_DIR, "RESTORE_VERIFICATION.json");

const TABLES = [
  "company_settings",
  "workers",
  "evaluation_campaigns",
  "evaluation_assignments",
  "evaluation_sessions",
  "evaluation_results",
  "action_plans",
  "confidential_complaints",
  "evidence_items",
  "policy_documents",
  "audit_log",
];

function fail(msg) {
  console.error(`[restore-verify] ${msg}`);
  process.exit(1);
}

function localDbUrl() {
  const status = execSync("npx supabase status -o env", { encoding: "utf8" });
  const m = status.match(/^DB_URL=(.+)$/m);
  if (!m) fail("no DB_URL en supabase status — ¿supabase start?");
  return m[1].trim().replace(/^"|"$/g, "");
}

function adminUrl(base) {
  // postgresql://postgres:postgres@127.0.0.1:55322/postgres
  return base.replace(/\/[^/]+$/, "/postgres");
}

function dbUrl(base, name) {
  return base.replace(/\/[^/]+$/, `/${name}`);
}

function psqlUrl(url, sql, opts = {}) {
  return execSync(`psql "${url}" -v ON_ERROR_STOP=1 -t -A -c ${JSON.stringify(sql)}`, {
    encoding: "utf8",
    ...opts,
  }).trim();
}

function psqlFile(url, file) {
  // Preprocesar: ignorar transaction_timeout (PG17→local) y \restrict
  let sql = readFileSync(file, "utf8");
  sql = sql
    .replace(/^SET transaction_timeout = .*?;\n/gm, "-- stripped transaction_timeout\n")
    .replace(/^-- \\\\restrict .*$/gm, "-- stripped restrict\n")
    .replace(/^\\restrict .*$/gm, "-- stripped restrict\n");
  execSync(`psql "${url}" -v ON_ERROR_STOP=1`, {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

function main() {
  const schema = resolve(OUT_DIR, "01-schema-public.sql");
  const data = resolve(OUT_DIR, "02-data-public.sql");
  const sourceCountsPath = resolve(OUT_DIR, "SOURCE_COUNTS.json");
  if (!existsSync(schema) || !existsSync(data)) {
    fail("faltan 01-schema-public.sql / 02-data-public.sql");
  }

  const base = localDbUrl();
  const admin = adminUrl(base);
  const pgVersion = psqlUrl(admin, "SHOW server_version;");
  console.log(`[restore-verify] local PG ${pgVersion}`);

  // Terminar conexiones previas si existiera la DB
  try {
    psqlUrl(
      admin,
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();`
    );
  } catch {
    // ok
  }
  try {
    psqlUrl(admin, `DROP DATABASE IF EXISTS ${DB_NAME};`);
  } catch {
    execSync(`psql "${admin}" -c "DROP DATABASE IF EXISTS ${DB_NAME};"`, {
      stdio: "inherit",
    });
  }
  psqlUrl(admin, `CREATE DATABASE ${DB_NAME};`);
  const target = dbUrl(admin, DB_NAME);
  console.log(`[restore-verify] clean DB ${DB_NAME}`);

  // Prerrequisitos estilo Supabase (schema extensions + crypto + stub auth para FKs)
  psqlUrl(target, `CREATE SCHEMA IF NOT EXISTS extensions;`);
  psqlUrl(target, `CREATE SCHEMA IF NOT EXISTS graphql;`);
  psqlUrl(target, `CREATE SCHEMA IF NOT EXISTS auth;`);
  psqlUrl(target, `GRANT USAGE ON SCHEMA extensions TO public;`);
  // Stub mínimo: el dump public referencia auth.users en FKs; Auth real no se restaura aquí.
  psqlUrl(
    target,
    `CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);`
  );
  for (const ext of ["uuid-ossp", "pgcrypto"]) {
    try {
      psqlUrl(target, `CREATE EXTENSION IF NOT EXISTS "${ext}" WITH SCHEMA extensions;`);
    } catch (e) {
      console.log(`[restore-verify] extension ${ext}: ${String(e.message || e).slice(0, 120)}`);
    }
  }

  let schemaOk = true;
  let schemaError = null;
  try {
    console.log("[restore-verify] applying schema public");
    psqlFile(target, schema);
  } catch (e) {
    schemaOk = false;
    schemaError = String(e?.message ?? e).slice(0, 800);
  }

  let dataOk = true;
  let dataError = null;
  try {
    console.log("[restore-verify] applying data public");
    psqlFile(target, data);
  } catch (e) {
    dataOk = false;
    dataError = String(e?.message ?? e).slice(0, 800);
  }

  const counts = {};
  for (const t of TABLES) {
    try {
      counts[t] = Number(psqlUrl(target, `SELECT count(*) FROM public.${t};`));
    } catch {
      counts[t] = null;
    }
  }

  let stagingCompany = null;
  try {
    stagingCompany = psqlUrl(
      target,
      `SELECT razon_social FROM public.company_settings LIMIT 1;`
    );
  } catch {
    stagingCompany = null;
  }

  let rls = {};
  try {
    const rows = psqlUrl(
      target,
      `SELECT relname||'|'||CASE WHEN relrowsecurity THEN 'on' ELSE 'off' END||'|'||CASE WHEN relforcerowsecurity THEN 'force' ELSE 'noforce' END FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY 1;`
    );
    for (const line of rows.split("\n").filter(Boolean)) {
      const [name, on, force] = line.split("|");
      rls[name] = { rowsecurity: on === "on", force: force === "force" };
    }
  } catch (e) {
    rls = { error: String(e.message || e).slice(0, 200) };
  }

  let functions = [];
  try {
    functions = psqlUrl(
      target,
      `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1;`
    )
      .split("\n")
      .filter(Boolean);
  } catch {
    functions = [];
  }

  let fkCount = 0;
  let constraintCount = 0;
  try {
    fkCount = Number(
      psqlUrl(
        target,
        `SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public';`
      )
    );
    constraintCount = Number(
      psqlUrl(
        target,
        `SELECT count(*) FROM information_schema.table_constraints WHERE table_schema='public';`
      )
    );
  } catch {
    // ignore
  }

  let sourceCounts = null;
  if (existsSync(sourceCountsPath)) {
    sourceCounts = JSON.parse(readFileSync(sourceCountsPath, "utf8"));
  }

  const countMatch = {};
  if (sourceCounts?.counts) {
    for (const t of TABLES) {
      const src = sourceCounts.counts[t];
      const dst = counts[t];
      countMatch[t] = src === dst || (src == null && dst == null);
    }
  }

  const report = {
    environment: {
      name: DB_NAME,
      host: "127.0.0.1 (supabase local)",
      postgres_version: pgVersion,
      clean_start: true,
    },
    schema_applied: schemaOk,
    schema_error: schemaError,
    data_applied: dataOk,
    data_error: dataError,
    source_counts: sourceCounts?.counts ?? null,
    restored_counts: counts,
    count_match: countMatch,
    foreign_keys: fkCount,
    constraints: constraintCount,
    rls,
    public_functions_count: functions.length,
    public_functions_sample: functions.slice(0, 50),
    synthetic_company: stagingCompany,
    not_in_this_restore: [
      "auth.users / MFA factors / sessions",
      "secretos del proyecto / API keys",
      "objetos físicos Storage",
      "configuración Dashboard",
    ],
    note:
      "Restore de verificación aislado en Supabase local. Un dump CLI no sustituye backups administrados de Supabase.",
    verified_at_utc: new Date().toISOString(),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });

  const allCountsMatch =
    Object.keys(countMatch).length > 0 && Object.values(countMatch).every(Boolean);

  const criticalOk =
    dataOk &&
    allCountsMatch &&
    counts.company_settings === 1 &&
    (counts.workers ?? 0) > 0 &&
    (counts.evaluation_campaigns ?? 0) > 0 &&
    Object.keys(rls).filter((k) => k !== "error").length >= 10 &&
    functions.length >= 50;

  console.log(
    JSON.stringify(
      {
        schema_applied: schemaOk,
        data_applied: dataOk,
        restored_counts: counts,
        count_match: countMatch,
        foreign_keys: fkCount,
        constraints: constraintCount,
        rls_tables: Object.keys(rls).filter((k) => k !== "error").length,
        functions: functions.length,
        critical_ok: criticalOk,
        company: stagingCompany,
      },
      null,
      2
    )
  );

  // Cleanup DB aislada salvo VERIFY_KEEP=1
  if (process.env.VERIFY_KEEP !== "1") {
    try {
      psqlUrl(admin, `DROP DATABASE IF EXISTS ${DB_NAME};`);
      console.log("[restore-verify] isolated DB dropped");
    } catch {
      console.log("[restore-verify] could not drop DB (manual cleanup)");
    }
  }

  if (!criticalOk) process.exit(2);
  console.log("[restore-verify] OK");
}

main();
