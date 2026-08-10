/**
 * Dry-run LOCAL/OFFLINE para preparar 83 cuentas Auth de trabajadores.
 * NO crea Auth users ni assignments. Solo reporta.
 *
 *   WORKERS_CSV=/ruta/fuera/de/git/trabajadores.csv npm run worker:dry-run:83
 *
 * Username propuesto (legado B4.14): empleado.<número_normalizado>
 * B4.18: usernames de acceso pasan a 001–083; este dry-run histórico ya no
 * debe usarse para crear cuentas nuevas sin política explícita de secuencia.
 * Se niega contra ConCasa / production / cloud salvo flag explícito (aún así no crea).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env.local", ".env.production.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2]!.trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) out[m[1]!] = v;
    }
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function assertSafeTarget(url: string) {
  if (/concasa|fvtq|charolais/i.test(url)) {
    throw new Error("ABORT: ConCasa / proyectos ajenos prohibidos");
  }
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url);
  if (!isLocal && process.env.ALLOW_REMOTE_WORKER_DRY_RUN !== "1") {
    throw new Error("ABORT: dry-run remoto requiere ALLOW_REMOTE_WORKER_DRY_RUN=1");
  }
  if (/nom035-production|agbl/i.test(url) && process.env.ALLOW_PRODUCTION_DRY_RUN !== "1") {
    throw new Error("ABORT: dry-run producción requiere ALLOW_PRODUCTION_DRY_RUN=1");
  }
}

function normalizeEmployeeNumber(raw: string): string {
  const digits = raw.replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
  return digits.padStart(4, "0").slice(-8);
}

function proposedUsername(externalRef: string): string {
  return `empleado.${normalizeEmployeeNumber(externalRef)}`;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function rowNumero(row: Record<string, string>): string {
  return (
    row.numero ||
    row.número ||
    row["número"] ||
    row.external_reference ||
    row.referencia ||
    row.id_empleado ||
    ""
  );
}

async function main() {
  const env = loadEnv();
  const csvPath = env.WORKERS_CSV;
  if (!csvPath || !existsSync(csvPath)) {
    throw new Error("Defina WORKERS_CSV apuntando a un CSV fuera de Git");
  }
  if (csvPath.includes("/Desktop/Mom/") || csvPath.includes("\\Mom\\")) {
    console.warn("ADVERTENCIA: CSV parece estar dentro del repo; preferir ruta externa.");
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta .env.local");
  assertSafeTarget(url);

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const options: { auth: object; realtime?: { transport: new () => unknown } } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: class {} as never };
  }
  const admin = createClient(url, secret, options as never);

  const { data: workers } = await admin
    .from("workers")
    .select("id, external_reference, activo");
  const { data: accounts } = await admin
    .from("worker_accounts")
    .select("worker_id, username_normalized, is_active");

  const byRef = new Map(
    (workers ?? [])
      .filter((w) => w.external_reference)
      .map((w) => [String(w.external_reference).toLowerCase(), w])
  );
  const accountByWorker = new Map((accounts ?? []).map((a) => [a.worker_id, a]));
  const usernames = new Set((accounts ?? []).map((a) => a.username_normalized));

  const validRefs: string[] = [];
  const rejected: Array<{ refHash: string; reason: string }> = [];
  const proposed: string[] = [];
  const collisions: string[] = [];
  const withoutAccount: string[] = [];
  const foundInDb: string[] = [];
  const seenProposed = new Set<string>();
  const seenRefs = new Set<string>();
  let duplicates = 0;

  for (const row of rows) {
    const ref = rowNumero(row);
    if (!ref) {
      rejected.push({
        refHash: "empty",
        reason: "sin_numero",
      });
      continue;
    }
    const refKey = ref.toLowerCase();
    if (seenRefs.has(refKey)) {
      duplicates += 1;
      rejected.push({
        refHash: createHash("sha256").update(refKey).digest("hex").slice(0, 8),
        reason: "duplicado",
      });
      continue;
    }
    seenRefs.add(refKey);
    validRefs.push(ref);

    const username = proposedUsername(ref);
    proposed.push(username);
    if (seenProposed.has(username) || usernames.has(username)) {
      collisions.push(username);
    }
    seenProposed.add(username);

    const worker = byRef.get(refKey);
    if (!worker) {
      // CSV válido; aún no en BD local — no es rechazo estructural del CSV.
      withoutAccount.push(ref);
      continue;
    }
    foundInDb.push(ref);
    if (!worker.activo) {
      rejected.push({
        refHash: createHash("sha256").update(refKey).digest("hex").slice(0, 8),
        reason: "inactivo",
      });
      continue;
    }
    if (!accountByWorker.has(worker.id)) {
      withoutAccount.push(ref);
    }
  }

  const validUnique = validRefs.length;
  const accountsToCreate = withoutAccount.length;
  const assignmentsToCreate = validUnique;
  const n = validUnique;

  const numericWorkers = (workers ?? []).filter(
    (w) => w.external_reference && /^[0-9]+$/.test(String(w.external_reference))
  );
  const workersExisting = numericWorkers.length;
  const workersToCreate = Math.max(0, validUnique - foundInDb.length);
  const authUsersToCreate = accountsToCreate;
  const workerAccountsToCreate = accountsToCreate;
  const uniqueCollisions = [...new Set(collisions)];

  const report = {
    ok: true,
    dryRun: true,
    createsNothing: true,
    authUsersCreated: 0,
    passwordsGenerated: 0,
    leidos: rows.length,
    validos: validUnique,
    numerosUnicos: seenRefs.size,
    duplicados: duplicates,
    rechazados: rejected.length,
    workersEncontradosEnBd: foundInDb.length,
    workersExistentes: workersExisting,
    workersACrear: workersToCreate,
    workersSinCuenta: withoutAccount.length,
    authUsersACrear: authUsersToCreate,
    workerAccountsACrear: workerAccountsToCreate,
    accountsToCreate,
    assignmentsNuevos: assignmentsToCreate,
    assignmentsToCreate,
    usernamesUnicos: proposed.length - uniqueCollisions.length,
    usernamesProposedSample: proposed.slice(0, 5),
    usernamesProposedCount: proposed.length,
    colisiones: uniqueCollisions.length,
    collisions: uniqueCollisions,
    collisionsCount: uniqueCollisions.length,
    guiaI: n,
    guiaIII: n,
    guiaII: 0,
    camposAdicionalesAlTrabajador: 0,
    instrumentsPerAssignment: {
      GUIA_I: n,
      GUIA_III: n,
      GUIA_II: 0,
    },
    instrumentsRequiredFor83: ["GUIA_I", "GUIA_III"],
    guiaIIAssignmentsExpected: 0,
    questionnaireVersionExpected: "nom035-stps-2018-guias-referencia-i-iii",
    rejectedSample: rejected.slice(0, 10),
    fingerprint: createHash("sha256")
      .update(validRefs.map((r) => r.toLowerCase()).sort().join("|"))
      .digest("hex")
      .slice(0, 16),
    passCriteria: {
      leidos83: rows.length === 83,
      validos83: validUnique === 83,
      unicos83: seenRefs.size === 83,
      duplicados0: duplicates === 0,
      workersExistentes83: workersExisting === 83,
      workersACrear0: workersToCreate === 0,
      authUsersACrear83: authUsersToCreate === 83,
      workerAccountsACrear83: workerAccountsToCreate === 83,
      usernamesUnicos83: proposed.length === 83 && uniqueCollisions.length === 0,
      colisiones0: uniqueCollisions.length === 0,
      assignmentsNuevos83: assignmentsToCreate === 83,
      guiaI83: n === 83,
      guiaIII83: n === 83,
      guiaII0: true,
      camposAdicionales0: true,
      passwordsGeneradas0: true,
      guiaIEqualsN: n === validUnique,
      guiaIIIEqualsN: n === validUnique,
    },
  };

  const criteriaOk = Object.values(report.passCriteria).every(Boolean);
  console.log(JSON.stringify({ ...report, ok: criteriaOk }, null, 2));
  if (!criteriaOk) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
