import { MOCK_CAMPAIGNS } from "@/data/nom035/mock-campaigns";
import { MOCK_COMPANY } from "@/data/nom035/mock-company";
import { MOCK_WORKERS } from "@/data/nom035/mock-workers";
import type {
  ActionPlanItem,
  Campaign,
  CampaignAssignment,
  ConfidentialComplaint,
  CompanyConfig,
  EvidenceItem,
  EvaluationRecord,
  EvaluationResponse,
  GuiaIIAnswers,
  GuiaIIResult,
  GuiaIResult,
  PolicyDocument,
  QuestionnaireType,
  Worker,
  WorkerEvaluationLink,
} from "@/types/nom035";
import { calculateNom035Result } from "@/lib/nom035/scoring-engine";

const STORAGE_KEYS = {
  company: "nom035.company",
  workers: "nom035.workers",
  campaigns: "nom035.campaigns",
  evaluations: "nom035.evaluations",
  actionPlans: "nom035.actionPlans",
  evidences: "nom035.evidences",
  complaints: "nom035.complaints",
  policies: "nom035.policies",
  assignments: "nom035.assignments",
} as const;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJSON<T>(key: string, fallback: T): T {
  if (!canUseBrowserStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function seedNom035LocalData(): void {
  if (!canUseBrowserStorage()) return;

  const company = readJSON<CompanyConfig | null>(STORAGE_KEYS.company, null);
  if (!company) writeJSON(STORAGE_KEYS.company, MOCK_COMPANY);

  const workers = readJSON<Worker[]>(STORAGE_KEYS.workers, []);
  if (workers.length === 0) writeJSON(STORAGE_KEYS.workers, MOCK_WORKERS);

  const campaigns = readJSON<Campaign[]>(STORAGE_KEYS.campaigns, []);
  if (campaigns.length === 0) writeJSON(STORAGE_KEYS.campaigns, MOCK_CAMPAIGNS);

  const evaluations = readJSON<EvaluationRecord[]>(STORAGE_KEYS.evaluations, []);
  if (evaluations.length === 0) writeJSON(STORAGE_KEYS.evaluations, []);

  const actionPlans = readJSON<ActionPlanItem[]>(STORAGE_KEYS.actionPlans, []);
  if (actionPlans.length === 0) writeJSON(STORAGE_KEYS.actionPlans, []);

  const evidences = readJSON<EvidenceItem[]>(STORAGE_KEYS.evidences, []);
  if (evidences.length === 0) writeJSON(STORAGE_KEYS.evidences, []);

  const complaints = readJSON<ConfidentialComplaint[]>(STORAGE_KEYS.complaints, []);
  if (complaints.length === 0) writeJSON(STORAGE_KEYS.complaints, []);

  const policies = readJSON<PolicyDocument[]>(STORAGE_KEYS.policies, []);
  if (policies.length === 0) writeJSON(STORAGE_KEYS.policies, []);

  const assignments = readJSON<CampaignAssignment[]>(STORAGE_KEYS.assignments, []);
  if (assignments.length === 0) {
    const campaignsForSeed = readJSON<Campaign[]>(STORAGE_KEYS.campaigns, MOCK_CAMPAIGNS);
    const now = new Date().toISOString();
    const seededAssignments = campaignsForSeed.flatMap((campaign) =>
      campaign.workerIds.map((workerId) => ({
        id: `assign-${campaign.id}-${workerId}`,
        campaignId: campaign.id,
        workerId,
        token: tokenForWorkerCampaign(workerId, campaign.id),
        createdAt: now,
        updatedAt: now,
      }))
    );
    writeJSON(STORAGE_KEYS.assignments, seededAssignments);
  }
}

export function getCompanyConfigLocal(): CompanyConfig {
  return readJSON<CompanyConfig>(STORAGE_KEYS.company, MOCK_COMPANY);
}

export function getWorkersLocal(): Worker[] {
  return readJSON<Worker[]>(STORAGE_KEYS.workers, MOCK_WORKERS);
}

export function getWorkers(): Worker[] {
  return getWorkersLocal();
}

export function saveWorker(
  worker: Omit<Worker, "id" | "employeeNumber">
): Worker {
  const current = getWorkersLocal();
  const nextNumber = current.length + 1001;
  const next: Worker = {
    ...worker,
    id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employeeNumber: `A-${nextNumber}`,
  };
  writeJSON(STORAGE_KEYS.workers, [next, ...current]);
  return next;
}

export function updateWorker(
  id: string,
  patch: Partial<Omit<Worker, "id" | "employeeNumber">>
): Worker | null {
  const current = getWorkersLocal();
  let updated: Worker | null = null;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...patch,
    };
    return updated;
  });
  writeJSON(STORAGE_KEYS.workers, next);
  return updated;
}

export function deactivateWorker(id: string): Worker | null {
  return updateWorker(id, { status: "INACTIVE" });
}

export function deleteWorker(id: string): void {
  const workers = getWorkersLocal();
  writeJSON(
    STORAGE_KEYS.workers,
    workers.filter((worker) => worker.id !== id)
  );
}

export function getCampaignsLocal(): Campaign[] {
  return readJSON<Campaign[]>(STORAGE_KEYS.campaigns, MOCK_CAMPAIGNS);
}

function persistCampaigns(campaigns: Campaign[]): void {
  writeJSON(STORAGE_KEYS.campaigns, campaigns);
}

function ensureWorkerIdInCampaign(campaignId: string, workerId: string): void {
  const campaigns = getCampaignsLocal();
  const next = campaigns.map((campaign) => {
    if (campaign.id !== campaignId) return campaign;
    if (campaign.workerIds.includes(workerId)) return campaign;
    return {
      ...campaign,
      workerIds: [...campaign.workerIds, workerId],
    };
  });
  persistCampaigns(next);
}

export function getCampaignAssignments(): CampaignAssignment[] {
  const assignments = readJSON<CampaignAssignment[]>(STORAGE_KEYS.assignments, []);
  const campaigns = getCampaignsLocal();
  const now = new Date().toISOString();
  const fromCampaigns = campaigns.flatMap((campaign) =>
    campaign.workerIds.map((workerId) => ({
      id: `assign-${campaign.id}-${workerId}`,
      campaignId: campaign.id,
      workerId,
      token: tokenForWorkerCampaign(workerId, campaign.id),
      createdAt: now,
      updatedAt: now,
    }))
  );
  const merged = [...assignments];
  for (const legacy of fromCampaigns) {
    const exists = merged.some(
      (item) => item.campaignId === legacy.campaignId && item.workerId === legacy.workerId
    );
    if (!exists) merged.push(legacy);
  }
  const normalized = merged.map((item) => ({
    ...item,
    token: item.token || tokenForWorkerCampaign(item.workerId, item.campaignId),
    createdAt: item.createdAt ?? now,
    updatedAt: item.updatedAt ?? now,
  }));
  writeJSON(STORAGE_KEYS.assignments, normalized);
  return normalized;
}

export function saveCampaignAssignment(
  assignment: Omit<CampaignAssignment, "id" | "createdAt" | "updatedAt">
): CampaignAssignment {
  const current = getCampaignAssignments();
  const existing = current.find(
    (item) => item.campaignId === assignment.campaignId && item.workerId === assignment.workerId
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const next: CampaignAssignment = {
    ...assignment,
    id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  writeJSON(STORAGE_KEYS.assignments, [next, ...current]);
  ensureWorkerIdInCampaign(next.campaignId, next.workerId);
  return next;
}

export function updateCampaignAssignment(
  id: string,
  patch: Partial<Omit<CampaignAssignment, "id" | "createdAt">>
): CampaignAssignment | null {
  const current = getCampaignAssignments();
  const index = current.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updated: CampaignAssignment = {
    ...current[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const next = [...current];
  next[index] = updated;
  writeJSON(STORAGE_KEYS.assignments, next);
  ensureWorkerIdInCampaign(updated.campaignId, updated.workerId);
  return updated;
}

export function getEvaluationRecordsLocal(): EvaluationRecord[] {
  const raw = readJSON<EvaluationRecord[]>(STORAGE_KEYS.evaluations, []);
  return raw.map((record) => ({
    ...record,
    status: record.status ?? (record.submittedAtISO ? "completed" : "pending"),
    completedAt: record.completedAt ?? record.submittedAtISO ?? null,
    guiaIAnswers: record.guiaIAnswers ?? record.responses ?? [],
    guiaIIAnswers: record.guiaIIAnswers ?? null,
    guiaIResult: record.guiaIResult ?? record.calculated ?? null,
    guiaIIResult: record.guiaIIResult ?? null,
  }));
}

export function getActionPlans(): ActionPlanItem[] {
  const raw = readJSON<ActionPlanItem[]>(STORAGE_KEYS.actionPlans, []);
  return raw.map((item) => ({
    ...item,
    status: item.status ?? "pendiente",
    followUpNotes: item.followUpNotes ?? "",
  }));
}

export function saveActionPlan(
  action: Omit<ActionPlanItem, "id" | "createdAt" | "updatedAt">
): ActionPlanItem {
  const current = getActionPlans();
  const now = new Date().toISOString();
  const nextAction: ActionPlanItem = {
    ...action,
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  writeJSON(STORAGE_KEYS.actionPlans, [nextAction, ...current]);
  return nextAction;
}

export function updateActionPlan(
  id: string,
  patch: Partial<Omit<ActionPlanItem, "id" | "createdAt">>
): ActionPlanItem | null {
  const current = getActionPlans();
  let updated: ActionPlanItem | null = null;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });

  writeJSON(STORAGE_KEYS.actionPlans, next);
  return updated;
}

export function deleteActionPlan(id: string): void {
  const current = getActionPlans();
  const next = current.filter((item) => item.id !== id);
  writeJSON(STORAGE_KEYS.actionPlans, next);
}

export function getEvidenceItems(): EvidenceItem[] {
  const raw = readJSON<EvidenceItem[]>(STORAGE_KEYS.evidences, []);
  return raw.map((item) => ({
    ...item,
    notes: item.notes ?? "",
    fileName: item.fileName ?? "",
    fileUrl: item.fileUrl ?? "",
  }));
}

export function saveEvidenceItem(
  evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">
): EvidenceItem {
  const current = getEvidenceItems();
  const now = new Date().toISOString();
  const nextItem: EvidenceItem = {
    ...evidence,
    id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  writeJSON(STORAGE_KEYS.evidences, [nextItem, ...current]);
  return nextItem;
}

export function updateEvidenceItem(
  id: string,
  patch: Partial<Omit<EvidenceItem, "id" | "createdAt">>
): EvidenceItem | null {
  const current = getEvidenceItems();
  let updated: EvidenceItem | null = null;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });

  writeJSON(STORAGE_KEYS.evidences, next);
  return updated;
}

export function deleteEvidenceItem(id: string): void {
  const current = getEvidenceItems();
  const next = current.filter((item) => item.id !== id);
  writeJSON(STORAGE_KEYS.evidences, next);
}

export function getComplaints(): ConfidentialComplaint[] {
  const raw = readJSON<ConfidentialComplaint[]>(STORAGE_KEYS.complaints, []);
  return raw.map((item) => ({
    ...item,
    status: item.status ?? "recibida",
    resolutionNotes: item.resolutionNotes ?? "",
    assignedTo: item.assignedTo ?? "",
  }));
}

export function saveComplaint(
  complaint: Omit<ConfidentialComplaint, "id" | "createdAt" | "updatedAt">
): ConfidentialComplaint {
  const current = getComplaints();
  const now = new Date().toISOString();
  const next: ConfidentialComplaint = {
    ...complaint,
    id: `complaint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  writeJSON(STORAGE_KEYS.complaints, [next, ...current]);
  return next;
}

export function updateComplaint(
  id: string,
  patch: Partial<Omit<ConfidentialComplaint, "id" | "createdAt">>
): ConfidentialComplaint | null {
  const current = getComplaints();
  let updated: ConfidentialComplaint | null = null;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  writeJSON(STORAGE_KEYS.complaints, next);
  return updated;
}

export function deleteComplaint(id: string): void {
  const current = getComplaints();
  const next = current.filter((item) => item.id !== id);
  writeJSON(STORAGE_KEYS.complaints, next);
}

export function getPolicyDocuments(): PolicyDocument[] {
  const raw = readJSON<PolicyDocument[]>(STORAGE_KEYS.policies, []);
  return raw
    .map((item) => ({
      ...item,
      status: item.status ?? "borrador",
    }))
    .sort(
      (left, right) =>
        new Date(right.updatedAt ?? right.createdAt).getTime() -
        new Date(left.updatedAt ?? left.createdAt).getTime()
    );
}

export function savePolicyDocument(
  policy: Omit<PolicyDocument, "id" | "createdAt" | "updatedAt">
): PolicyDocument {
  const current = getPolicyDocuments();
  const now = new Date().toISOString();
  const next: PolicyDocument = {
    ...policy,
    id: `policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  writeJSON(STORAGE_KEYS.policies, [next, ...current]);
  return next;
}

export function updatePolicyDocument(
  id: string,
  patch: Partial<Omit<PolicyDocument, "id" | "createdAt">>
): PolicyDocument | null {
  const current = getPolicyDocuments();
  let updated: PolicyDocument | null = null;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  writeJSON(STORAGE_KEYS.policies, next);
  return updated;
}

export function deletePolicyDocument(id: string): void {
  const current = getPolicyDocuments();
  const next = current.filter((item) => item.id !== id);
  writeJSON(STORAGE_KEYS.policies, next);
}

export function getLatestPolicyDocument(): PolicyDocument | null {
  const items = getPolicyDocuments();
  return items[0] ?? null;
}

function upsertEvaluationRecord(record: EvaluationRecord): void {
  const current = getEvaluationRecordsLocal();
  const next = [...current.filter((item) => item.id !== record.id), record];
  writeJSON(STORAGE_KEYS.evaluations, next);
}

function tokenForWorkerCampaign(workerId: string, campaignId: string): string {
  return `${campaignId}__${workerId}`;
}

export function getWorkerEvaluationLinksLocal(basePath = "/evaluacion"): WorkerEvaluationLink[] {
  return getCampaignAssignments().map((assignment) => ({
    workerId: assignment.workerId,
    campaignId: assignment.campaignId,
    token: assignment.token,
    url: `${basePath}/${assignment.token}`,
  }));
}

export function createEvaluationRecordFromToken(token: string): EvaluationRecord | null {
  const [campaignId, workerId] = token.split("__");
  if (!campaignId || !workerId) return null;

  const campaign = getCampaignsLocal().find((item) => item.id === campaignId);
  if (!campaign) return null;

  const questionnaireType: QuestionnaireType = campaign.questionnaireTypes[0] ?? "GUIA_I";
  const record: EvaluationRecord = {
    id: `eval-${token}`,
    campaignId,
    workerId,
    token,
    questionnaireType,
    responses: [],
    submittedAtISO: null,
    calculated: null,
    status: "pending",
    completedAt: null,
    guiaIAnswers: [],
    guiaIIAnswers: null,
    guiaIResult: null,
    guiaIIResult: null,
  };

  upsertEvaluationRecord(record);
  return record;
}

export function getEvaluationByTokenLocal(token: string): EvaluationRecord | null {
  return getEvaluationRecordsLocal().find((record) => record.token === token) ?? null;
}

export function saveResponsesByTokenLocal(token: string, responses: EvaluationResponse[]): EvaluationRecord | null {
  const current = getEvaluationByTokenLocal(token) ?? createEvaluationRecordFromToken(token);
  if (!current) return null;

  const next: EvaluationRecord = {
    ...current,
    responses,
    guiaIAnswers: responses,
    status: "in_progress",
  };
  upsertEvaluationRecord(next);
  return next;
}

export function saveGuiaIProgressByTokenLocal(
  token: string,
  guiaIAnswers: EvaluationResponse[]
): EvaluationRecord | null {
  const current = getEvaluationByTokenLocal(token) ?? createEvaluationRecordFromToken(token);
  if (!current) return null;

  const next: EvaluationRecord = {
    ...current,
    responses: guiaIAnswers,
    guiaIAnswers,
    status: "in_progress",
  };

  upsertEvaluationRecord(next);
  return next;
}

export function saveGuiaIIProgressByTokenLocal(
  token: string,
  guiaIIAnswers: GuiaIIAnswers
): EvaluationRecord | null {
  const current = getEvaluationByTokenLocal(token) ?? createEvaluationRecordFromToken(token);
  if (!current) return null;

  const next: EvaluationRecord = {
    ...current,
    guiaIIAnswers,
    status: "in_progress",
  };

  upsertEvaluationRecord(next);
  return next;
}

export function finalizeEvaluationByTokenLocal(
  token: string,
  calculatedOverride?: GuiaIResult
): EvaluationRecord | null {
  const current = getEvaluationByTokenLocal(token) ?? createEvaluationRecordFromToken(token);
  if (!current) return null;

  const calculated =
    calculatedOverride ?? calculateNom035Result(current.questionnaireType, current.responses);
  const next: EvaluationRecord = {
    ...current,
    submittedAtISO: new Date().toISOString(),
    calculated,
    guiaIResult: calculated,
    status: "completed",
    completedAt: new Date().toISOString(),
  };

  upsertEvaluationRecord(next);
  return next;
}

export function finalizeCompleteEvaluationByTokenLocal(
  token: string,
  payload: {
    guiaIAnswers: EvaluationResponse[];
    guiaIIAnswers: GuiaIIAnswers | null;
    guiaIResult: GuiaIResult;
    guiaIIResult: GuiaIIResult | null;
  }
): EvaluationRecord | null {
  const current = getEvaluationByTokenLocal(token) ?? createEvaluationRecordFromToken(token);
  if (!current) return null;

  const completedAt = new Date().toISOString();
  const next: EvaluationRecord = {
    ...current,
    responses: payload.guiaIAnswers,
    guiaIAnswers: payload.guiaIAnswers,
    guiaIIAnswers: payload.guiaIIAnswers,
    calculated: payload.guiaIResult,
    guiaIResult: payload.guiaIResult,
    guiaIIResult: payload.guiaIIResult,
    submittedAtISO: completedAt,
    completedAt,
    status: "completed",
  };

  upsertEvaluationRecord(next);
  return next;
}
