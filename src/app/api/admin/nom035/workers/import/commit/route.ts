import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import { importWorkers } from "@/lib/nom035/server/admin-core-service";
import { mapWorkerCsv } from "@/lib/nom035/server/admin-worker-import";

export const runtime = "nodejs";

const rowSchema = z
  .object({
    nombre: z.string().min(1),
    email: z.string().nullable().optional(),
    telefono: z.string().nullable().optional(),
    departamento: z.string().nullable().optional(),
    puesto: z.string().nullable().optional(),
    turno: z.string().nullable().optional(),
    sucursal: z.string().nullable().optional(),
    jefe_directo: z.string().nullable().optional(),
    antiguedad: z.string().nullable().optional(),
    referencia_externa: z.string().nullable().optional(),
    activo: z.boolean().optional(),
  })
  .strict();

const bodySchema = z
  .object({
    rows: z.array(rowSchema).max(500).optional(),
    csvText: z.string().min(1).max(2_000_000).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.rows?.length || v.csvText), { message: "rows_or_csv_required" });

export async function POST(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const parsed = bodySchema.safeParse(body.value);
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);

    let rows = parsed.data.rows ?? [];
    if (parsed.data.csvText) {
      const preview = mapWorkerCsv(parsed.data.csvText);
      if (!preview.ok) {
        return adminJsonError("validation_failed", requestId);
      }
      rows = preview.rows.map((r) => ({
        nombre: r.nombre,
        email: r.email ?? null,
        telefono: r.telefono ?? null,
        departamento: r.departamento ?? null,
        puesto: r.puesto ?? null,
        turno: r.turno ?? null,
        sucursal: r.sucursal ?? null,
        jefe_directo: r.jefe_directo ?? null,
        antiguedad: r.antiguedad ?? null,
        referencia_externa: r.referencia_externa ?? null,
        activo: r.activo ?? true,
      }));
    }

    const data = await importWorkers(rows, "atomic");
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
