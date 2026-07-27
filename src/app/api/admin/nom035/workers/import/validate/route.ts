import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
} from "@/lib/nom035/server/admin-api-helpers";
import { mapWorkerCsv } from "@/lib/nom035/server/admin-worker-import";
import { importWorkers } from "@/lib/nom035/server/admin-core-service";
import { unwrapRpc } from "@/lib/nom035/server/admin-api-helpers";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    csvText: z.string().min(1).max(2_000_000),
  })
  .strict();

export async function POST(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const parsed = bodySchema.safeParse(body.value);
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);

    const preview = mapWorkerCsv(parsed.data.csvText);
    if (!preview.ok) {
      return adminJsonOk({ preview, requestId });
    }

    const rpc = await importWorkers(
      preview.rows.map((r) => ({
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
      })),
      "validate_only"
    );
    const unwrapped = unwrapRpc(rpc, requestId);
    if (!unwrapped.ok) {
      // Devolver preview + errores DB sin fallar el contrato
      return adminJsonOk({
        preview: {
          ...preview,
          ok: false,
          dbErrors: rpc,
        },
        requestId,
      });
    }
    return adminJsonOk({ preview, dbValidation: unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
