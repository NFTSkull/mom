/**
 * B4.20 — Gates estructurales de activación de campaña (sin MFA).
 * Separado de ADMIN_SENSITIVE_ACTIONS (AAL2).
 */

export type CampaignActivationSnapshot = {
  campaignStatus: string;
  campaignsNamed: number;
  activeCampaigns: number;
  workers: number;
  workerAccounts: number;
  assignments: number;
  pending: number;
  dupWorkers: number;
  sessions: number;
  answers: number;
  results: number;
  guiaI: number;
  guiaII: number;
  guiaIII: number;
  asgExpiresSet: number;
  fechaCierreNull: boolean;
  fechaInicioNull: boolean;
  closedAtNull: boolean;
};

export function assertCampaignActivationStructuralOk(
  s: CampaignActivationSnapshot
): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (s.campaignsNamed !== 1) blockers.push("campaignsNamed != 1");
  if (s.campaignStatus !== "draft") blockers.push("campaignStatus != draft");
  if (s.activeCampaigns !== 0) blockers.push("activeCampaigns != 0");
  if (s.workers !== 83) blockers.push("workers != 83");
  if (s.workerAccounts !== 83) blockers.push("workerAccounts != 83");
  if (s.assignments !== 83) blockers.push("assignments != 83");
  if (s.pending !== 83) blockers.push("pending != 83");
  if (s.dupWorkers !== 0) blockers.push("dupWorkers != 0");
  if (s.sessions !== 0) blockers.push("sessions != 0");
  if (s.answers !== 0) blockers.push("answers != 0");
  if (s.results !== 0) blockers.push("results != 0");
  if (s.guiaI !== 83) blockers.push("guiaI != 83");
  if (s.guiaII !== 0) blockers.push("guiaII != 0");
  if (s.guiaIII !== 83) blockers.push("guiaIII != 83");
  if (s.asgExpiresSet !== 0) blockers.push("asgExpiresSet != 0");
  if (!s.fechaCierreNull) blockers.push("fecha_cierre not null");
  if (!s.fechaInicioNull) blockers.push("fecha_inicio not null");
  if (!s.closedAtNull) blockers.push("closed_at not null");
  return { ok: blockers.length === 0, blockers };
}

/** Documenta: activación de campaña no exige AAL2; endpoints sensibles sí. */
export function campaignActivationRequiresAdminAal2(): false {
  return false;
}

export function sensitiveAdminEndpointRequiresAal2(permission: string): boolean {
  const aal2 = new Set([
    "complaints.list",
    "complaints.detail",
    "complaints.contact.read",
    "complaints.manage",
    "users.manage",
    "evidence.download",
    "assignments.rotate",
    "assignments.revoke",
    "policies.publish",
  ]);
  return aal2.has(permission);
}
