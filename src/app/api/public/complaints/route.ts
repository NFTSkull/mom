import { NextRequest } from "next/server";
import {
  deriveRateLimitKey,
  isAllowedOrigin,
  jsonError,
  jsonOk,
  newRequestId,
  readJsonBody,
} from "@/lib/nom035/server/api-helpers";
import { consumeRateLimit } from "@/lib/nom035/server/public-rate-limit";
import { getPublicComplaintEnv } from "@/lib/env";
import {
  publicComplaintSchema,
  submitPublicComplaint,
} from "@/lib/nom035/server/complaint-service";

export const runtime = "nodejs";

/**
 * Endpoint público de quejas confidenciales (B4.5).
 * Valida Origin, aplica rate limit por HMAC de IP, honeypot y longitudes.
 * Nunca imprime cuerpo, descripción ni contacto. Devuelve solo el comprobante.
 */
export async function POST(req: NextRequest) {
  const requestId = newRequestId();

  if (!isAllowedOrigin(req)) {
    return jsonError("forbidden_origin", requestId);
  }

  try {
    const env = getPublicComplaintEnv();

    const rate = await consumeRateLimit({
      rawKey: deriveRateLimitKey(req),
      action: "public_complaint",
      limit: env.rateLimitMax,
      windowSeconds: env.rateLimitWindowMinutes * 60,
    });
    if (!rate.allowed) {
      return jsonError("rate_limited", requestId, {
        "Retry-After": String(rate.retryAfter),
      });
    }

    const body = await readJsonBody(req);
    if (!body.ok) return jsonError(body.code, requestId);

    const parsed = publicComplaintSchema.safeParse(body.value);
    if (!parsed.success) return jsonError("invalid_payload", requestId);

    // Honeypot: si el campo trampa viene con contenido, rechazar como inválido.
    if (parsed.data.website && parsed.data.website.length > 0) {
      return jsonError("invalid_payload", requestId);
    }

    const result = await submitPublicComplaint(parsed.data);
    if (result.ok === false) {
      return jsonError("invalid_payload", requestId);
    }

    return jsonOk(
      {
        folio: result.folio,
        confirmationCode: result.confirmationCode,
        receivedAt: result.receivedAt,
      },
      201
    );
  } catch {
    return jsonError("internal_error", requestId);
  }
}
