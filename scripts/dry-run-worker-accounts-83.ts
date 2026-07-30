/**
 * Dry-run LOCAL/OFFLINE para preparar 83 cuentas Auth de trabajadores.
 * NO crea Auth users ni assignments. Solo reporta.
 *
 *   WORKERS_CSV=/ruta/fuera/de/git/trabajadores.csv npm run worker:dry-run:83
 *
 * Username propuesto: empleado.<número_normalizado>
 * Se niega contra ConCasa / production / cloud salvo flag explícito (aún así no crea).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
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
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: workers } = await admin
    .from("workers")
    .select("id, external_reference, nombre, activo");
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

  const found: string[] = [];
  const withoutAccount: string[] = [];
  const proposed: string[] = [];
  const collisions: string[] = [];
  const rejected: Array<{ ref: string; reason: string }> = [];
  const toCreateAccounts: string[] = [];
  const seenProposed = new Set<string>();

  for (const row of rows) {
    const ref =
      row.numero ||
      row.número ||
      row.external_reference ||
      row.referencia ||
      row.id_empleado ||
      "";
    if (!ref) {
      rejected.push({ ref: "(vacío)", reason: "sin_numero" });
      continue;
    }
    found.push(ref);
    const worker = byRef.get(ref.toLowerCase());
    if (!worker) {
      rejected.push({ ref, reason: "no_en_bd" });
      continue;
    }
    if (!worker.activo) {
      rejected.push({ ref, reason: "inactivo" });
      continue;
    }
    const username = proposedUsername(ref);
    proposed.push(username);
    if (seenProposed.has(username) || usernames.has(username)) {
      collisions.push(username);
    }
    seenProposed.add(username);
    if (!accountByWorker.has(worker.id)) {
      withoutAccount.push(ref);
      toCreateAccounts.push(ref);
    }
  }

  const report = {
    ok: true,
    dryRun: true,
    createsNothing: true,
    workersInCsv: rows.length,
    workersFoundInDb: found.length - rejected.filter((r) => r.reason === "no_en_db" || r.reason === "no_en_bd").length,
    withoutAccount: withoutAccount.length,
    usernamesProposedSample: proposed.slice(0, 5),
    collisions: [...new Set(collisions)],
    accountsToCreate: toCreateAccounts.length,
    assignmentsToCreateNote:
      "Assignments se crean solo tras campaña autorizada + Guía III; dry-run no cuenta assignments productivos.",
    rejected: rejected.slice(0, 20),
    rejectedTotal: rejected.length,
    fingerprint: createHash("sha256")
      .update(rows.map((r) => JSON.stringify(r)).join("|"))
      .digest("hex")
      .slice(0, 16),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
