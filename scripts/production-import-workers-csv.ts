/**
 * Import productiva de CSV de trabajadores (upsert por número).
 * Requiere: CONFIRM_PRODUCTION_WORKER_IMPORT=YES
 * Solo nom035-production (agbl…kubf). No imprime nombres. No crea Auth/campañas.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const EXPECTED_REF_PREFIX = "agbl";
const EXPECTED_REF_SUFFIX = "kubf";
const EXPECTED_NAME = "nom035-production";

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

function assertProduction(url: string): string {
  if (process.env.CONFIRM_PRODUCTION_WORKER_IMPORT !== "YES") {
    throw new Error("ABORT: falta CONFIRM_PRODUCTION_WORKER_IMPORT=YES");
  }
  if (/localhost|127\.0\.0\.1|concasa|charolais/i.test(url)) {
    throw new Error("ABORT: host prohibido");
  }
  const ref = new URL(url).hostname.split(".")[0] ?? "";
  if (!ref.startsWith(EXPECTED_REF_PREFIX) || !ref.endsWith(EXPECTED_REF_SUFFIX)) {
    throw new Error("ABORT: ref no autorizado");
  }
  const token = execFileSync(
    "security",
    ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
    { encoding: "utf8" }
  ).trim();
  const projects = JSON.parse(
    execFileSync(
      "curl",
      [
        "-sS",
        "-A",
        "Mozilla/5.0",
        "-H",
        `Authorization: Bearer ${token}`,
        "https://api.supabase.com/v1/projects",
      ],
      { encoding: "utf8" }
    )
  ) as Array<{ id: string; name: string }>;
  const me = projects.find((p) => p.id === ref);
  if (!me || me.name !== EXPECTED_NAME) {
    throw new Error(`ABORT: nombre remoto ${me?.name}`);
  }
  return ref;
}

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Module = require("module") as { prototype: { require: (...a: unknown[]) => unknown } };
  const orig = Module.prototype.require;
  Module.prototype.require = function (id: string, ...rest: unknown[]) {
    if (id === "server-only") return {};
    return orig.apply(this, [id, ...rest]);
  };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mapWorkerCsv } = require("../src/lib/nom035/server/admin-worker-import.ts") as typeof import("../src/lib/nom035/server/admin-worker-import");

  const env = {
    ...loadEnvFile(".env.staging.local"),
    ...loadEnvFile(".env.production.local"),
    ...(process.env as Record<string, string>),
  };
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY!;
  const ref = assertProduction(url);

  const csvPath = resolve(
    process.env.WORKER_CSV_PATH ||
      `${process.env.HOME}/Downloads/trabajadores_nom035_83.csv`
  );
  if (!existsSync(csvPath)) throw new Error("CSV no encontrado");

  const preview = mapWorkerCsv(readFileSync(csvPath, "utf8"), {
    requireEmployeeFields: true,
    rejectDuplicateExactNames: true,
  });
  if (!preview.ok) {
    console.log(JSON.stringify({ phase: "dry-run", ok: false, errors: preview.errors.length }));
    process.exit(2);
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  } as never);

  const dryOnly = process.argv.includes("--dry-run");
  const existing = await admin.from("workers").select("external_reference");
  const existingSet = new Set(
    (existing.data ?? []).map((r) => r.external_reference).filter(Boolean) as string[]
  );
  const toCreate = preview.rows.filter(
    (r) => r.referencia_externa && !existingSet.has(r.referencia_externa)
  ).length;
  const toUpdate = preview.rows.filter(
    (r) => r.referencia_externa && existingSet.has(r.referencia_externa)
  ).length;

  console.log(
    JSON.stringify(
      {
        phase: "dry-run",
        refSanitized: `${ref.slice(0, 4)}…${ref.slice(-4)}`,
        read: preview.rows.length,
        valid: preview.rows.length,
        rejected: 0,
        duplicates: 0,
        existing: existingSet.size,
        toCreate,
        toUpdate,
      },
      null,
      2
    )
  );
  if (dryOnly) return;

  let created = 0;
  let updated = 0;
  let rejected = 0;
  for (const row of preview.rows) {
    const ext = row.referencia_externa?.trim();
    if (!ext) {
      rejected += 1;
      continue;
    }
    const { data: found, error: findErr } = await admin
      .from("workers")
      .select("id")
      .eq("external_reference", ext)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!found) {
      const { data, error } = await admin.rpc("admin_create_worker", {
        p_nombre: row.nombre,
        p_email: null,
        p_telefono: null,
        p_departamento: row.departamento ?? null,
        p_puesto: row.puesto ?? null,
        p_turno: null,
        p_sucursal: null,
        p_jefe_directo: null,
        p_antiguedad: null,
        p_external_reference: ext,
        p_activo: true,
      });
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok) created += 1;
      else rejected += 1;
    } else {
      const { data, error } = await admin.rpc("admin_update_worker", {
        p_worker_id: found.id,
        p_nombre: row.nombre,
        p_departamento: row.departamento ?? null,
        p_puesto: row.puesto ?? null,
        p_email: null,
        p_telefono: null,
        p_turno: null,
        p_sucursal: null,
        p_jefe_directo: null,
        p_antiguedad: null,
        p_external_reference: null,
      });
      if (error) throw error;
      if ((data as { ok?: boolean })?.ok) updated += 1;
      else rejected += 1;
    }
  }

  const verify = await admin
    .from("workers")
    .select("id,activo,external_reference,nombre,puesto,departamento")
    .eq("activo", true);
  const rows = verify.data ?? [];
  const unique = new Set(rows.map((r) => r.external_reference).filter(Boolean));

  console.log(
    JSON.stringify(
      {
        phase: "import",
        created,
        updated,
        rejected,
        activeWorkers: rows.length,
        uniqueNumbers: unique.size,
        emptyNames: rows.filter((r) => !(r.nombre || "").trim()).length,
        emptyPuestos: rows.filter((r) => !(r.puesto || "").trim()).length,
        emptyDeps: rows.filter((r) => !(r.departamento || "").trim()).length,
      },
      null,
      2
    )
  );

  // Second pass idempotency check
  let created2 = 0;
  let updated2 = 0;
  for (const row of preview.rows) {
    const ext = row.referencia_externa?.trim();
    if (!ext) continue;
    const { data: found } = await admin
      .from("workers")
      .select("id")
      .eq("external_reference", ext)
      .maybeSingle();
    if (!found) {
      created2 += 1;
      continue;
    }
    const { data, error } = await admin.rpc("admin_update_worker", {
      p_worker_id: found.id,
      p_nombre: row.nombre,
      p_departamento: row.departamento ?? null,
      p_puesto: row.puesto ?? null,
      p_email: null,
      p_telefono: null,
      p_turno: null,
      p_sucursal: null,
      p_jefe_directo: null,
      p_antiguedad: null,
      p_external_reference: null,
    });
    if (error) throw error;
    if ((data as { ok?: boolean })?.ok) updated2 += 1;
  }
  const total = await admin
    .from("workers")
    .select("*", { count: "exact", head: true })
    .eq("activo", true);
  console.log(
    JSON.stringify({
      phase: "idempotent-second",
      created: created2,
      updated: updated2,
      activeTotal: total.count ?? 0,
    })
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
