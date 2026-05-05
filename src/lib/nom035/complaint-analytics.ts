import type { ConfidentialComplaint } from "@/types/nom035";

export function getComplaintTypeLabel(type: ConfidentialComplaint["complaintType"]): string {
  const labels: Record<ConfidentialComplaint["complaintType"], string> = {
    violencia_laboral: "Violencia laboral",
    entorno_organizacional: "Entorno organizacional",
    factores_riesgo_psicosocial: "Factores de riesgo psicosocial",
    otro: "Otro",
  };
  return labels[type];
}

export function getComplaintStatusLabel(status: ConfidentialComplaint["status"]): string {
  const labels: Record<ConfidentialComplaint["status"], string> = {
    recibida: "Recibida",
    en_revision: "En revision",
    resuelta: "Resuelta",
    cerrada: "Cerrada",
  };
  return labels[status];
}

export function getComplaintStats(complaints: ConfidentialComplaint[]) {
  return {
    total: complaints.length,
    recibidas: complaints.filter((item) => item.status === "recibida").length,
    enRevision: complaints.filter((item) => item.status === "en_revision").length,
    resueltas: complaints.filter((item) => item.status === "resuelta").length,
    cerradas: complaints.filter((item) => item.status === "cerrada").length,
  };
}

export function generateComplaintFolio(existingComplaints: ConfidentialComplaint[]): string {
  const year = new Date().getFullYear();
  const prefix = `NOM035-Q-${year}-`;
  const matching = existingComplaints
    .map((item) => item.folio)
    .filter((folio) => folio.startsWith(prefix))
    .map((folio) => Number(folio.replace(prefix, "")))
    .filter((value) => Number.isFinite(value));

  const next = (matching.length > 0 ? Math.max(...matching) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
