/**
 * B4.15.4B — Passwords = NOM + numero_empleado_canonico (sin `!`).
 *
 * Dry-run:
 *   ALLOW_PRODUCTION_ACCOUNTS=B414_CREATE_83 NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   npx tsx scripts/b4154-set-passwords-to-employee-number.ts
 *
 * Ejecutar:
 *   … B4154B_EXECUTE=1 npx tsx scripts/b4154-set-passwords-to-employee-number.ts
 *
 * No crea cuentas/workers. No modifica usernames/worker_accounts/assignments/campaña.
 * No imprime passwords. Credenciales → off-repo cifradas (b4154b).
 */
import { createClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  renameSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  loadProductionEnv,
  sanitizeRef,
  resolveExpectedProjectRef,
  assertRefsMatch,
  extractProjectRefFromUrl,
} from "./lib/assert-production-only";
import {
  assertLocalPasswordPolicy,
  buildPasswordPlan,
  buildWorkerPassword,
  legacyEmpleadoUsername,
} from "./lib/b4154-employee-password";

const ALLOW = "B414_CREATE_83";
const BATCH = 10;
const CAMPAIGN = "Evaluación NOM-035 2026";
const CREDS_DIR = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-production-secrets/worker-credentials-b4154b"
);
const OLD_CREDS = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-production-secrets/worker-credentials-b414"
);
const OLD_ARCHIVE = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-production-secrets/worker-credentials-b414-pre-b4154"
);

function assertAllow(env: Record<string, string | undefined>) {
  if ((env.ALLOW_PRODUCTION_ACCOUNTS ?? "").trim() !== ALLOW) {
    throw new Error(`ABORT: falta ALLOW_PRODUCTION_ACCOUNTS=${ALLOW}`);
  }
  if ((env.NOM035_TARGET_ENV ?? "").trim() !== "production") {
    throw new Error("ABORT: NOM035_TARGET_ENV=production requerido");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlRef = extractProjectRefFromUrl(url);
  const expected = resolveExpectedProjectRef(env);
  const confirmed = (env.CONFIRM_SUPABASE_PROJECT_REF ?? "").trim();
  assertRefsMatch({ urlRef, expected, confirmed });
  return { sanitized: sanitizeRef(urlRef), urlRef };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function encryptCsv(plaintext: string, key: Buffer): { blob: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { blob: enc, iv, tag: cipher.getAuthTag() };
}

async function probeAuthPasswordPolicy(
  admin: ReturnType<typeof createClient>,
  samplePasswords: string[]
): Promise<
  | { ok: true }
  | { ok: false; failing: number; message: string; sampleLens: number[] }
> {
  // createUser puede aceptar passwords cortas; updateUserById aplica min length real.
  const email = `policy.probe.b4154.exec.${Date.now()}@workers.nom035.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "ProbeTmp9xLongEnough",
    email_confirm: true,
    user_metadata: { probe: "b4154b" },
  });
  if (error || !data.user) {
    return {
      ok: false,
      failing: samplePasswords.length,
      message: error?.message ?? "probe_create_failed",
      sampleLens: samplePasswords.map((p) => p.length),
    };
  }
  const uid = data.user.id;
  const uniqueLens = [...new Set(samplePasswords.map((p) => p.length))];
  let failing = 0;
  let message = "";
  try {
    for (const len of uniqueLens) {
      const sample = samplePasswords.find((p) => p.length === len)!;
      const upd = await admin.auth.admin.updateUserById(uid, { password: sample });
      if (upd.error) {
        failing = samplePasswords.filter((p) => p.length === len).length;
        // Si todas tienen la misma longitud, fallan todas
        if (uniqueLens.length === 1) failing = samplePasswords.length;
        message = upd.error.message;
        break;
      }
    }
  } finally {
    await admin.auth.admin.deleteUser(uid);
  }
  if (failing > 0) {
    return {
      ok: false,
      failing,
      message,
      sampleLens: samplePasswords.map((p) => p.length),
    };
  }
  return { ok: true };
}

function archiveOldCredentials(): { archived: boolean; pathHint: string } {
  if (!existsSync(OLD_CREDS)) {
    return { archived: false, pathHint: "~/Desktop/nom035-production-secrets/worker-credentials-b414 (ausente)" };
  }
  if (existsSync(OLD_ARCHIVE)) {
    return {
      archived: true,
      pathHint: "~/Desktop/nom035-production-secrets/worker-credentials-b414-pre-b4154 (ya existía)",
    };
  }
  renameSync(OLD_CREDS, OLD_ARCHIVE);
  chmodSync(OLD_ARCHIVE, 0o700);
  // Eliminar CSV plano residual si existe
  const plain = resolve(OLD_ARCHIVE, "credenciales-83.csv");
  if (existsSync(plain)) {
    unlinkSync(plain);
  }
  writeFileSync(
    resolve(OLD_ARCHIVE, "OBSOLETO.txt"),
    [
      "OBSOLETO — B4.15.4",
      "Passwords anteriores a la actualización al número de empleado.",
      "Solo rollback de emergencia. No distribuir.",
      `archivedAtUtc=${new Date().toISOString()}`,
      "",
    ].join("\n"),
    { mode: 0o600 }
  );
  return {
    archived: true,
    pathHint: "~/Desktop/nom035-production-secrets/worker-credentials-b414-pre-b4154",
  };
}

function countPlaintextCsv(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith(".csv") && !f.endsWith(".csv.enc")).length;
}

async function main() {
  const env = loadProductionEnv();
  Object.assign(process.env, env);
  const merged = {
    ...env,
    ALLOW_PRODUCTION_ACCOUNTS: process.env.ALLOW_PRODUCTION_ACCOUNTS,
    CONFIRM_SUPABASE_PROJECT_REF: process.env.CONFIRM_SUPABASE_PROJECT_REF,
    EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
    NOM035_TARGET_ENV: process.env.NOM035_TARGET_ENV ?? "production",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
  };
  const { sanitized } = assertAllow(merged);
  const execute =
    process.env.B4154B_EXECUTE === "1" || process.env.B4154_EXECUTE === "1";

  const url = merged.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta URL/secret de producción");

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });

  const { data: company, error: companyErr } = await admin
    .from("company_settings")
    .select("id,razon_social,total_trabajadores")
    .limit(1)
    .maybeSingle();
  if (companyErr || !company) throw new Error(companyErr?.message ?? "sin company");
  if (company.razon_social !== "NOM035_EMPRESA_OPERATIVA") {
    throw new Error("ABORT: company inesperada");
  }
  if (company.total_trabajadores !== 83) {
    throw new Error(`ABORT: total_trabajadores=${company.total_trabajadores}`);
  }

  const { data: campaign } = await admin
    .from("evaluation_campaigns")
    .select("id,status,activated_at,nombre")
    .eq("nombre", CAMPAIGN)
    .maybeSingle();
  if (!campaign || campaign.status !== "draft" || campaign.activated_at) {
    throw new Error(`ABORT: campaña status=${campaign?.status} activated=${!!campaign?.activated_at}`);
  }

  const { data: workersRaw, error: wErr } = await admin
    .from("workers")
    .select("id,external_reference,nombre,activo")
    .eq("activo", true);
  if (wErr) throw new Error(wErr.message);

  const workers = (workersRaw ?? [])
    .filter((w) => w.external_reference && /^[0-9]+$/.test(String(w.external_reference)))
    .sort((a, b) =>
      String(a.external_reference).localeCompare(String(b.external_reference), undefined, {
        numeric: true,
      })
    );

  if (workers.length !== 83) {
    throw new Error(`ABORT: workers=${workers.length}`);
  }

  const { data: accounts, error: aErr } = await admin
    .from("worker_accounts")
    .select("id,worker_id,auth_user_id,username_normalized,must_change_password,is_active")
    .eq("is_active", true);
  if (aErr) throw new Error(aErr.message);

  const workerIds = new Set(workers.map((w) => w.id));
  const linked = (accounts ?? []).filter((a) => workerIds.has(a.worker_id));
  if (linked.length !== 83) {
    throw new Error(`ABORT: worker_accounts linked=${linked.length}`);
  }

  const authIds = new Set(linked.map((a) => a.auth_user_id));
  if (authIds.size !== 83) {
    throw new Error(`ABORT: auth_user_id únicos=${authIds.size}`);
  }

  const mustFalse = linked.filter((a) => a.must_change_password === false).length;
  if (mustFalse !== 83) {
    throw new Error(`ABORT: must_change_password=false=${mustFalse}`);
  }

  const { count: asgCount } = await admin
    .from("evaluation_assignments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id);
  if (asgCount !== 83) {
    throw new Error(`ABORT: assignments=${asgCount}`);
  }

  const accByWorker = new Map(linked.map((a) => [a.worker_id, a]));
  const planInput = workers.map((w) => {
    const acc = accByWorker.get(w.id);
    if (!acc) throw new Error("ABORT: worker sin account");
    return {
      workerId: w.id,
      authUserId: acc.auth_user_id as string,
      username: acc.username_normalized as string,
      externalReference: String(w.external_reference),
    };
  });

  const built = buildPasswordPlan(planInput);
  if (built.emptyNumbers !== 0) {
    throw new Error(`ABORT: números vacíos=${built.emptyNumbers}`);
  }
  if (built.usernameMismatches !== 0) {
    throw new Error(`ABORT: username mismatches=${built.usernameMismatches}`);
  }
  if (built.plan.length !== 83) {
    throw new Error(`ABORT: plan=${built.plan.length}`);
  }
  if (built.uniquePasswords !== 83 || built.uniqueNumbers !== 83) {
    throw new Error(
      `ABORT: unique pwd=${built.uniquePasswords} nums=${built.uniqueNumbers} dups=${built.duplicates.length}`
    );
  }
  if (built.duplicates.length > 0) {
    throw new Error(`ABORT: passwords duplicadas=${built.duplicates.length}`);
  }
  if (built.policyFailingUnder6 > 0 || built.hasExclamation > 0) {
    console.log(
      JSON.stringify({
        verdict: "CAMBIO DE PASSWORD BLOQUEADO",
        reason: "candidate_policy",
        failingUnder6: built.policyFailingUnder6,
        failingExclamation: built.hasExclamation,
        accountsUpdated: 0,
        passwordsPrinted: false,
      })
    );
    process.exit(2);
  }

  const localPolicy = assertLocalPasswordPolicy(built.plan.map((p) => p.passwordCandidate));
  if (!localPolicy.ok) {
    console.log(
      JSON.stringify({
        verdict: "CAMBIO DE PASSWORD BLOQUEADO",
        reason: "local_policy",
        failing: localPolicy.failing,
        reasons: localPolicy.reasons,
        passwordsPrinted: false,
      })
    );
    process.exit(2);
  }

  // Sonda Auth vía updateUserById (createUser puede aceptar passwords más cortas)
  const probe = await probeAuthPasswordPolicy(
    admin,
    built.plan.map((p) => p.passwordCandidate)
  );
  if (!probe.ok) {
    console.log(
      JSON.stringify(
        {
          verdict: "CAMBIO DE PASSWORD BLOQUEADO",
          reason: "auth_password_policy",
          passwordPolicy: "INCOMPATIBLE",
          failing: probe.failing,
          why: probe.message,
          passwordLenMin: Math.min(...probe.sampleLens),
          passwordLenMax: Math.max(...probe.sampleLens),
          accountsUpdated: 0,
          usernamesModified: 0,
          campaignStatus: "draft",
          passwordsPrinted: false,
          note: "No se inventó otra password ni se bajó la política Auth.",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const leadingZerosPreserved = built.plan.filter((p) =>
    p.employeeNumberCanonical.startsWith("0")
  ).length;

  const drySummary = {
    ok: true,
    dryRun: !execute,
    refSanitized: sanitized,
    passwordPattern: "NOM+canonical",
    hasExclamation: false,
    passwordPolicy: "PASSWORD_POLICY_OK",
    workersReviewed: 83,
    authUsersFound: 83,
    passwordCandidates: 83,
    passwordsUnique: 83,
    numbersUnique: 83,
    usernamesModified: 0,
    workersModified: 0,
    workerAccountsModified: 0,
    assignmentsModified: 0,
    mustChangePasswordToModify: 0,
    accountsWithError: 0,
    leadingZerosInCanonical: leadingZerosPreserved,
    passwordLenMin: Math.min(...built.plan.map((p) => p.passwordCandidate.length)),
    passwordLenMax: Math.max(...built.plan.map((p) => p.passwordCandidate.length)),
    sanityNom0003: buildWorkerPassword("0003") === "NOM0003",
    campaignStatus: "draft",
    passwordsPrinted: false,
  };

  if (!execute) {
    console.log(JSON.stringify(drySummary, null, 2));
    return;
  }

  const archive = archiveOldCredentials();

  const authIdBefore = new Map(linked.map((a) => [a.worker_id, a.auth_user_id]));
  const usernameBefore = new Map(linked.map((a) => [a.worker_id, a.username_normalized]));

  let updated = 0;
  const batchReports: Array<{ batch: number; updated: number; errors: number }> = [];
  const nombreByWorker = new Map(workers.map((w) => [w.id, w.nombre as string]));

  for (let i = 0; i < built.plan.length; i += BATCH) {
    const batchIdx = Math.floor(i / BATCH) + 1;
    const batch = built.plan.slice(i, i + BATCH);
    let batchUpdated = 0;
    let batchErrors = 0;

    for (const row of batch) {
      // Solo password — no email, metadata, role
      const { error } = await admin.auth.admin.updateUserById(row.authUserId, {
        password: row.passwordCandidate,
      });
      if (error) {
        batchErrors += 1;
        console.log(
          JSON.stringify({
            verdict: "CAMBIO DE PASSWORD BLOQUEADO",
            stoppedAtBatch: batchIdx,
            errorSanitized: error.message.slice(0, 80),
            updatedSoFar: updated,
            passwordsPrinted: false,
          })
        );
        process.exit(3);
      }
      batchUpdated += 1;
      updated += 1;

      // No modificar worker_accounts (must_change_password ya es false).
      await admin.from("audit_log").insert({
        action: "b4154b_password_set_nom_employee_number",
        entity_type: "worker_account",
        entity_id: row.workerId,
        metadata: {
          username_len: row.username.length,
          password_len: row.passwordCandidate.length,
          pattern: "NOM+canonical",
          number_hash: createHash("sha256")
            .update(row.employeeNumberCanonical)
            .digest("hex")
            .slice(0, 12),
          // sin password ni número en claro
        },
      });
    }

    batchReports.push({ batch: batchIdx, updated: batchUpdated, errors: batchErrors });
    if (i + BATCH < built.plan.length) await sleep(600);
  }

  // Post-checks: usernames / auth ids intactos
  const { data: afterAcc } = await admin
    .from("worker_accounts")
    .select("worker_id,auth_user_id,username_normalized,must_change_password,is_active")
    .eq("is_active", true);

  const afterLinked = (afterAcc ?? []).filter((a) => workerIds.has(a.worker_id));
  let usernamesModified = 0;
  let authIdsModified = 0;
  let mustFalseAfter = 0;
  for (const a of afterLinked) {
    if (usernameBefore.get(a.worker_id) !== a.username_normalized) usernamesModified += 1;
    if (authIdBefore.get(a.worker_id) !== a.auth_user_id) authIdsModified += 1;
    if (a.must_change_password === false) mustFalseAfter += 1;
  }
  if (usernamesModified !== 0 || authIdsModified !== 0 || mustFalseAfter !== 83) {
    throw new Error(
      `POST: usernamesMod=${usernamesModified} authMod=${authIdsModified} mustFalse=${mustFalseAfter}`
    );
  }

  // Paquete cifrado nuevo
  mkdirSync(CREDS_DIR, { recursive: true, mode: 0o700 });
  const loginUrl = "https://nom035-production.vercel.app/trabajador/login";
  const header = "numero,nombre,username,password,url_login\n";
  const lines = built.plan
    .slice()
    .sort((a, b) =>
      a.employeeNumberCanonical.localeCompare(b.employeeNumberCanonical, undefined, {
        numeric: true,
      })
    )
    .map((p) => {
      const nombre = `"${String(nombreByWorker.get(p.workerId) ?? "").replace(/"/g, '""')}"`;
      return `${p.employeeNumberCanonical},${nombre},${p.username},${p.passwordCandidate},${loginUrl}`;
    });
  const plaintext = header + lines.join("\n") + "\n";
  const key = randomBytes(32);
  const { blob, iv, tag } = encryptCsv(plaintext, key);
  const encBuf = Buffer.concat([iv, tag, blob]);
  const encPath = resolve(CREDS_DIR, "credenciales-83.csv.enc");
  const keyPath = resolve(CREDS_DIR, "credenciales-83.key");
  writeFileSync(encPath, encBuf, { mode: 0o600 });
  writeFileSync(keyPath, key.toString("base64"), { mode: 0o600 });
  writeFileSync(
    resolve(CREDS_DIR, "manifest.json"),
    JSON.stringify(
      {
        createdAtUtc: new Date().toISOString(),
        refSanitized: sanitized,
        count: 83,
        passwordSource: "NOM+employee_number_canonical",
        passwordHasExclamation: false,
        encryptedFile: "credenciales-83.csv.enc",
        keyFile: "credenciales-83.key",
        sha256Encrypted: createHash("sha256").update(encBuf).digest("hex"),
        format: "AES-256-GCM; file = iv(12) || tag(16) || ciphertext",
        columns: ["numero", "nombre", "username", "password", "url_login"],
        passwordPrinted: false,
        mustChangePassword: false,
        previousPackage: "worker-credentials-b414-pre-b4154 (OBSOLETO)",
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  writeFileSync(
    resolve(CREDS_DIR, "COMO-DESCIFRAR.txt"),
    [
      "Descifrar credenciales B4.15.4B (solo en máquina segura):",
      "",
      "  node -e \"",
      "  const fs=require('fs'); const crypto=require('crypto');",
      "  const raw=fs.readFileSync('credenciales-83.csv.enc');",
      "  const key=Buffer.from(fs.readFileSync('credenciales-83.key','utf8'),'base64');",
      "  const iv=raw.subarray(0,12); const tag=raw.subarray(12,28); const data=raw.subarray(28);",
      "  const d=crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);",
      "  fs.writeFileSync('credenciales-83.csv', Buffer.concat([d.update(data), d.final()]), {mode:0o600});",
      "  \"",
      "",
      "Password = NOM + número canónico (sin signo de admiración).",
      "Elimine el CSV plano tras usarlo. No suba a Git.",
      "",
    ].join("\n"),
    { mode: 0o600 }
  );

  // Limpiar candidatos en memoria
  for (const p of built.plan) {
    p.passwordCandidate = "";
  }

  const plaintextResidual =
    countPlaintextCsv(CREDS_DIR) +
    (existsSync(OLD_ARCHIVE) ? countPlaintextCsv(OLD_ARCHIVE) : 0) +
    (existsSync(OLD_CREDS) ? countPlaintextCsv(OLD_CREDS) : 0);

  console.log(
    JSON.stringify(
      {
        ok: true,
        execute: true,
        verdict:
          updated === 83
            ? "PASSWORDS ACTUALIZADAS A NOM + NÚMERO"
            : "CAMBIO DE PASSWORD BLOQUEADO",
        refSanitized: sanitized,
        passwordPattern: "NOM+canonical",
        hasExclamation: false,
        passwordPolicy: "PASSWORD_POLICY_OK",
        accountsUpdated: updated,
        batches: batchReports,
        errors: 0,
        leadingZerosPreserved: leadingZerosPreserved > 0,
        leadingZerosCanonicalCount: leadingZerosPreserved,
        passwordsUnique: 83,
        usernamesModified,
        authIdsModified,
        workerAccountsModified: 0,
        mustChangePasswordFalse: mustFalseAfter,
        credentialsDir: CREDS_DIR.replace(process.env.HOME ?? "", "~"),
        previousPackageArchived: archive,
        PLAINTEXT_CREDENTIAL_FILES: plaintextResidual,
        campaignStatus: "draft",
        passwordsPrinted: false,
        credentialsDelivered: false,
        sanityNom0003: buildWorkerPassword("0003") === "NOM0003",
        usernameHelperSanity: legacyEmpleadoUsername("3") === "empleado.0003",
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
