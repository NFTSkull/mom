import type { Nom035Repository } from "./repository-types";
import {
  createEvaluationRecordFromToken,
  deactivateWorker,
  deleteActionPlan,
  deleteComplaint,
  deleteEvidenceItem,
  deletePolicyDocument,
  deleteWorker,
  finalizeCompleteEvaluationByTokenLocal,
  finalizeEvaluationByTokenLocal,
  getActionPlans,
  getCampaignAssignments,
  getCampaignsLocal,
  getCompanyConfigLocal,
  getComplaints,
  getEvaluationByTokenLocal,
  getEvaluationRecordsLocal,
  getEvidenceItems,
  getLatestPolicyDocument,
  getPolicyDocuments,
  getWorkerEvaluationLinksLocal,
  getWorkers,
  saveActionPlan,
  saveCampaignAssignment,
  saveComplaint,
  saveEvidenceItem,
  saveGuiaIProgressByTokenLocal,
  saveGuiaIIProgressByTokenLocal,
  savePolicyDocument,
  saveResponsesByTokenLocal,
  saveWorker,
  seedNom035LocalData,
  updateActionPlan,
  updateCampaignAssignment,
  updateComplaint,
  updateEvidenceItem,
  updatePolicyDocument,
  updateWorker,
} from "./storage-local";

/**
 * Adaptador que envuelve storage-local sin cambiar comportamiento.
 * Las pantallas existentes siguen usando storage-local directamente en B4.0.
 */
export const localRepository: Nom035Repository = {
  mode: "local",

  seed: seedNom035LocalData,

  getCompanyConfig: getCompanyConfigLocal,

  getWorkers,
  saveWorker,
  updateWorker,
  deactivateWorker,
  deleteWorker,

  getCampaigns: getCampaignsLocal,
  getCampaignAssignments,
  saveCampaignAssignment,
  updateCampaignAssignment,
  getWorkerEvaluationLinks: getWorkerEvaluationLinksLocal,

  getEvaluationRecords: getEvaluationRecordsLocal,
  getEvaluationByToken: getEvaluationByTokenLocal,
  createEvaluationRecordFromToken,
  saveResponsesByToken: saveResponsesByTokenLocal,
  saveGuiaIProgressByToken: saveGuiaIProgressByTokenLocal,
  saveGuiaIIProgressByToken: saveGuiaIIProgressByTokenLocal,
  finalizeEvaluationByToken: finalizeEvaluationByTokenLocal,
  finalizeCompleteEvaluationByToken: finalizeCompleteEvaluationByTokenLocal,

  getActionPlans,
  saveActionPlan,
  updateActionPlan,
  deleteActionPlan,

  getEvidenceItems,
  saveEvidenceItem,
  updateEvidenceItem,
  deleteEvidenceItem,

  getComplaints,
  saveComplaint,
  updateComplaint,
  deleteComplaint,

  getPolicyDocuments,
  savePolicyDocument,
  updatePolicyDocument,
  deletePolicyDocument,
  getLatestPolicyDocument,
};
