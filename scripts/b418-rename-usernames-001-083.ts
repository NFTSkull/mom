/**
 * B4.18 — Renombrar usernames de los 83 trabajadores a 001–083.
 *
 * Fuente de orden: mismo sort numérico de external_reference que B4.14
 * (lista original / credenciales). NO reordena por nombre.
 *
 * Solo actualiza worker_accounts.username_normalized (2 fases UNIQUE-safe).
 * NO cambia passwords, auth_user_id, worker_id, assignments, campaña.
 * NO toca ConCasa.
 *
 * Dry-run:
 *   ALLOW_PRODUCTION_ACCOUNTS=B418_RENAME_83 NOM035_TARGET_ENV=production \
 *   EXPECTED_SUPABASE_PROJECT_REF=… CONFIRM_SUPABASE_PROJECT_REF=… \
 *   npx tsx scripts/b418-rename-usernames-001-083.ts
 *
 * Execute:
 *   … B418_EXECUTE=1 npx tsx scripts/b418-rename-usernames-001-083.ts
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, createCipheriv, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  loadProductionEnv,
  sanitizeRef,
  resolveExpectedProjectRef,
  assertRefsMatch,
  extractProjectRefFromUrl,
} from "./lib/assert-production-only";
import {
  buildSequenceMapping,
  isLegacyEmpleadoUsername,
  redactMapping,
  sortWorkersLikeB414Creation,
  type B418MappingRow,
} from "../src/lib/nom035/b418-username-sequence";
import {
  normalizeEmployeeNumber,
  passwordFromEmployeeNumber,
} from "./lib/b4154-employee-password";

const ALLOW = "B418_RENAME_83";
const REAL_CAMPAIGN = "Evaluación NOM-035 2026";
const BACKUP_ROOT = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-production-backups"
);
const CREDS_DIR = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-production-secrets/worker-credentials-b418"
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
  if (urlRef.startsWith("fvtq")) throw new Error("ABORT: ConCasa prohibido");
  return { sanitized: sanitizeRef(urlRef), urlRef };
}

function sqlQueryJson(file: string): unknown {
  const out = execFileSync(
    "npx",
    ["supabase", "db", "query", "--linked", "--output-format", "json", "-f", file],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  const parsed = JSON.parse(out) as { rows?: Array<Record<string, unknown>> };
  return parsed.rows?.[0] ?? parsed;
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
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
  };
  const { sanitized } = assertAllow(merged);
  const execute = process.env.B418_EXECUTE === "1";

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
    .select("id,total_trabajadores")
    .limit(1)
    .maybeSingle();
  if (companyErr || !company) throw new Error(companyErr?.message ?? "sin company");
  if (company.total_trabajadores !== 83) {
    throw new Error(`ABORT: total_trabajadores=${company.total_trabajadores}`);
  }

  const { data: workersRaw, error: wErr } = await admin
    .from("workers")
    .select("id,external_reference,nombre,activo")
    .eq("activo", true);
  if (wErr) throw new Error(wErr.message);

  const workers = sortWorkersLikeB414Creation(
    ((workersRaw ?? []) as Array<{
      id: string;
      external_reference: string;
      nombre: string;
      activo: boolean;
    }>)
      .filter((w) => w.external_reference && /^[0-9]+$/.test(String(w.external_reference)))
      .map((w) => ({
        id: w.id,
        externalReference: String(w.external_reference),
        nombre: w.nombre,
        activo: w.activo,
      }))
  );

  if (workers.length !== 83) {
    throw new Error(`ABORT: workers numéricos=${workers.length}`);
  }

  const { data: accounts, error: aErr } = await admin
    .from("worker_accounts")
    .select(
      "id,worker_id,auth_user_id,username_normalized,must_change_password,is_active"
    )
    .eq("is_active", true);
  if (aErr) throw new Error(aErr.message);

  const accByWorker = new Map(
    (accounts ?? []).map((a) => [a.worker_id as string, a])
  );

  const orderedForMapping = workers.map((w) => {
    const acc = accByWorker.get(w.id);
    if (!acc) throw new Error(`ABORT: sin account para worker ${w.id.slice(0, 8)}`);
    return {
      oldUsername: String(acc.username_normalized),
      employeeNumberRaw: w.externalReference,
      workerId: w.id,
      authUserId: String(acc.auth_user_id),
      accountId: String(acc.id),
      mustChange: Boolean(acc.must_change_password),
      nombre: w.nombre,
    };
  });

  const alreadyApplied = orderedForMapping.every(
    (r, i) => r.oldUsername === String(i + 1).padStart(3, "0")
  );

  let mapping: B418MappingRow[];
  if (alreadyApplied) {
    mapping = orderedForMapping.map((r, i) => ({
      index1Based: i + 1,
      oldUsername: r.oldUsername,
      newUsername: r.oldUsername,
      employeeNumberRaw: r.employeeNumberRaw,
      workerId: r.workerId,
      authUserId: r.authUserId,
      accountId: r.accountId,
    }));
  } else {
    const legacyCount = orderedForMapping.filter((r) =>
      isLegacyEmpleadoUsername(r.oldUsername)
    ).length;
    if (legacyCount !== 83) {
      throw new Error(
        `ABORT: usernames legado empleado.*=${legacyCount} (esperado 83 o ya 001–083)`
      );
    }
    mapping = buildSequenceMapping(
      orderedForMapping.map((r) => ({
        oldUsername: r.oldUsername,
        employeeNumberRaw: r.employeeNumberRaw,
      }))
    ).map((m, i) => ({
      ...m,
      workerId: orderedForMapping[i]!.workerId,
      authUserId: orderedForMapping[i]!.authUserId,
      accountId: orderedForMapping[i]!.accountId,
    }));
  }

  // Collisions with non-target accounts
  const newSet = new Set(mapping.map((m) => m.newUsername));
  const foreignCollision = (accounts ?? []).filter((a) => {
    const u = String(a.username_normalized);
    if (newSet.has(u) && !mapping.some((m) => m.accountId === a.id)) return true;
    return false;
  });

  const { data: campaign } = await admin
    .from("evaluation_campaigns")
    .select("id,status,nombre")
    .eq("nombre", REAL_CAMPAIGN)
    .maybeSingle();

  const campaignId = campaign?.id as string | undefined;
  let asgCount = 0;
  let guiaI = 0;
  let guiaII = 0;
  let guiaIII = 0;
  const dryCounts = { sessions: 0, answers: 0, results: 0 };
  if (campaignId) {
    const { count } = await admin
      .from("evaluation_assignments")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    asgCount = count ?? 0;

    mkdirSync(resolve(".tmp"), { recursive: true });
    const qSql = resolve(".tmp", "b418-dry-counts.sql");
    writeFileSync(
      qSql,
      `select jsonb_build_object(
  'guia_i', (select count(*)::int from public.assignment_questionnaires aq
    join public.evaluation_assignments ea on ea.id=aq.assignment_id
    where ea.campaign_id='${campaignId}' and aq.questionnaire_type='GUIA_I'),
  'guia_ii', (select count(*)::int from public.assignment_questionnaires aq
    join public.evaluation_assignments ea on ea.id=aq.assignment_id
    where ea.campaign_id='${campaignId}' and aq.questionnaire_type='GUIA_II'),
  'guia_iii', (select count(*)::int from public.assignment_questionnaires aq
    join public.evaluation_assignments ea on ea.id=aq.assignment_id
    where ea.campaign_id='${campaignId}' and aq.questionnaire_type='GUIA_III'),
  'sessions', (select count(*)::int from public.evaluation_sessions es
    join public.evaluation_assignments ea on ea.id=es.assignment_id
    where ea.campaign_id='${campaignId}'),
  'answers', (select count(*)::int from public.evaluation_answers a
    join public.evaluation_assignments ea on ea.id=a.assignment_id
    where ea.campaign_id='${campaignId}'),
  'results', (select count(*)::int from public.evaluation_results er
    join public.evaluation_assignments ea on ea.id=er.assignment_id
    where ea.campaign_id='${campaignId}')
) as d;`
    );
    if (!process.env.SUPABASE_DB_PASSWORD) {
      const dbPassPath = resolve(
        process.env.HOME ?? "",
        "Desktop/nom035-production-secrets/db_password.txt"
      );
      if (existsSync(dbPassPath)) {
        process.env.SUPABASE_DB_PASSWORD = readFileSync(dbPassPath, "utf8").trim();
      }
    }
    const counts = sqlQueryJson(qSql) as { d?: Record<string, number> };
    const c = counts.d ?? (counts as Record<string, number>);
    guiaI = Number(c.guia_i ?? 0);
    guiaII = Number(c.guia_ii ?? 0);
    guiaIII = Number(c.guia_iii ?? 0);
    dryCounts.sessions = Number(c.sessions ?? 0);
    dryCounts.answers = Number(c.answers ?? 0);
    dryCounts.results = Number(c.results ?? 0);
  }

  const mustFalse = orderedForMapping.filter((r) => !r.mustChange).length;
  const authIds = new Set(mapping.map((m) => m.authUserId));

  const { count: adminCount } = await admin
    .from("admin_profiles")
    .select("id", { count: "exact", head: true });

  const targetAccountIds = new Set(mapping.map((m) => m.accountId));
  const nonTarget = (accounts ?? []).filter((a) => !targetAccountIds.has(String(a.id)));

  const dry = {
    ok: foreignCollision.length === 0 && mapping.length === 83,
    dryRun: !execute,
    alreadyApplied,
    refSanitized: sanitized,
    workersObjetivo: workers.length,
    workerAccountsObjetivo: mapping.length,
    authUsersRelacionados: authIds.size,
    usernamesActualesUnicos: new Set(orderedForMapping.map((r) => r.oldUsername)).size,
    usernamesNuevos: mapping.length,
    usernamesNuevosUnicos: newSet.size,
    rango: { min: mapping[0]?.newUsername, max: mapping[82]?.newUsername },
    colisionesConOtros: foreignCollision.length,
    adminsAfectados: 0,
    sinteticosAfectados: 0,
    legacyAfectados: 0,
    nonTargetAccountsPresent: nonTarget.length,
    passwordsAModificar: 0,
    authUserIdsAModificar: 0,
    workerIdsAModificar: 0,
    assignmentsAModificar: 0,
    mustChangePasswordFalse: mustFalse,
    campaignStatus: campaign?.status ?? null,
    assignments: asgCount,
    guiaI,
    guiaII,
    guiaIII,
    sessions: dryCounts.sessions,
    answers: dryCounts.answers,
    results: dryCounts.results,
    mappingPreview: redactMapping(mapping).slice(0, 3),
    mappingPreviewLast: redactMapping(mapping).slice(-2),
    adminProfilesCount: adminCount ?? 0,
  };

  if (!dry.ok) {
    console.log(JSON.stringify({ ...dry, verdict: "ROLLBACK / DETENER" }, null, 2));
    process.exit(1);
  }

  if (!execute) {
    console.log(JSON.stringify(dry, null, 2));
    return;
  }

  if (alreadyApplied) {
    console.log(
      JSON.stringify(
        { ...dry, message: "idempotente: mapping 001–083 ya aplicado", passwordsModificadas: 0 },
        null,
        2
      )
    );
    return;
  }

  // —— BACKUP off-repo ——
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(BACKUP_ROOT, `${stamp}-b418-usernames`);
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  const backupPayload = {
    createdAtUtc: new Date().toISOString(),
    refSanitized: sanitized,
    workers: 83,
    worker_accounts: 83,
    usernamesActuales: 83,
    assignments: asgCount,
    campaign: campaign?.status ?? null,
    mapping: mapping.map((m) => ({
      index1Based: m.index1Based,
      oldUsername: m.oldUsername,
      newUsername: m.newUsername,
      workerId: m.workerId,
      authUserId: m.authUserId,
      accountId: m.accountId,
      employeeNumberRaw: m.employeeNumberRaw,
      // sin password, sin nombre
    })),
  };
  const backupJson = JSON.stringify(backupPayload, null, 2);
  const backupPath = resolve(backupDir, "username-mapping-backup.json");
  writeFileSync(backupPath, backupJson, { mode: 0o600 });
  const backupSha = createHash("sha256").update(backupJson).digest("hex");
  writeFileSync(
    resolve(backupDir, "manifest.json"),
    JSON.stringify(
      {
        createdAtUtc: backupPayload.createdAtUtc,
        sha256: backupSha,
        pathHint: "~/Desktop/nom035-production-backups/<stamp>-b418-usernames/",
        workers: 83,
        worker_accounts: 83,
        usernamesActuales: 83,
        assignments: asgCount,
        campaign: campaign?.status ?? null,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  if (!existsSync(backupPath) || backupSha.length !== 64) {
    throw new Error("ABORT: backup falló");
  }

  // —— TWO-PHASE UPDATE via SQL transaction ——
  // Temporales deben cumplir worker_accounts_username_normalized_chk:
  // ^[a-z0-9][a-z0-9._-]*$  (no pueden empezar con _)
  const phaseAValues = mapping
    .map(
      (m, i) =>
        `('${m.accountId}'::uuid, 'x.b418.${String(i + 1).padStart(3, "0")}.${m.accountId.replace(/-/g, "").slice(0, 8)}')`
    )
    .join(",\n");
  const phaseBValues = mapping
    .map((m) => `('${m.accountId}'::uuid, '${m.newUsername}')`)
    .join(",\n");

  const sqlPath = resolve(".tmp", "b418-rename-usernames.sql");
  mkdirSync(resolve(".tmp"), { recursive: true });
  writeFileSync(
    sqlPath,
    `-- B4.18 rename usernames 001-083 (transactional two-phase)
begin;

-- Guard: campaña draft
do $$
declare v_status text;
begin
  select status::text into v_status from public.evaluation_campaigns
  where nombre = '${REAL_CAMPAIGN}' limit 1;
  if v_status is distinct from 'draft' then
    raise exception 'ABORT: campaña status=%', v_status;
  end if;
end $$;

-- FASE A: temporales únicos
update public.worker_accounts wa
set username_normalized = v.new_u
from (values
${phaseAValues}
) as v(account_id, new_u)
where wa.id = v.account_id
  and wa.is_active = true
  and wa.username_normalized like 'empleado.%';

-- FASE B: definitivos 001-083
update public.worker_accounts wa
set username_normalized = v.new_u
from (values
${phaseBValues}
) as v(account_id, new_u)
where wa.id = v.account_id
  and wa.is_active = true
  and wa.username_normalized like 'x.b418.%';

-- Post-checks
do $$
declare
  v_seq int;
  v_legacy int;
  v_tmp int;
  v_min text;
  v_max text;
begin
  select count(*)::int into v_seq from public.worker_accounts
  where is_active and username_normalized ~ '^[0-9]{3}$'
    and username_normalized::int between 1 and 83;
  select count(*)::int into v_legacy from public.worker_accounts
  where is_active and username_normalized like 'empleado.%';
  select count(*)::int into v_tmp from public.worker_accounts
  where username_normalized like 'x.b418.%';
  select min(username_normalized), max(username_normalized)
    into v_min, v_max
  from public.worker_accounts
  where is_active and username_normalized ~ '^[0-9]{3}$';
  if v_seq <> 83 or v_legacy <> 0 or v_tmp <> 0 or v_min <> '001' or v_max <> '083' then
    raise exception 'POST-CHECK FAIL seq=% legacy=% tmp=% min=% max=%',
      v_seq, v_legacy, v_tmp, v_min, v_max;
  end if;
end $$;

insert into public.audit_log(action, entity_type, entity_id, metadata)
values (
  'b418_usernames_renamed_001_083',
  'worker_accounts',
  null,
  jsonb_build_object(
    'count', 83,
    'min', '001',
    'max', '083',
    'passwordsModified', 0,
    'authUserIdsModified', 0
  )
);

commit;

select jsonb_build_object(
  'seq', (select count(*)::int from public.worker_accounts where is_active and username_normalized ~ '^[0-9]{3}$'),
  'legacy', (select count(*)::int from public.worker_accounts where is_active and username_normalized like 'empleado.%'),
  'tmp', (select count(*)::int from public.worker_accounts where username_normalized like 'x.b418.%'),
  'min', (select min(username_normalized) from public.worker_accounts where is_active and username_normalized ~ '^[0-9]{3}$'),
  'max', (select max(username_normalized) from public.worker_accounts where is_active and username_normalized ~ '^[0-9]{3}$')
) as d;
`,
    { mode: 0o600 }
  );

  if (!process.env.SUPABASE_DB_PASSWORD) {
    const dbPassPath = resolve(
      process.env.HOME ?? "",
      "Desktop/nom035-production-secrets/db_password.txt"
    );
    if (existsSync(dbPassPath)) {
      process.env.SUPABASE_DB_PASSWORD = readFileSync(dbPassPath, "utf8").trim();
    }
  }

  const result = sqlQueryJson(sqlPath) as { d?: Record<string, unknown> };
  const d = result.d ?? (result as Record<string, unknown>);

  // Verify auth_user_id / worker_id unchanged
  const { data: after } = await admin
    .from("worker_accounts")
    .select("id,worker_id,auth_user_id,username_normalized,must_change_password")
    .eq("is_active", true);

  let authChanged = 0;
  let workerChanged = 0;
  let mustTrue = 0;
  for (const m of mapping) {
    const row = (after ?? []).find((a) => String(a.id) === m.accountId);
    if (!row) throw new Error(`missing account ${m.accountId}`);
    if (String(row.auth_user_id) !== m.authUserId) authChanged += 1;
    if (String(row.worker_id) !== m.workerId) workerChanged += 1;
    if (row.must_change_password) mustTrue += 1;
    if (String(row.username_normalized) !== m.newUsername) {
      throw new Error(`username mismatch expected ${m.newUsername}`);
    }
  }

  // New credentials package (NOM passwords, new usernames) — off-repo, not delivered yet
  mkdirSync(CREDS_DIR, { recursive: true, mode: 0o700 });
  const loginUrl = "https://nom035-production.vercel.app/trabajador/login";
  const header = "numero,nombre,username,password,url_login\n";
  const lines = mapping.map((m, i) => {
    const nombre = orderedForMapping[i]!.nombre.replace(/"/g, '""');
    const numero = normalizeEmployeeNumber(m.employeeNumberRaw);
    const password = passwordFromEmployeeNumber(m.employeeNumberRaw);
    return `${numero},"${nombre}",${m.newUsername},${password},${loginUrl}`;
  });
  const plaintext = header + lines.join("\n") + "\n";
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, enc]);
  writeFileSync(resolve(CREDS_DIR, "credenciales-83.csv.enc"), blob, { mode: 0o600 });
  writeFileSync(resolve(CREDS_DIR, "credenciales-83.key"), key.toString("base64"), {
    mode: 0o600,
  });
  writeFileSync(
    resolve(CREDS_DIR, "manifest.json"),
    JSON.stringify(
      {
        createdAtUtc: new Date().toISOString(),
        refSanitized: sanitized,
        count: 83,
        usernameFormat: "001-083",
        passwordSource: "NOM+employee_number_canonical (unchanged)",
        encryptedFile: "credenciales-83.csv.enc",
        keyFile: "credenciales-83.key",
        sha256Encrypted: createHash("sha256").update(blob).digest("hex"),
        format: "AES-256-GCM; file = iv(12) || tag(16) || ciphertext",
        columns: ["numero", "nombre", "username", "password", "url_login"],
        passwordPrinted: false,
        delivered: false,
        previousPackage: "worker-credentials-b4154b",
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        execute: true,
        refSanitized: sanitized,
        sqlResult: d,
        backupSha256: backupSha,
        backupPathHint: "~/Desktop/nom035-production-backups/<stamp>-b418-usernames/",
        mappingApplied: 83,
        firstUsername: "001",
        lastUsername: "083",
        passwordsModificadas: 0,
        authUserIdsModificados: authChanged,
        workerIdsModificados: workerChanged,
        mustChangePasswordTrue: mustTrue,
        assignments: asgCount,
        campaignStatus: campaign?.status ?? null,
        credentialsPackageHint:
          "~/Desktop/nom035-production-secrets/worker-credentials-b418/",
        delivered: false,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});
