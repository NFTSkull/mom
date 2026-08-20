/**
 * B4.22 — Avance operativo NOM-035 (sin respuestas/scores).
 */

export const NOM035_REAL_CAMPAIGN_NAME = "Evaluación NOM-035 2026";
export const AVANCE_EXCEL_FILENAME = "avance-nom035-2026.xlsx";
export const AVANCE_EXCEL_SHEET = "Avance NOM035";
export const AVANCE_EXPECTED_ROWS = 83;

export type AvanceAssignmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "revoked"
  | string;

export type AvanceSourceRow = {
  nombre: string;
  username: string;
  assignmentStatus: AvanceAssignmentStatus;
  /** Solo para tests de exclusión; no se exporta. */
  revoked?: boolean;
  synthetic?: boolean;
  legacyCampaign?: boolean;
};

export type AvanceExcelRow = {
  nombre: string;
  usuario: string;
  respondio: "Sí" | "No";
};

/** Solo COMPLETED cuenta como respondió. Draft/in_progress/pending = No. */
export function respondioFromAssignmentStatus(
  status: AvanceAssignmentStatus
): "Sí" | "No" {
  return status === "completed" ? "Sí" : "No";
}

/** Guía I sola (III pendiente) no es completed a nivel assignment. */
export function respondioFromGuideProgress(input: {
  assignmentStatus: AvanceAssignmentStatus;
  guiaIStatus?: string | null;
  guiaIIIStatus?: string | null;
}): "Sí" | "No" {
  if (input.assignmentStatus === "completed") return "Sí";
  return "No";
}

export function isRealAvanceUsername(username: string): boolean {
  return /^[0-9]{3}$/.test(username) && Number(username) >= 1 && Number(username) <= 83;
}

export function buildAvanceExcelRows(
  sources: AvanceSourceRow[]
): {
  rows: AvanceExcelRow[];
  si: number;
  no: number;
  total: number;
} {
  const filtered = sources.filter(
    (r) =>
      !r.synthetic &&
      !r.legacyCampaign &&
      r.assignmentStatus !== "revoked" &&
      !r.revoked &&
      isRealAvanceUsername(r.username)
  );

  const rows = filtered
    .map((r) => ({
      nombre: r.nombre,
      usuario: r.username, // string; conservar "001"
      respondio: respondioFromAssignmentStatus(r.assignmentStatus),
    }))
    .sort((a, b) => (a.usuario < b.usuario ? -1 : a.usuario > b.usuario ? 1 : 0));

  const si = rows.filter((r) => r.respondio === "Sí").length;
  const no = rows.filter((r) => r.respondio === "No").length;
  return { rows, si, no, total: rows.length };
}

export function assertAvanceCountsMatch(input: {
  total: number;
  si: number;
  no: number;
  dashboardCompleted: number;
  expectedTotal?: number;
}): { ok: true } | { ok: false; reason: string } {
  const expected = input.expectedTotal ?? AVANCE_EXPECTED_ROWS;
  if (input.total !== expected) {
    return { ok: false, reason: `total=${input.total} esperado ${expected}` };
  }
  if (input.si + input.no !== input.total) {
    return { ok: false, reason: "Sí+No ≠ total" };
  }
  if (input.si !== input.dashboardCompleted) {
    return {
      ok: false,
      reason: `Sí=${input.si} ≠ dashboardCompleted=${input.dashboardCompleted}`,
    };
  }
  if (input.no !== expected - input.dashboardCompleted) {
    return { ok: false, reason: "No ≠ 83 - completed" };
  }
  return { ok: true };
}

/** Columnas permitidas en el XLSX (nada más). */
export const AVANCE_ALLOWED_HEADERS = ["Nombre", "Usuario", "Respondió"] as const;

export function assertExportHasNoSensitiveKeys(
  payload: Record<string, unknown>
): boolean {
  const forbidden = [
    "password",
    "score",
    "risk",
    "answer",
    "answers",
    "category",
    "domain",
    "clinical",
    "email",
    "telefono",
    "worker_id",
    "assignment_id",
    "auth_user_id",
  ];
  const blob = JSON.stringify(payload).toLowerCase();
  return !forbidden.some((k) => blob.includes(`"${k}"`));
}
