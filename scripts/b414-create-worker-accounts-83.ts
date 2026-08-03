/**
 * B4.14 — Crear SOLO 83 Auth + worker_accounts (usuario/contraseña).
 * Sin campaña, sin assignments, sin Guía II.
 *
 *   ALLOW_PRODUCTION_ACCOUNTS=B414_CREATE_83 NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   npx tsx scripts/b414-create-worker-accounts-83.ts
 *
 * Dry-run: omitir B414_EXECUTE=1
 * Ejecutar: B414_EXECUTE=1
 *
 * Credenciales → off-repo cifradas. Nunca imprime passwords.
 */
import { createClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadProductionEnv,
  sanitizeRef,
  resolveExpectedProjectRef,
  assertRefsMatch,
  extractProjectRefFromUrl,
} from "./lib/assert-production-only";

const ALLOW = "B414_CREATE_83";
const BATCH = 10;
const CREDS_DIR = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-production-secrets/worker-credentials-b414"
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

function normalizeEmployeeNumber(raw: string): string {
  const digits = raw.replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
  return digits.padStart(4, "0").slice(-8);
}

function proposedUsername(externalRef: string): string {
  return `empleado.${normalizeEmployeeNumber(externalRef)}`;
}

function proposedEmail(username: string): string {
  return `${username}@workers.nom035.invalid`;
}

function randomPassword(): string {
  // Aleatoria, no derivada de username/número; cumple mayúscula/minúscula/dígito.
  const core = randomBytes(18).toString("base64url");
  return `Nm${core}9a`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type WorkerRow = {
  id: string;
  external_reference: string;
  nombre: string;
  puesto: string | null;
  departamento: string | null;
  activo: boolean;
};

type CredRow = {
  numero: string;
  nombre: string;
  username: string;
  password: string;
};

function encryptCsv(plaintext: string, key: Buffer): { blob: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { blob: enc, iv, tag: cipher.getAuthTag() };
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
  const execute = process.env.B414_EXECUTE === "1";

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
  if (company.total_trabajadores !== 83) {
    throw new Error(`ABORT: total_trabajadores=${company.total_trabajadores}`);
  }

  const { data: workersRaw, error: wErr } = await admin
    .from("workers")
    .select("id,external_reference,nombre,puesto,departamento,activo")
    .eq("activo", true);
  if (wErr) throw new Error(wErr.message);

  const workers = ((workersRaw ?? []) as WorkerRow[])
    .filter((w) => w.external_reference && /^[0-9]+$/.test(String(w.external_reference)))
    .sort((a, b) =>
      String(a.external_reference).localeCompare(String(b.external_reference), undefined, {
        numeric: true,
      })
    );

  if (workers.length !== 83) {
    throw new Error(`ABORT: workers activos numéricos=${workers.length} esperado 83`);
  }

  const { data: existingAcc } = await admin
    .from("worker_accounts")
    .select("worker_id,username_normalized,is_active");
  const accByWorker = new Map((existingAcc ?? []).map((a) => [a.worker_id, a]));

  const usernames = workers.map((w) => proposedUsername(String(w.external_reference)));
  const unique = new Set(usernames);
  if (unique.size !== 83) {
    throw new Error(`ABORT: usernames únicos=${unique.size}`);
  }
  for (const a of existingAcc ?? []) {
    if (usernames.includes(a.username_normalized) && !workers.some((w) => w.id === a.worker_id)) {
      throw new Error(`ABORT: colisión username ${a.username_normalized}`);
    }
  }

  const toCreate = workers.filter((w) => !accByWorker.has(w.id));
  const already = workers.length - toCreate.length;

  const plan = {
    ok: true,
    dryRun: !execute,
    refSanitized: sanitized,
    companyLen: String(company.razon_social ?? "").length,
    workers: 83,
    alreadyHaveAccount: already,
    authAndAccountsToCreate: toCreate.length,
    usernamesUnique: 83,
    collisions: 0,
    assignmentsToCreate: 0,
    guiaII: 0,
    passwordPrinted: false,
    credentialsPathHint: "~/Desktop/nom035-production-secrets/worker-credentials-b414/",
  };

  if (!execute) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (toCreate.length === 0) {
    console.log(JSON.stringify({ ...plan, message: "nada que crear" }, null, 2));
    return;
  }

  mkdirSync(CREDS_DIR, { recursive: true, mode: 0o700 });

  const creds: CredRow[] = [];
  let created = 0;
  let updatedAuth = 0;

  // Cache auth users once
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw new Error(listed.error.message);
  const authByEmail = new Map(
    (listed.data.users ?? []).map((u) => [(u.email || "").toLowerCase(), u])
  );

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    for (const w of batch) {
      const numero = String(w.external_reference);
      const username = proposedUsername(numero);
      const email = proposedEmail(username);
      const password = randomPassword();

      let authUser = authByEmail.get(email.toLowerCase()) ?? null;
      if (authUser) {
        const { error } = await admin.auth.admin.updateUserById(authUser.id, {
          password,
          email_confirm: true,
          app_metadata: { role: "worker" },
          user_metadata: {
            worker_external_reference: numero,
            username,
          },
        });
        if (error) throw new Error(`auth update ${username}: ${error.message}`);
        updatedAuth += 1;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role: "worker" },
          user_metadata: {
            worker_external_reference: numero,
            username,
          },
        });
        if (error || !data.user) {
          throw new Error(`auth create ${username}: ${error?.message ?? "unknown"}`);
        }
        authUser = data.user;
        authByEmail.set(email.toLowerCase(), authUser);
        created += 1;
      }

      const { error: accErr } = await admin.from("worker_accounts").upsert(
        {
          company_id: company.id,
          worker_id: w.id,
          auth_user_id: authUser.id,
          username_normalized: username,
          is_active: true,
          must_change_password: false,
        },
        { onConflict: "worker_id" }
      );
      if (accErr) throw new Error(`worker_account ${username}: ${accErr.message}`);

      creds.push({
        numero,
        nombre: w.nombre,
        username,
        password,
      });

      await admin.from("audit_log").insert({
        action: "b414_worker_account_created",
        entity_type: "worker_account",
        entity_id: w.id,
        metadata: {
          username,
          worker_ref_hash: createHash("sha256").update(numero).digest("hex").slice(0, 12),
          // sin password
        },
      });
    }
    // Pausa entre lotes para no saturar Auth
    if (i + BATCH < toCreate.length) await sleep(800);
  }

  // Verificar
  const { count: waCount } = await admin
    .from("worker_accounts")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { data: linked } = await admin
    .from("worker_accounts")
    .select("worker_id,username_normalized,workers!inner(external_reference,activo)")
    .eq("is_active", true);

  const linkedNumeric = (linked ?? []).filter((row) => {
    const w = row.workers as unknown as { external_reference?: string; activo?: boolean };
    return w?.activo && /^[0-9]+$/.test(String(w.external_reference ?? ""));
  });

  if (linkedNumeric.length !== 83) {
    throw new Error(`POST-CHECK: linkedNumeric=${linkedNumeric.length} esperado 83`);
  }

  const userSet = new Set(linkedNumeric.map((r) => r.username_normalized));
  if (userSet.size !== 83) {
    throw new Error(`POST-CHECK: usernames únicos=${userSet.size}`);
  }

  // CSV cifrado (numero,nombre,username,password)
  const header = "numero,nombre,username,password,url_login\n";
  const loginUrl = "https://nom035-production.vercel.app/trabajador/login";
  const lines = creds
    .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
    .map((c) => {
      const nombre = `"${c.nombre.replace(/"/g, '""')}"`;
      return `${c.numero},${nombre},${c.username},${c.password},${loginUrl}`;
    });
  const plaintext = header + lines.join("\n") + "\n";

  const key = randomBytes(32);
  const { blob, iv, tag } = encryptCsv(plaintext, key);
  const encPath = resolve(CREDS_DIR, "credenciales-83.csv.enc");
  const keyPath = resolve(CREDS_DIR, "credenciales-83.key");
  const metaPath = resolve(CREDS_DIR, "manifest.json");
  const howPath = resolve(CREDS_DIR, "COMO-DESCIFRAR.txt");

  writeFileSync(
    encPath,
    Buffer.concat([iv, tag, blob]),
    { mode: 0o600 }
  );
  writeFileSync(keyPath, key.toString("base64"), { mode: 0o600 });
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        createdAtUtc: new Date().toISOString(),
        refSanitized: sanitized,
        count: creds.length,
        authCreated: created,
        authUpdated: updatedAuth,
        workerAccountsActiveExpected: 83,
        encryptedFile: "credenciales-83.csv.enc",
        keyFile: "credenciales-83.key",
        sha256Encrypted: createHash("sha256").update(Buffer.concat([iv, tag, blob])).digest("hex"),
        format: "AES-256-GCM; file = iv(12) || tag(16) || ciphertext",
        columns: ["numero", "nombre", "username", "password", "url_login"],
        passwordPrinted: false,
        note: "Cada fila está vinculada al worker existente (nombre/puesto/depto en DB).",
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  writeFileSync(
    howPath,
    [
      "Descifrar credenciales (solo en máquina segura):",
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
      "Luego elimine credenciales-83.csv y mueva el .key por otro canal.",
      "No suba estos archivos a Git ni los envíe por chat.",
      "",
    ].join("\n"),
    { mode: 0o600 }
  );

  // Limpiar plaintext de memoria (best-effort)
  creds.forEach((c) => {
    c.password = "";
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        execute: true,
        refSanitized: sanitized,
        authCreated: created,
        authUpdated: updatedAuth,
        workerAccountsLinked: linkedNumeric.length,
        usernamesUnique: userSet.size,
        credentialsEncrypted: true,
        credentialsDir: CREDS_DIR.replace(process.env.HOME ?? "", "~"),
        passwordPrinted: false,
        plaintextDeleted: true,
        assignmentsCreated: 0,
        campaignOpened: false,
        waActiveCountHead: waCount ?? null,
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
