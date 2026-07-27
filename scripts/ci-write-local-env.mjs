#!/usr/bin/env node
/**
 * Genera .env.local desde `supabase status -o env` para jobs CI con stack local.
 * Peppers son sintéticos fijos (solo CI/local efímero). Nunca versionar el archivo.
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

// Peppers sintéticos CI (base64url >= 32 bytes). No son secretos de staging/prod.
const CI_PEPPER = "ci_nom035_token_pepper_base64url_32b_min_xxxxxxxxxxxx";
const CI_SESSION = "ci_nom035_session_pepper_base64url_32b_min_xxxxxxxxxx";
const CI_RATE = "ci_nom035_rate_limit_pepper_base64url_32b_min_xxxxxxxx";

const body = `# Generado por scripts/ci-write-local-env.mjs — no versionar
NEXT_PUBLIC_SUPABASE_URL=${apiUrl}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}
SUPABASE_SECRET_KEY=${secret}
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NOM035_PUBLIC_EVALUATION_BACKEND=supabase
NOM035_TOKEN_PEPPER=${CI_PEPPER}
NOM035_SESSION_PEPPER=${CI_SESSION}
NOM035_RATE_LIMIT_PEPPER=${CI_RATE}
NOM035_EVALUATION_SESSION_MINUTES=120
NOM035_ADMIN_BACKEND_MODE=auth_rbac
NOM035_ADMIN_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
NOM035_PUBLIC_COMPLAINT_BACKEND=supabase
NOM035_COMPLAINT_RATE_LIMIT_MAX=5
NOM035_COMPLAINT_RATE_LIMIT_WINDOW_MINUTES=60
NOM035_EVIDENCE_BUCKET=nom035-evidence
NOM035_EVIDENCE_MAX_BYTES=15728640
NOM035_SIGNED_DOWNLOAD_SECONDS=120
`;

writeFileSync(resolve(process.cwd(), ".env.local"), body, { mode: 0o600 });
console.log("ci-write-local-env: escribió .env.local (keys de status local + peppers CI)");
