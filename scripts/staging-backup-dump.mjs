#!/usr/bin/env node
/**
 * Dump lógico de nom035-staging (roles + esquema public + datos public).
 * Fuera del repo. Requiere SUPABASE_DB_PASSWORD. No imprime secretos.
 * Alcance: schema public (NOM-035). Auth/Storage físicos fuera del dump estándar.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const EXPECTED_NAME = "nom035-staging";
const OUT_DIR = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-staging-backup-verified"
);
const MARKERS_FORBIDDEN = /concasa|charolais|production|\bprod\b/i;

function fail(msg) {
  console.error(`[staging-backup-dump] ${msg}`);
  process.exit(1);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertStagingLink() {
  const refPath = resolve("supabase/.temp/project-ref");
  const expectedPath = resolve(".tmp/staging-project-ref.txt");
  if (!existsSync(refPath)) fail("proyecto no enlazado (supabase/.temp/project-ref)");
  if (!existsSync(expectedPath)) fail("falta .tmp/staging-project-ref.txt");
  const linked = readFileSync(refPath, "utf8").trim();
  const expected = readFileSync(expectedPath, "utf8").trim();
  if (linked !== expected) fail("project ref enlazado ≠ staging verificado");
  if (MARKERS_FORBIDDEN.test(linked)) fail("ref prohibido");
  const name = process.env.STAGING_PROJECT_NAME ?? EXPECTED_NAME;
  if (name !== EXPECTED_NAME) fail("STAGING_PROJECT_NAME debe ser nom035-staging");
  return { sanitized: `${linked.slice(0, 4)}…${linked.slice(-4)}` };
}

function dump(args, label) {
  console.log(`[staging-backup-dump] ${label}…`);
  execFileSync("npx", ["supabase", "db", "dump", "--linked", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
}

function main() {
  if (!process.env.SUPABASE_DB_PASSWORD) {
    fail("SUPABASE_DB_PASSWORD_ABSENT — no se ejecuta dump");
  }
  const { sanitized } = assertStagingLink();
  mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });

  const rolesFile = resolve(OUT_DIR, "00-roles.sql");
  const schemaFile = resolve(OUT_DIR, "01-schema-public.sql");
  const dataFile = resolve(OUT_DIR, "02-data-public.sql");

  const cliVersion = execFileSync("npx", ["supabase", "--version"], {
    encoding: "utf8",
  }).trim();

  dump(["--role-only", "-f", rolesFile], "roles");
  dump(["--schema", "public", "-f", schemaFile], "schema public");
  dump(
    ["--data-only", "--use-copy", "--schema", "public", "-f", dataFile],
    "data public"
  );

  // Guardas: el dump public no debe arrastrar auth.users ni factores MFA
  for (const f of [schemaFile, dataFile]) {
    const sample = readFileSync(f, "utf8").slice(0, 500_000);
    if (/COPY "auth"\.|CREATE TABLE "auth"\./i.test(sample)) {
      fail(`${f} contiene objetos auth — abortando`);
    }
    if (/concasa|charolais/i.test(sample)) {
      fail(`${f} contiene marcadores de proyecto prohibido`);
    }
  }

  const files = [
    { name: "00-roles.sql", path: rolesFile },
    { name: "01-schema-public.sql", path: schemaFile },
    { name: "02-data-public.sql", path: dataFile },
  ];

  const manifest = {
    created_at_utc: new Date().toISOString(),
    cli_version: cliVersion,
    project_name: EXPECTED_NAME,
    project_ref_sanitized: sanitized,
    scope: "public schema (+ roles file). Auth users/MFA/secrets y objetos Storage físicos NO incluidos.",
    note:
      "Dump lógico verificado. No sustituye backups administrados de Supabase. Sin passwords/tokens/peppers en este manifest.",
    files: files.map((f) => ({
      name: f.name,
      bytes: statSync(f.path).size,
      sha256: sha256File(f.path),
    })),
  };

  writeFileSync(resolve(OUT_DIR, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log("[staging-backup-dump] OK");
  console.log(JSON.stringify({ out_dir: OUT_DIR, files: manifest.files }, null, 2));
}

main();
