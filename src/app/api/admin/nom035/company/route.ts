import { NextRequest } from "next/server";
import {
  adminJsonError,
  adminJsonOk,
  readJsonBody,
  requireAdminApiAuth,
  unwrapRpc,
} from "@/lib/nom035/server/admin-api-helpers";
import {
  companyUpsertSchema,
  getCompanySettings,
  upsertCompanySettings,
} from "@/lib/nom035/server/admin-core-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const data = await getCompanySettings();
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}

export async function PUT(req: NextRequest) {
  const { requestId, denied } = await requireAdminApiAuth(req);
  if (denied) return denied;
  try {
    const body = await readJsonBody(req);
    if (!body.ok) return adminJsonError(body.code, requestId);
    const parsed = companyUpsertSchema.safeParse(body.value);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".") || "body"] = issue.message;
      }
      return adminJsonError("invalid_payload", requestId, fieldErrors);
    }
    const data = await upsertCompanySettings(parsed.data);
    const unwrapped = unwrapRpc(data, requestId);
    if (!unwrapped.ok) return unwrapped.response;
    return adminJsonOk({ ...unwrapped.value, requestId });
  } catch {
    return adminJsonError("internal_error", requestId);
  }
}
