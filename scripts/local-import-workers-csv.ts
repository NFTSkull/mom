/**
 * Importación local aislada de CSV de trabajadores (upsert por número).
 * SOLO localhost. No imprime nombres. No toca staging/producción/ConCasa.
 *
 * Uso:
 *   WORKER_CSV_PATH=/abs/path/file.csv npx tsx scripts/local-import-workers-csv.ts
 *   WORKER_CSV_PATH=... npx tsx scripts/local-import-workers-csv.ts --cleanup
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const COMPANY_MARK = "LOCAL_IMPORT_TEST_83";
const BRANCH_MARK = "LOCAL_IMPORT_TEST_83";

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  } catch {
    // ignore
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function assertLocalOnly(url: string) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url)) {
    throw new Error("ABORT: URL no es localhost");
  }
  if (/supabase\.co|nom035-staging|production|concasa|charolais/i.test(url)) {
    throw new Error("ABORT: host remoto o proyecto prohibido");
  }
}

function stubServerOnly() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Module = require("module") as any;
  const orig = Module.prototype.require;
  Module.prototype.require = function (id: string, ...rest: unknown[]) {
    if (id === "server-only") return {};
    return orig.apply(this, [id, ...rest]);
  };
}

async function upsertCompany(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("admin_upsert_company_settings", {
    p_razon_social: COMPANY_MARK,
    p_rfc: "LOC010101XXX",
    p_domicilio: "Local import test",
    p_telefono: null,
    p_actividad_principal: "Prueba importación local",
    p_total_trabajadores: 83,
    p_responsable_nombre: "LOCAL Import Tester",
    p_responsable_email: "local-import@nom035.local",
    p_responsable_telefono: null,
  });
  if (error) throw error;
  if (!(data as { ok?: boolean } | null)?.ok) {
    throw new Error(`company upsert failed: ${JSON.stringify(data)}`);
  }
}

async function importUpsert(
  admin: SupabaseClient,
  rows: Array<{
    nombre: string;
    departamento?: string;
    puesto?: string;
    referencia_externa?: string;
  }>
) {
  let created = 0;
  let updated = 0;
  let rejected = 0;
  for (const row of rows) {
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
        p_sucursal: BRANCH_MARK,
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
  return { created, updated, rejected };
}

async function verify(admin: SupabaseClient, expectedExts: string[]) {
  const { data, error } = await admin
    .from("workers")
    .select("id, nombre, departamento, puesto, external_reference, sucursal")
    .eq("sucursal", BRANCH_MARK);
  if (error) throw error;
  const rows = data ?? [];
  const exts = rows.map((r) => r.external_reference).filter(Boolean) as string[];
  const unique = new Set(exts);
  // Conservación de acentos: conteo sin imprimir nombres
  const accentCount = rows.filter((r) =>
    /[ñáéíóúÁÉÍÓÚÑüÜ]/.test(r.nombre ?? "")
  ).length;
  const truncPuestos = [
    "Regional Quality Manage",
    "Operador De Trefiladora Y Embo",
    "Operador De Cerrado De Wo",
    "Operador De Autocoiler I Autoc",
  ];
  const truncOk = truncPuestos.every((t) => rows.some((r) => r.puesto === t));

  return {
    count: rows.length,
    uniqueExts: unique.size,
    expected: expectedExts.length,
    allExpectedPresent: expectedExts.every((e) => unique.has(e)),
    accentNames: accentCount,
    truncatedPuestosPreserved: truncOk,
    depts: [...new Set(rows.map((r) => r.departamento).filter(Boolean))].sort(),
    puestosCount: new Set(rows.map((r) => r.puesto).filter(Boolean)).size,
  };
}

async function cleanup(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("workers")
    .select("id")
    .eq("sucursal", BRANCH_MARK);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id);
  for (const id of ids) {
    const del = await admin.rpc("admin_delete_worker", { p_worker_id: id });
    if (del.error) {
      // fallback hard delete si RPC no disponible
      await admin.from("workers").delete().eq("id", id);
    }
  }
  const left = await admin
    .from("workers")
    .select("id", { count: "exact", head: true })
    .eq("sucursal", BRANCH_MARK);
  // Restablecer empresa de prueba si está marcada
  const company = await admin.from("company_settings").select("id, razon_social").maybeSingle();
  if (company.data?.razon_social === COMPANY_MARK) {
    await admin.rpc("admin_upsert_company_settings", {
      p_razon_social: "LOCAL Empresa Placeholder",
      p_rfc: null,
      p_domicilio: null,
      p_telefono: null,
      p_actividad_principal: null,
      p_total_trabajadores: 0,
      p_responsable_nombre: null,
      p_responsable_email: null,
      p_responsable_telefono: null,
    });
  }
  return { deleted: ids.length, remaining: left.count ?? 0 };
}

async function main() {
  stubServerOnly();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mapWorkerCsv, assertLocalOnlySupabaseUrl } = require(
    "../src/lib/nom035/server/admin-worker-import.ts"
  ) as typeof import("../src/lib/nom035/server/admin-worker-import");

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta .env.local local");
  assertLocalOnly(url);
  assertLocalOnlySupabaseUrl(url);

  class NoopRealtimeTransport {}
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopRealtimeTransport as never },
  } as never);

  const doCleanup = process.argv.includes("--cleanup");
  if (doCleanup) {
    const c = await cleanup(admin);
    console.log(JSON.stringify({ phase: "cleanup", ...c }, null, 2));
    return;
  }

  const csvPath = resolve(
    process.env.WORKER_CSV_PATH ||
      `${process.env.HOME}/Downloads/trabajadores_nom035_83.csv`
  );
  if (!existsSync(csvPath)) throw new Error("CSV no encontrado (WORKER_CSV_PATH)");
  // No imprimir ruta si contiene nombres; solo basename genérico
  console.log(JSON.stringify({ csv_basename: csvPath.split("/").pop(), local_url_ok: true }));

  const text = readFileSync(csvPath, "utf8");
  const preview = mapWorkerCsv(text, {
    requireEmployeeFields: true,
    rejectDuplicateExactNames: true,
  });
  if (!preview.ok) {
    console.log(
      JSON.stringify({
        phase: "validate",
        ok: false,
        errorCount: preview.errors.length,
        codes: [...new Set(preview.errors.map((e) => e.code))],
      })
    );
    process.exit(2);
  }

  const expectedExts = preview.rows.map((r) => r.referencia_externa!).filter(Boolean);
  const depts = [
    ...new Set(preview.rows.map((r) => r.departamento).filter(Boolean)),
  ].sort();
  const puestos = [
    ...new Set(preview.rows.map((r) => r.puesto).filter(Boolean)),
  ].sort();

  console.log(
    JSON.stringify(
      {
        phase: "validate",
        ok: true,
        total: preview.rows.length,
        uniqueNumbers: new Set(expectedExts).size,
        duplicates: 0,
        departments: depts.length,
        positions: puestos.length,
        departmentList: depts,
      },
      null,
      2
    )
  );

  await upsertCompany(admin);

  const first = await importUpsert(admin, preview.rows);
  const after1 = await verify(admin, expectedExts);
  console.log(JSON.stringify({ phase: "import_1", ...first, verify: after1 }, null, 2));

  const second = await importUpsert(admin, preview.rows);
  const after2 = await verify(admin, expectedExts);
  console.log(JSON.stringify({ phase: "import_2", ...second, verify: after2 }, null, 2));

  // Búsquedas vía RPC (sin imprimir nombres)
  const sampleExt = expectedExts[0]!;
  const byNum = await admin.rpc("admin_list_workers", {
    p_search: sampleExt,
    p_page: 1,
    p_page_size: 20,
  });
  const sampleDept = preview.rows[0]?.departamento ?? null;
  const byDept = await admin.rpc("admin_list_workers", {
    p_search: null,
    p_departamento: sampleDept,
    p_page: 1,
    p_page_size: 100,
  });
  // Búsqueda por nombre: usar longitud del primer nombre sin revelarlo
  const nameLen = preview.rows[0]!.nombre.length;
  const nameToken = preview.rows[0]!.nombre.slice(0, Math.min(4, nameLen));
  const byName = await admin.rpc("admin_list_workers", {
    p_search: nameToken,
    p_page: 1,
    p_page_size: 20,
  });

  console.log(
    JSON.stringify(
      {
        phase: "searches",
        byNumberTotal: (byNum.data as { total?: number })?.total ?? null,
        byDeptTotal: (byDept.data as { total?: number })?.total ?? null,
        byNamePrefixTotal: (byName.data as { total?: number })?.total ?? null,
        puestoFilterInUi: false,
        note: "Filtro puesto no existe en UI; verificado en DB via verify.puestosCount",
      },
      null,
      2
    )
  );

  const idempotent =
    first.created === 83 &&
    first.updated === 0 &&
    first.rejected === 0 &&
    second.created === 0 &&
    second.updated === 83 &&
    second.rejected === 0 &&
    after2.count === 83 &&
    after2.uniqueExts === 83;

  console.log(JSON.stringify({ phase: "summary", idempotent, company: COMPANY_MARK }, null, 2));
  if (!idempotent) process.exit(3);
}

main().catch((e) => {
  console.error("LOCAL_IMPORT_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
