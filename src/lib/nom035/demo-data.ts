import { getDominantRiskLevel } from "./results-analytics";
import {
  getActionPlans,
  getCampaignAssignments,
  getCampaignsLocal,
  getComplaints,
  getEvidenceItems,
  getEvaluationRecordsLocal,
  getPolicyDocuments,
  getWorkers,
  seedNom035LocalData,
} from "./storage-local";
import { computeNom035LocalDataStatus, type Nom035LocalDataStatus } from "./demo-data-utils";

const NOM035_STORAGE_KEYS = [
  "nom035.company",
  "nom035.workers",
  "nom035.campaigns",
  "nom035.evaluations",
  "nom035.actionPlans",
  "nom035.evidences",
  "nom035.complaints",
  "nom035.policies",
  "nom035.assignments",
] as const;

export type { Nom035LocalDataStatus } from "./demo-data-utils";
export { computeNom035LocalDataStatus } from "./demo-data-utils";

export function seedDemoData(): Nom035LocalDataStatus {
  seedNom035LocalData();
  getCampaignAssignments();
  return getNom035LocalDataStatus();
}

export function clearNom035LocalData(): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  for (const key of NOM035_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function getNom035LocalDataStatus(): Nom035LocalDataStatus {
  const workers = getWorkers().filter((worker) => worker.status === "ACTIVE");
  const campaigns = getCampaignsLocal();
  const activeCampaign = campaigns[0] ?? null;
  const assignments = getCampaignAssignments().filter((item) => item.campaignId === activeCampaign?.id);
  const records = getEvaluationRecordsLocal();
  const latestByWorker = new Map<string, (typeof records)[number]>();
  for (const assignment of assignments) {
    const matching = records
      .filter((record) => record.campaignId === assignment.campaignId && record.workerId === assignment.workerId)
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.submittedAtISO ?? 0).getTime() -
          new Date(left.completedAt ?? left.submittedAtISO ?? 0).getTime()
      )[0];
    if (matching) {
      latestByWorker.set(assignment.workerId, matching);
    }
  }
  const completedEvaluations = Array.from(latestByWorker.values()).filter(
    (record) => record.status === "completed"
  ).length;
  const pendingEvaluations = Math.max(assignments.length - completedEvaluations, 0);
  const pendingActionPlans = getActionPlans().filter(
    (action) => action.status !== "completada" && action.status !== "cancelada"
  ).length;
  const dominantGuiaIIRisk = getDominantRiskLevel(
    records.filter((record) => record.status === "completed")
  );
  const complaintsCount = getComplaints().length;
  const evidencesCount = getEvidenceItems().length;
  const publishedPolicy = getPolicyDocuments().some((policy) => policy.status === "publicada");

  return computeNom035LocalDataStatus({
    activeWorkers: workers.length,
    activeCampaignName: activeCampaign?.name ?? "Sin campaña activa",
    completedEvaluations,
    pendingEvaluations,
    dominantGuiaIIRisk: dominantGuiaIIRisk ?? "sin_datos",
    pendingActionPlans,
    complaintsCount,
    evidencesCount,
    publishedPolicy,
  });
}
