import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import {
  createWorker,
  listWorkers,
  workerCreateSchema,
} from "@/lib/nom035/server/admin-core-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const search = url.searchParams.get("search") ?? undefined;
    const departamento = url.searchParams.get("departamento");
    const activoRaw = url.searchParams.get("activo");
    let activo: boolean | null = null;
    if (activoRaw === "true") activo = true;
    if (activoRaw === "false") activo = false;
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return adminJsonError("invalid_payload", requestId);
    }
    const data = await listWorkers({
      page,
      pageSize,
      search,
      activo,
      departamento,
    });
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}

export async function POST(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const forbidden = ["finalScore", "token", "answers", "scoringVersion"];
    for (const key of forbidden) {
      if (key in body.value) return adminJsonError("invalid_payload", requestId);
    }
    const parsed = workerCreateSchema.safeParse(body.value);
    if (!parsed.success) return adminJsonError("invalid_payload", requestId);
    const data = await createWorker(parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
