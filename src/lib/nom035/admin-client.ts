/**
 * Cliente fetch para el panel admin (browser-safe).
 * Solo habla con /api/admin/nom035/* — nunca con Supabase directo.
 */

export type AdminApiError = {
  ok: false;
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string>;
};

export type AdminApiOk<T> = { ok: true } & T;

async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<AdminApiOk<T> | AdminApiError> {
  const res = await fetch(`/api/admin/nom035${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as AdminApiOk<T> | AdminApiError;
  return json;
}

export const adminApi = {
  dashboard: () => adminFetch<{ summary: Record<string, unknown>; requestId: string }>("/dashboard"),
  getCompany: () =>
    adminFetch<{ company: Record<string, unknown> | null; activeWorkersCount: number; requestId: string }>(
      "/company"
    ),
  putCompany: (body: Record<string, unknown>) =>
    adminFetch<{ company: Record<string, unknown>; requestId: string }>("/company", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  listWorkers: (q: URLSearchParams) =>
    adminFetch<{ items: unknown[]; total: number; page: number; pageSize: number; requestId: string }>(
      `/workers?${q}`
    ),
  createWorker: (body: Record<string, unknown>) =>
    adminFetch<{ worker: Record<string, unknown>; requestId: string }>("/workers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateWorker: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ worker: Record<string, unknown>; requestId: string }>(`/workers/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteWorker: (id: string) =>
    adminFetch<{ deletedId: string; requestId: string }>(`/workers/${id}`, { method: "DELETE" }),
  deactivateWorker: (id: string) =>
    adminFetch<{ worker: Record<string, unknown>; requestId: string }>(`/workers/${id}/deactivate`, {
      method: "POST",
      body: "{}",
    }),
  reactivateWorker: (id: string) =>
    adminFetch<{ worker: Record<string, unknown>; requestId: string }>(`/workers/${id}/reactivate`, {
      method: "POST",
      body: "{}",
    }),
  setWorkerAccountActive: (id: string, active: boolean) =>
    adminFetch<{ isActive: boolean; requestId: string }>(`/workers/${id}/account/active`, {
      method: "POST",
      body: JSON.stringify({ active }),
    }),
  resetWorkerAccess: (id: string) =>
    adminFetch<{ temporaryPassword?: string; requestId: string }>(
      `/workers/${id}/account/reset-access`,
      { method: "POST", body: "{}" }
    ),
  validateImport: (csvText: string) =>
    adminFetch<{ preview: unknown; requestId: string }>("/workers/import/validate", {
      method: "POST",
      body: JSON.stringify({ csvText }),
    }),
  commitImport: (rows: unknown[]) =>
    adminFetch<{ inserted: number; skipped: number; requestId: string }>("/workers/import/commit", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  listCampaigns: (q: URLSearchParams) =>
    adminFetch<{ items: unknown[]; total: number; requestId: string }>(`/campaigns?${q}`),
  createCampaign: (body: Record<string, unknown>) =>
    adminFetch<{ campaign: Record<string, unknown>; requestId: string }>("/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCampaign: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ campaign: Record<string, unknown>; requestId: string }>(`/campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  activateCampaign: (id: string) =>
    adminFetch<{ campaign: Record<string, unknown>; requestId: string }>(`/campaigns/${id}/activate`, {
      method: "POST",
      body: "{}",
    }),
  closeCampaign: (id: string) =>
    adminFetch<{ campaign: Record<string, unknown>; requestId: string }>(`/campaigns/${id}/close`, {
      method: "POST",
      body: "{}",
    }),
  listAssignments: (campaignId: string, q: URLSearchParams) =>
    adminFetch<{ items: unknown[]; total: number; requestId: string }>(
      `/campaigns/${campaignId}/assignments?${q}`
    ),
  issueMissing: (campaignId: string) =>
    adminFetch<{ links: unknown[]; warning?: string; requestId: string }>(
      `/campaigns/${campaignId}/assignments/issue-missing`,
      { method: "POST", body: "{}" }
    ),
  issueOne: (campaignId: string, workerId: string) =>
    adminFetch<{ token?: string; link?: string; assignmentId: string; requestId: string }>(
      `/campaigns/${campaignId}/assignments/issue`,
      { method: "POST", body: JSON.stringify({ workerId }) }
    ),
  rotateToken: (assignmentId: string) =>
    adminFetch<{ token?: string; link?: string; tokenLast4: string; requestId: string }>(
      `/assignments/${assignmentId}/rotate-token`,
      { method: "POST", body: "{}" }
    ),
  revokeAssignment: (assignmentId: string, reason?: string) =>
    adminFetch<{ status: string; requestId: string }>(`/assignments/${assignmentId}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? null }),
    }),
  listResults: (q: URLSearchParams) =>
    adminFetch<{
      items: unknown[];
      total: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      requestId: string;
    }>(`/results?${q}`),
  getResult: (id: string) =>
    adminFetch<{ detail: unknown; disclaimer?: string; requestId: string }>(`/results/${id}`),
  reportsSummary: (q: URLSearchParams) =>
    adminFetch<{ report: Record<string, unknown>; requestId: string }>(`/reports/summary?${q}`),
  reportsExecutive: () =>
    adminFetch<{
      ok: boolean;
      aggregate: Record<string, unknown>;
      generationMs?: number;
      requestId: string;
    }>("/reports/executive"),

  // —— B4.5 · Plan de acción ——
  listActionPlans: (q: URLSearchParams) =>
    adminFetch<{ items: unknown[]; total: number; page: number; pageSize: number; requestId: string }>(
      `/action-plans?${q}`
    ),
  createActionPlan: (body: Record<string, unknown>) =>
    adminFetch<{ actionPlan: Record<string, unknown>; requestId: string }>("/action-plans", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateActionPlan: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ actionPlan: Record<string, unknown>; requestId: string }>(`/action-plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  changeActionPlanStatus: (id: string, status: string) =>
    adminFetch<{ actionPlan: Record<string, unknown>; requestId: string }>(
      `/action-plans/${id}/status`,
      { method: "POST", body: JSON.stringify({ status }) }
    ),
  archiveActionPlan: (id: string) =>
    adminFetch<{ actionPlan: Record<string, unknown>; requestId: string }>(
      `/action-plans/${id}/archive`,
      { method: "POST", body: "{}" }
    ),
  generateActionPlans: (body: Record<string, unknown>) =>
    adminFetch<{
      created: number;
      existing: number;
      skipped: number;
      summary: Record<string, unknown>;
      requestId: string;
    }>("/action-plans/generate", { method: "POST", body: JSON.stringify(body) }),
  actionPlanSummary: (q?: URLSearchParams) =>
    adminFetch<{ summary: Record<string, unknown>; requestId: string }>(
      `/action-plans/summary${q ? `?${q}` : ""}`
    ),

  // —— B4.5 · Evidencias ——
  listEvidence: (q: URLSearchParams) =>
    adminFetch<{ items: unknown[]; total: number; requestId: string }>(`/evidence?${q}`),
  getEvidence: (id: string) =>
    adminFetch<{ evidence: Record<string, unknown>; versions?: unknown[]; requestId: string }>(
      `/evidence/${id}`
    ),
  evidenceSummary: () =>
    adminFetch<{ summary: Record<string, unknown>; requestId: string }>("/evidence/summary"),
  createExternalEvidence: (body: Record<string, unknown>) =>
    adminFetch<{ evidence: Record<string, unknown>; requestId: string }>("/evidence/external", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEvidence: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ evidence: Record<string, unknown>; requestId: string }>(`/evidence/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteEvidence: (id: string) =>
    adminFetch<{ evidence: Record<string, unknown>; cleanupPending: boolean; requestId: string }>(
      `/evidence/${id}`,
      { method: "DELETE" }
    ),
  retryEvidenceCleanup: (id: string) =>
    adminFetch<{ cleanupPending: boolean; requestId: string }>(`/evidence/${id}/retry-cleanup`, {
      method: "POST",
      body: "{}",
    }),
  uploadEvidence: async (form: FormData) => {
    const res = await fetch("/api/admin/nom035/evidence/upload", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    return (await res.json()) as AdminApiOk<{ evidence: Record<string, unknown>; requestId: string }> | AdminApiError;
  },
  replaceEvidence: async (id: string, form: FormData) => {
    const res = await fetch(`/api/admin/nom035/evidence/${id}/replace`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    return (await res.json()) as AdminApiOk<{ evidence: Record<string, unknown>; requestId: string }> | AdminApiError;
  },
  evidenceDownloadUrl: (id: string) => `/api/admin/nom035/evidence/${id}/download`,

  // —— B4.5 · Quejas ——
  listComplaints: (q: URLSearchParams) =>
    adminFetch<{ items: unknown[]; total: number; requestId: string }>(`/complaints?${q}`),
  getComplaint: (id: string) =>
    adminFetch<{ complaint: Record<string, unknown>; requestId: string }>(`/complaints/${id}`),
  complaintSummary: () =>
    adminFetch<{ summary: Record<string, unknown>; requestId: string }>("/complaints/summary"),
  assignComplaint: (id: string, assignedLabel: string) =>
    adminFetch<{ complaint: Record<string, unknown>; requestId: string }>(
      `/complaints/${id}/assign`,
      { method: "POST", body: JSON.stringify({ assignedLabel }) }
    ),
  changeComplaintStatus: (id: string, status: string) =>
    adminFetch<{ complaint: Record<string, unknown>; requestId: string }>(
      `/complaints/${id}/status`,
      { method: "POST", body: JSON.stringify({ status }) }
    ),
  resolveComplaint: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ complaint: Record<string, unknown>; requestId: string }>(
      `/complaints/${id}/resolve`,
      { method: "POST", body: JSON.stringify(body) }
    ),
  closeComplaint: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ complaint: Record<string, unknown>; requestId: string }>(
      `/complaints/${id}/close`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  // —— B4.5 · Políticas ——
  listPolicies: (q?: URLSearchParams) =>
    adminFetch<{ items: unknown[]; total: number; requestId: string }>(
      `/policies${q ? `?${q}` : ""}`
    ),
  getPolicy: (id: string) =>
    adminFetch<{ policy: Record<string, unknown>; requestId: string }>(`/policies/${id}`),
  policySummary: () =>
    adminFetch<{ summary: Record<string, unknown>; requestId: string }>("/policies/summary"),
  generatePolicyBase: () =>
    adminFetch<{ base: { title: string; content: string }; requestId: string }>(
      "/policies/summary?generateBase=1"
    ),
  createPolicyDraft: (body: Record<string, unknown>) =>
    adminFetch<{ policy: Record<string, unknown>; requestId: string }>("/policies", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePolicyDraft: (id: string, body: Record<string, unknown>) =>
    adminFetch<{ policy: Record<string, unknown>; requestId: string }>(`/policies/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  duplicatePolicy: (id: string, body?: Record<string, unknown>) =>
    adminFetch<{ policy: Record<string, unknown>; requestId: string }>(
      `/policies/${id}/duplicate`,
      { method: "POST", body: JSON.stringify(body ?? {}) }
    ),
  publishPolicy: (id: string) =>
    adminFetch<{ policy: Record<string, unknown>; archivedId?: string; requestId: string }>(
      `/policies/${id}/publish`,
      { method: "POST", body: "{}" }
    ),
  archivePolicy: (id: string) =>
    adminFetch<{ policy: Record<string, unknown>; requestId: string }>(`/policies/${id}/archive`, {
      method: "POST",
      body: "{}",
    }),
};
