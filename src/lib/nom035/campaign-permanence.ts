/**
 * B4.16.2 — Reglas de campaña permanente (espejo de check_assignment_usable).
 * Sin gates por fecha_inicio/fecha_cierre. Sesión ≠ cuenta ≠ assignment.
 */

export type AssignmentUsabilityCode =
  | "ok"
  | "revoked"
  | "completed"
  | "expired"
  | "worker_inactive"
  | "campaign_unavailable";

export type PermanenceInput = {
  assignmentStatus: "pending" | "in_progress" | "completed" | "revoked";
  assignmentExpiresAt: Date | null;
  workerActive: boolean;
  campaignStatus: "draft" | "active" | "closed";
  /** Metadatos admin; NO deben afectar usabilidad tras B4.16.2 */
  fechaInicio?: Date | null;
  fechaCierre?: Date | null;
};

export function checkAssignmentUsableAt(
  input: PermanenceInput,
  now: Date
): AssignmentUsabilityCode {
  if (input.assignmentStatus === "revoked") return "revoked";
  if (input.assignmentStatus === "completed") return "completed";
  if (
    input.assignmentExpiresAt != null &&
    input.assignmentExpiresAt.getTime() <= now.getTime()
  ) {
    return "expired";
  }
  if (!input.workerActive) return "worker_inactive";
  if (input.campaignStatus !== "active") return "campaign_unavailable";
  // fechaInicio / fechaCierre intencionalmente ignorados
  void input.fechaInicio;
  void input.fechaCierre;
  return "ok";
}

export function assertNoTimeBasedCampaignExpiry(offsetsDays: number[], now: Date): {
  ok: true;
  samples: Array<{ days: number; code: AssignmentUsabilityCode }>;
} {
  const base: PermanenceInput = {
    assignmentStatus: "pending",
    assignmentExpiresAt: null,
    workerActive: true,
    campaignStatus: "active",
    fechaInicio: null,
    fechaCierre: new Date(now.getTime() + 1 * 86400000), // si se usara, caducaría pronto
  };
  const samples = offsetsDays.map((days) => {
    const t = new Date(now.getTime() + days * 86400000);
    return { days, code: checkAssignmentUsableAt(base, t) };
  });
  if (samples.some((s) => s.code !== "ok")) {
    throw new Error("AUTO_EXPIRATION detectada en simulación de tiempo");
  }
  return { ok: true, samples };
}

export function workerPortalActionForStatus(
  evaluationStatus: string,
  campaignActive: boolean
): "awaiting" | "start" | "continue" | "done" | "none" {
  if (evaluationStatus === "awaiting_campaign") return "awaiting";
  if (evaluationStatus === "completed") return "done";
  if (!campaignActive && evaluationStatus === "pending") return "awaiting";
  if (evaluationStatus === "pending") return "start";
  if (evaluationStatus === "in_progress") return "continue";
  return "none";
}

/** Draft server-side: keyed by assignment_id; sin columna expires. */
export function draftSurvivesSessionExpiry(opts: {
  draftAssignmentId: string;
  sessionExpired: boolean;
  reLoginSameWorker: boolean;
  sameAssignmentId: string;
}): boolean {
  if (!opts.reLoginSameWorker) return false;
  return (
    opts.draftAssignmentId === opts.sameAssignmentId &&
    // sessionExpired no borra evaluation_drafts
    true
  );
}
