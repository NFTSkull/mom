export interface Nom035LocalDataStatus {
  hasData: boolean;
  activeWorkers: number;
  activeCampaignName: string;
  completedEvaluations: number;
  pendingEvaluations: number;
  dominantGuiaIIRisk: string;
  pendingActionPlans: number;
  complaintsCount: number;
  evidencesCount: number;
  publishedPolicy: boolean;
}

export function computeNom035LocalDataStatus(input: {
  activeWorkers: number;
  activeCampaignName: string;
  completedEvaluations: number;
  pendingEvaluations: number;
  dominantGuiaIIRisk: string;
  pendingActionPlans: number;
  complaintsCount: number;
  evidencesCount: number;
  publishedPolicy: boolean;
}): Nom035LocalDataStatus {
  const hasData =
    input.activeWorkers > 0 ||
    input.completedEvaluations > 0 ||
    input.complaintsCount > 0 ||
    input.evidencesCount > 0 ||
    input.publishedPolicy;

  return {
    ...input,
    hasData,
  };
}
