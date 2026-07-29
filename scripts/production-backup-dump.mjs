#!/usr/bin/env node
/**
 * Dump lógico pre/post import de nom035-production (schema public).
 * Fuera del repo. Requiere SUPABASE_DB_PASSWORD + project link.
 * No imprime secretos ni nombres reales.
 *
 * Uso:
 *   CONFIRM_PRODUCTION_BACKUP=YES SUPABASE_DB_PASSWORD=... \
 *     BACKUP_LABEL=pre-import node scripts/production-backup-dump.mjs
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

const EXPECTED_NAME = "nom035-production";
const EXPECTED_REF_PREFIX = "agbl";
const EXPECTED_REF_SUFFIX = "kubf";
const OUT_ROOT = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-production-backups"
);

function fail(msg) {
  console.error(`[production-backup] ${msg}`);
  process.exit(1);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertProduction() {
  if (process.env.CONFIRM_PRODUCTION_BACKUP !== "YES") {
    fail("falta CONFIRM_PRODUCTION_BACKUP=YES");
  }
  if (!process.env.SUPABASE_DB_PASSWORD) fail("SUPABASE_DB_PASSWORD_ABSENT");
  const refPath = resolve("supabase/.temp/project-ref");
  const expectedPath = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-secrets/project_ref.txt"
  );
  if (!existsSync(refPath)) fail("proyecto no enlazado (supabase/.temp/project-ref)");
  if (!existsSync(expectedPath)) fail("falta project_ref en secrets off-repo");
  const linked = readFileSync(refPath, "utf8").trim();
  const expected = readFileSync(expectedPath, "utf8").trim();
  if (linked !== expected) fail("project ref enlazado ≠ producción autorizada");
  if (
    !linked.startsWith(EXPECTED_REF_PREFIX) ||
    !linked.endsWith(EXPECTED_REF_SUFFIX)
  ) {
    fail("ref no autorizado");
  }
  if (/concasa|charolais|localhost/i.test(linked)) fail("ref prohibido");
  const nameFile = resolve(
    process.env.HOME ?? "",
    "Desktop/nom035-production-secrets/project_name.txt"
  );
  const name = existsSync(nameFile)
    ? readFileSync(nameFile, "utf8").trim()
    : EXPECTED_NAME;
  if (name !== EXPECTED_NAME) fail(`nombre lógico inválido: ${name}`);
  return { linked, sanitized: `${linked.slice(0, 4)}…${linked.slice(-4)}` };
}

function dump(args, label) {
  console.log(`[production-backup] ${label}…`);
  execFileSync("npx", ["supabase", "db", "dump", "--linked", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
}

function main() {
  const { sanitized } = assertProduction();
  const label = (process.env.BACKUP_LABEL || "manual").replace(/[^a-zA-Z0-9_-]/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(OUT_ROOT, `${stamp}-${label}`);
  mkdirSync(outDir, { recursive: true, mode: 0o700 });

  const rolesFile = resolve(outDir, "00-roles.sql");
  const schemaFile = resolve(outDir, "01-schema-public.sql");
  const dataFile = resolve(outDir, "02-data-public.sql");

  dump(["--role-only", "-f", rolesFile], "roles");
  dump(["--schema", "public", "-f", schemaFile], "schema public");
  dump(
    ["--data-only", "--use-copy", "--schema", "public", "-f", dataFile],
    "data public"
  );

  for (const f of [schemaFile, dataFile]) {
    const sample = readFileSync(f, "utf8").slice(0, 800_000);
    // Roles SQL menciona service_role por grants; data no debe incluir auth.users/MFA/TOTP.
    if (/insert into auth\.users|COPY auth\.users|mfa_factors|TOTP[_\s]/i.test(sample)) {
      fail(`posible secreto/auth en ${f}`);
    }
  }

  const meta = {
    environment: "production",
    projectName: EXPECTED_NAME,
    refSanitized: sanitized,
    label,
    createdAtUtc: new Date().toISOString(),
    files: [rolesFile, schemaFile, dataFile].map((p) => ({
      name: p.split("/").pop(),
      bytes: statSync(p).size,
      sha256: sha256File(p),
    })),
  };
  writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(meta, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: true,
        outDir,
        refSanitized: sanitized,
        files: meta.files.map((f) => ({
          name: f.name,
          bytes: f.bytes,
          sha256: f.sha256,
        })),
      },
      null,
      2
    )
  );
}

main();
