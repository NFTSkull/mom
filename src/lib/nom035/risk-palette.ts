/**
 * B4.26 — Paleta única de niveles de riesgo (web + Excel + PNG).
 */
import type { RiskLevelNom035 } from "@/types/nom035";

export const RISK_LEVEL_ORDER: RiskLevelNom035[] = [
  "nulo",
  "bajo",
  "medio",
  "alto",
  "muy_alto",
];

/** Hex para gráficas PNG / CSS web. */
export const RISK_CHART_HEX: Record<RiskLevelNom035, string> = {
  nulo: "#64748b",
  bajo: "#16a34a",
  medio: "#ca8a04",
  alto: "#ea580c",
  muy_alto: "#dc2626",
};

/** ARGB ExcelJS (rellenos de celda). */
export const RISK_EXCEL_ARGB: Record<RiskLevelNom035, string> = {
  nulo: "FFE2E8F0",
  bajo: "FFDCFCE7",
  medio: "FFFEF9C3",
  alto: "FFFED7AA",
  muy_alto: "FFFECACA",
};

/** Etiquetas cortas (ejes / KPIs). */
export const RISK_SHORT_LABEL: Record<RiskLevelNom035, string> = {
  nulo: "NULO",
  bajo: "BAJO",
  medio: "MEDIO",
  alto: "ALTO",
  muy_alto: "MUY ALTO",
};

/** Etiquetas legibles (tablas). */
export const RISK_DISPLAY_LABEL: Record<RiskLevelNom035, string> = {
  nulo: "Nulo",
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  muy_alto: "Muy alto",
};

export function normalizeRiskLevel(
  level: string | null | undefined
): RiskLevelNom035 | null {
  if (!level) return null;
  const raw = level.trim().toLowerCase();
  if (raw === "nulo" || raw === "nulo/despreciable") return "nulo";
  if (raw === "bajo") return "bajo";
  if (raw === "medio") return "medio";
  if (raw === "alto") return "alto";
  if (raw === "muy_alto" || raw === "muy alto") return "muy_alto";
  return null;
}

export function riskExcelArgb(level: string | null | undefined): string | null {
  const n = normalizeRiskLevel(level);
  return n ? RISK_EXCEL_ARGB[n] : null;
}

export function riskChartHex(level: string | null | undefined): string {
  const n = normalizeRiskLevel(level);
  return n ? RISK_CHART_HEX[n] : "#94a3b8";
}
