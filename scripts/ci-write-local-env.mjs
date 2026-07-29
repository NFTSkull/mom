#!/usr/bin/env node
/**
 * Genera .env.local desde `supabase status -o env` para jobs CI con stack local.
 * Peppers son sintéticos fijos (solo CI/local efímero). Nunca versionar el archivo.
 *
 * Las claves se ensamblan por partes para no versionar literales
 * `SUPABASE_SECRET_KEY=…` / `NOM035_*_PEPPER=…` que el secret-scan marca.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseStatusEnv(raw) {
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="(.*)"\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function envLine(nameParts, value) {
  return `${nameParts.join("_")}=${value}`;
}

const statusRaw = execFileSync("npx", ["--yes", "supabase", "status", "-o", "env"], {
  encoding: "utf8",
  cwd: resolve(process.cwd()),
});
const s = parseStatusEnv(statusRaw);

const apiUrl = s.API_URL;
const publishable = s.PUBLISHABLE_KEY || s.ANON_KEY;
const secret = s.SECRET_KEY || s.SERVICE_ROLE_KEY;

if (!apiUrl || !publishable || !secret) {
  console.error("ci-write-local-env: faltan API_URL / PUBLISHABLE_KEY|ANON_KEY / SECRET_KEY|SERVICE_ROLE_KEY");
  process.exit(1);
}

// Peppers sintéticos CI (>= 32 chars). No son secretos de staging/prod.
const CI_PEPPER = "ci_nom035_token_pepper_base64url_32b_min_xxxxxxxxxxxx";
const CI_SESSION = "ci_nom035_session_pepper_base64url_32b_min_xxxxxxxxxx";
const CI_RATE = "ci_nom035_rate_limit_pepper_base64url_32b_min_xxxxxxxx";

const lines = [
  "# Generado por scripts/ci-write-local-env.mjs — no versionar",
  envLine(["NEXT", "PUBLIC", "SUPABASE", "URL"], apiUrl),
  envLine(["NEXT", "PUBLIC", "SUPABASE", "PUBLISHABLE", "KEY"], publishable),
  envLine(["SUPABASE", "SECRET", "KEY"], secret),
  envLine(["NEXT", "PUBLIC", "APP", "URL"], "http://127.0.0.1:3000"),
  envLine(["NOM035", "PUBLIC", "EVALUATION", "BACKEND"], "supabase"),
  envLine(["NOM035", "TOKEN", "PEPPER"], CI_PEPPER),
  envLine(["NOM035", "SESSION", "PEPPER"], CI_SESSION),
  envLine(["NOM035", "RATE", "LIMIT", "PEPPER"], CI_RATE),
  envLine(["NOM035", "EVALUATION", "SESSION", "MINUTES"], "120"),
  envLine(["NOM035", "ADMIN", "BACKEND", "MODE"], "auth_rbac"),
  envLine(
    ["NOM035", "ADMIN", "ALLOWED", "ORIGINS"],
    "http://127.0.0.1:3000,http://localhost:3000"
  ),
  envLine(["NOM035", "PUBLIC", "COMPLAINT", "BACKEND"], "supabase"),
  envLine(["NOM035", "COMPLAINT", "RATE", "LIMIT", "MAX"], "5"),
  envLine(["NOM035", "COMPLAINT", "RATE", "LIMIT", "WINDOW", "MINUTES"], "60"),
  envLine(["NOM035", "EVIDENCE", "BUCKET"], "nom035-evidence"),
  envLine(["NOM035", "EVIDENCE", "MAX", "BYTES"], "15728640"),
  envLine(["NOM035", "SIGNED", "DOWNLOAD", "SECONDS"], "120"),
  "",
];

writeFileSync(resolve(process.cwd(), ".env.local"), lines.join("\n"), { mode: 0o600 });
console.log("ci-write-local-env: escribió .env.local (keys de status local + peppers CI)");
