import type {
  ActionPlanItem,
  Campaign,
  CampaignAssignment,
  CompanyConfig,
  ConfidentialComplaint,
  EvaluationRecord,
  EvaluationResponse,
  EvidenceItem,
  GuiaIIAnswers,
  GuiaIIResult,
  GuiaIResult,
  PolicyDocument,
  Worker,
  WorkerEvaluationLink,
} from "../../types/nom035";

export type RepositoryMode = "local" | "supabase";

/**
 * Contrato de persistencia NOM-035.
 * B4.0: solo hay implementación local; supabase llega en bloques posteriores.
 */
export interface Nom035Repository {
  readonly mode: RepositoryMode;

  seed(): void;

  getCompanyConfig(): CompanyConfig;

  getWorkers(): Worker[];
  saveWorker(worker: Omit<Worker, "id" | "employeeNumber">): Worker;
  updateWorker(id: string, patch: Partial<Omit<Worker, "id" | "employeeNumber">>): Worker | null;
  deactivateWorker(id: string): Worker | null;
  deleteWorker(id: string): void;

  getCampaigns(): Campaign[];
  getCampaignAssignments(): CampaignAssignment[];
  saveCampaignAssignment(
    assignment: Omit<CampaignAssignment, "id" | "createdAt" | "updatedAt">
  ): CampaignAssignment;
  updateCampaignAssignment(
    id: string,
    patch: Partial<Omit<CampaignAssignment, "id" | "createdAt">>
  ): CampaignAssignment | null;
  getWorkerEvaluationLinks(basePath?: string): WorkerEvaluationLink[];

  getEvaluationRecords(): EvaluationRecord[];
  getEvaluationByToken(token: string): EvaluationRecord | null;
  createEvaluationRecordFromToken(token: string): EvaluationRecord | null;
  saveResponsesByToken(token: string, responses: EvaluationResponse[]): EvaluationRecord | null;
  saveGuiaIProgressByToken(
    token: string,
    guiaIAnswers: EvaluationResponse[]
  ): EvaluationRecord | null;
  saveGuiaIIProgressByToken(token: string, guiaIIAnswers: GuiaIIAnswers): EvaluationRecord | null;
  finalizeEvaluationByToken(
    token: string,
    calculatedOverride?: GuiaIResult
  ): EvaluationRecord | null;
  finalizeCompleteEvaluationByToken(
    token: string,
    payload: {
      guiaIAnswers: EvaluationResponse[];
      guiaIIAnswers: GuiaIIAnswers | null;
      guiaIResult: GuiaIResult;
      guiaIIResult: GuiaIIResult | null;
    }
  ): EvaluationRecord | null;

  getActionPlans(): ActionPlanItem[];
  saveActionPlan(action: Omit<ActionPlanItem, "id" | "createdAt" | "updatedAt">): ActionPlanItem;
  updateActionPlan(
    id: string,
    patch: Partial<Omit<ActionPlanItem, "id" | "createdAt">>
  ): ActionPlanItem | null;
  deleteActionPlan(id: string): void;

  getEvidenceItems(): EvidenceItem[];
  saveEvidenceItem(evidence: Omit<EvidenceItem, "id" | "createdAt" | "updatedAt">): EvidenceItem;
  updateEvidenceItem(
    id: string,
    patch: Partial<Omit<EvidenceItem, "id" | "createdAt">>
  ): EvidenceItem | null;
  deleteEvidenceItem(id: string): void;

  getComplaints(): ConfidentialComplaint[];
  saveComplaint(
    complaint: Omit<ConfidentialComplaint, "id" | "createdAt" | "updatedAt">
  ): ConfidentialComplaint;
  updateComplaint(
    id: string,
    patch: Partial<Omit<ConfidentialComplaint, "id" | "createdAt">>
  ): ConfidentialComplaint | null;
  deleteComplaint(id: string): void;

  getPolicyDocuments(): PolicyDocument[];
  savePolicyDocument(
    policy: Omit<PolicyDocument, "id" | "createdAt" | "updatedAt">
  ): PolicyDocument;
  updatePolicyDocument(
    id: string,
    patch: Partial<Omit<PolicyDocument, "id" | "createdAt">>
  ): PolicyDocument | null;
  deletePolicyDocument(id: string): void;
  getLatestPolicyDocument(): PolicyDocument | null;
}
