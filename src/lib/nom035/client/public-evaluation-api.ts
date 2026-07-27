/**
 * Cliente HTTP del flujo público. Corre en el navegador.
 * NO calcula scores. NO conoce peppers ni secret keys.
 * Las cookies HttpOnly las gestiona el navegador automáticamente.
 */

export interface ApiError {
  ok: false;
  code: string;
  message: string;
  requestId: string;
}

export interface PublicContext {
  assignmentId: string;
  workerName?: string;
  campaignId?: string;
  campaignName?: string;
  status: string;
  startedAt?: string | null;
  expiresAt?: string | null;
  questionnaireVersion?: string;
  draft?: Record<string, unknown> | null;
}

async function callApi<T>(
  path: string,
  init: RequestInit
): Promise<{ ok: true; data: T } | ApiError> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!res.ok || body.ok === false) {
    return {
      ok: false,
      code: String(body.code ?? "internal_error"),
      message: String(body.message ?? "Ocurrió un error. Intenta de nuevo."),
      requestId: String(body.requestId ?? ""),
    };
  }
  return { ok: true, data: body as T };
}

export async function exchangeToken(token: string) {
  return callApi<{ context: PublicContext }>("/api/public/evaluations/session", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function fetchSessionContext() {
  return callApi<{ context: PublicContext }>("/api/public/evaluations/session", {
    method: "GET",
  });
}

export async function clearSession() {
  return callApi<{ cleared: boolean }>("/api/public/evaluations/session", {
    method: "DELETE",
  });
}

export async function startEvaluation() {
  return callApi<{ context: PublicContext }>("/api/public/evaluations/start", {
    method: "POST",
  });
}

export async function saveDraft(
  payload: Record<string, unknown>,
  expectedUpdatedAt?: string | null
) {
  return callApi<{ updatedAt: string }>("/api/public/evaluations/draft", {
    method: "PUT",
    body: JSON.stringify({ payload, expectedUpdatedAt: expectedUpdatedAt ?? null }),
  });
}

export async function submitEvaluation(payload: {
  submissionId: string;
  guiaI: { responses: Record<string, number> };
  guiaII: {
    gateClientes: string;
    gateJefe: string;
    responses: Record<number, string>;
  };
}) {
  return callApi<{
    completed: boolean;
    completedAt: string;
    confirmationId: string;
  }>("/api/public/evaluations/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
