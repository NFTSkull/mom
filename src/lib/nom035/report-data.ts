/**
 * B4.24 — Datos normalizados para reportes NOM-035 (dashboard + Excel).
 */

import type { RiskLevelNom035 } from "@/types/nom035";
import { NOM035_REAL_CAMPAIGN_NAME } from "@/lib/nom035/avance-excel";
import { GUIA_III_MANIFEST } from "@/data/nom035/guia-iii-manifest";

const DOMAIN_TO_CATEGORY = new Map<string, string>();
for (const item of GUIA_III_MANIFEST) {
  if (!DOMAIN_TO_CATEGORY.has(item.domain)) {
    DOMAIN_TO_CATEGORY.set(item.domain, item.category);
  }
}

export const FULL_REPORT_FILENAME = "reporte-completo-nom035-2026.xlsx";
export const INDIVIDUAL_REPORT_FILENAME_PREFIX = "nom035-";
export const INDIVIDUAL_REPORT_FILENAME_SUFFIX = "-2026.xlsx";

export type ReportAnswerRow = {
  questionnaireCode: string;
  questionId: string;
  answerText: string | null;
  answerValue: string | number | null;
};

export type ScoreEntry = {
  score: number;
  riskLevel: RiskLevelNom035;
};

export type ReportWorkerRow = {
  resultId: string;
  username: string;
  nombre: string;
  puesto: string | null;
  departamento: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  guiaIStatus: string | null;
  guiaIIIStatus: string | null;
  finalScore: number | null;
  finalRiskLevel: string | null;
  categoryScores: Record<string, ScoreEntry>;
  domainScores: Record<string, ScoreEntry>;
  guiaIRequiresClinicalAttention: boolean | null;
  guiaIRiskLabel: string | null;
  scoringVersion: string | null;
  questionnaireVersion: string | null;
  answers: ReportAnswerRow[];
};

export type ReportCounts = {
  realWorkers: number;
  realCompleted: number;
  realPending: number;
  realInProgress: number;
  realResults: number;
  testWorkers: number;
  testResultsStored: number;
  testResultsIncluded: number;
  guiaICompleted: number;
  guiaIIICompleted: number;
  guiaIICompleted: number;
};

export type NormalizedFullReport = {
  generatedAt: string;
  campaignName: string;
  campaignStatus: string;
  counts: ReportCounts;
  riskDistribution: Record<RiskLevelNom035, number>;
  categoryAverages: Record<string, number>;
  domainAverages: Record<string, number>;
  workers: ReportWorkerRow[];
};

const RISK_LEVELS: RiskLevelNom035[] = [
  "nulo",
  "bajo",
  "medio",
  "alto",
  "muy_alto",
];

export function riskLevelLabel(level: string | null | undefined): string {
  if (!level) return "—";
  if (level === "nulo") return "Nulo/despreciable";
  if (level === "bajo") return "Bajo";
  if (level === "medio") return "Medio";
  if (level === "alto") return "Alto";
  if (level === "muy_alto") return "Muy alto";
  return level;
}

export function guideStatusLabel(status: string | null | undefined): string {
  if (!status) return "No";
  if (status === "submitted") return "Sí";
  return status;
}

export function formatReportDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}

function parseScoreMap(raw: unknown): Record<string, ScoreEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, ScoreEntry> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const obj = val as Record<string, unknown>;
    const score = Number(obj.score);
    const riskLevel = String(obj.riskLevel ?? "") as RiskLevelNom035;
    if (!Number.isFinite(score)) continue;
    out[key] = { score, riskLevel };
  }
  return out;
}

function parseAnswers(raw: unknown): ReportAnswerRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      questionnaireCode: String(r.questionnaireCode ?? ""),
      questionId: String(r.questionId ?? ""),
      answerText: (r.answerText as string | null) ?? null,
      answerValue: (r.answerValue as string | number | null) ?? null,
    };
  });
}

function parseNumberMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(val);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function parseRiskDistribution(raw: unknown): Record<RiskLevelNom035, number> {
  const base: Record<RiskLevelNom035, number> = {
    nulo: 0,
    bajo: 0,
    medio: 0,
    alto: 0,
    muy_alto: 0,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  for (const level of RISK_LEVELS) {
    const val = (raw as Record<string, unknown>)[level];
    const n = Number(val);
    if (Number.isFinite(n)) base[level] = n;
  }
  return base;
}

function parseWorker(raw: unknown): ReportWorkerRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const username = String(r.username ?? "");
  if (!username) return null;
  return {
    resultId: String(r.resultId ?? ""),
    username,
    nombre: String(r.nombre ?? ""),
    puesto: (r.puesto as string | null) ?? null,
    departamento: (r.departamento as string | null) ?? null,
    status: String(r.status ?? ""),
    startedAt: (r.startedAt as string | null) ?? null,
    completedAt: (r.completedAt as string | null) ?? null,
    guiaIStatus: (r.guiaIStatus as string | null) ?? null,
    guiaIIIStatus: (r.guiaIIIStatus as string | null) ?? null,
    finalScore: r.finalScore == null ? null : Number(r.finalScore),
    finalRiskLevel: (r.finalRiskLevel as string | null) ?? null,
    categoryScores: parseScoreMap(r.categoryScores),
    domainScores: parseScoreMap(r.domainScores),
    guiaIRequiresClinicalAttention:
      r.guiaIRequiresClinicalAttention == null
        ? null
        : Boolean(r.guiaIRequiresClinicalAttention),
    guiaIRiskLabel: (r.guiaIRiskLabel as string | null) ?? null,
    scoringVersion: (r.scoringVersion as string | null) ?? null,
    questionnaireVersion: (r.questionnaireVersion as string | null) ?? null,
    answers: parseAnswers(r.answers),
  };
}

export function normalizeFullReportPayload(
  payload: Record<string, unknown>
): NormalizedFullReport | null {
  if (payload.ok === false) return null;
  const campaign = (payload.campaign as Record<string, unknown>) ?? {};
  const countsRaw = (payload.counts as Record<string, unknown>) ?? {};
  const workersRaw = Array.isArray(payload.workers) ? payload.workers : [];
  const workers = workersRaw
    .map(parseWorker)
    .filter((w): w is ReportWorkerRow => w !== null)
    .sort((a, b) => (a.username < b.username ? -1 : a.username > b.username ? 1 : 0));

  return {
    generatedAt: String(payload.generatedAt ?? new Date().toISOString()),
    campaignName: String(campaign.nombre ?? NOM035_REAL_CAMPAIGN_NAME),
    campaignStatus: String(campaign.status ?? ""),
    counts: {
      realWorkers: Number(countsRaw.realWorkers ?? 0),
      realCompleted: Number(countsRaw.realCompleted ?? 0),
      realPending: Number(countsRaw.realPending ?? 0),
      realInProgress: Number(countsRaw.realInProgress ?? 0),
      realResults: Number(countsRaw.realResults ?? 0),
      testWorkers: Number(countsRaw.testWorkers ?? 0),
      testResultsStored: Number(countsRaw.testResultsStored ?? 0),
      testResultsIncluded: Number(countsRaw.testResultsIncluded ?? 0),
      guiaICompleted: Number(countsRaw.guiaICompleted ?? 0),
      guiaIIICompleted: Number(countsRaw.guiaIIICompleted ?? 0),
      guiaIICompleted: Number(countsRaw.guiaIICompleted ?? 0),
    },
    riskDistribution: parseRiskDistribution(payload.riskDistribution),
    categoryAverages: parseNumberMap(payload.categoryAverages),
    domainAverages: parseNumberMap(payload.domainAverages),
    workers,
  };
}

export function assertFullReportCounts(report: NormalizedFullReport): {
  ok: true;
} | { ok: false; reason: string } {
  const { counts, workers, riskDistribution } = report;
  if (workers.length !== counts.realCompleted) {
    return {
      ok: false,
      reason: `workers=${workers.length} ≠ realCompleted=${counts.realCompleted}`,
    };
  }
  if (workers.length !== counts.realResults) {
    return {
      ok: false,
      reason: `workers=${workers.length} ≠ realResults=${counts.realResults}`,
    };
  }
  if (counts.testResultsIncluded !== 0) {
    return { ok: false, reason: "testResultsIncluded debe ser 0" };
  }
  const riskSum = Object.values(riskDistribution).reduce((a, b) => a + b, 0);
  if (riskSum !== counts.realResults) {
    return {
      ok: false,
      reason: `sum(risk)=${riskSum} ≠ realResults=${counts.realResults}`,
    };
  }
  for (const w of workers) {
    if (w.status !== "completed") {
      return { ok: false, reason: `worker ${w.username} no completed` };
    }
  }
  return { ok: true };
}

export function splitAnswersByGuide(answers: ReportAnswerRow[]): {
  guiaI: ReportAnswerRow[];
  guiaIII: ReportAnswerRow[];
} {
  const guiaI: ReportAnswerRow[] = [];
  const guiaIII: ReportAnswerRow[] = [];
  for (const a of answers) {
    const code = a.questionnaireCode.toUpperCase();
    if (code === "GUIA_I" || code === "I") guiaI.push(a);
    else if (code === "GUIA_III" || code === "III") guiaIII.push(a);
  }
  return { guiaI, guiaIII };
}

export function individualReportFilename(username: string): string {
  return `${INDIVIDUAL_REPORT_FILENAME_PREFIX}${username}${INDIVIDUAL_REPORT_FILENAME_SUFFIX}`;
}

const FORBIDDEN_EXPORT_KEYS = [
  "password",
  "auth_user_id",
  "access_token",
  "refresh_token",
  "service_role",
  "password_hash",
];

export function assertReportPayloadHasNoSecrets(payload: unknown): boolean {
  const blob = JSON.stringify(payload).toLowerCase();
  return !FORBIDDEN_EXPORT_KEYS.some((k) => blob.includes(`"${k}"`));
}

export function aggregateCategoryRows(
  workers: ReportWorkerRow[]
): Array<{
  username: string;
  nombre: string;
  categoria: string;
  puntaje: number;
  nivel: string;
}> {
  const rows: Array<{
    username: string;
    nombre: string;
    categoria: string;
    puntaje: number;
    nivel: string;
  }> = [];
  for (const w of workers) {
    for (const [categoria, entry] of Object.entries(w.categoryScores)) {
      rows.push({
        username: w.username,
        nombre: w.nombre,
        categoria,
        puntaje: entry.score,
        nivel: riskLevelLabel(entry.riskLevel),
      });
    }
  }
  return rows;
}

export function aggregateDomainRows(
  workers: ReportWorkerRow[]
): Array<{
  username: string;
  nombre: string;
  categoria: string;
  dominio: string;
  puntaje: number;
  nivel: string;
}> {
  const rows: Array<{
    username: string;
    nombre: string;
    categoria: string;
    dominio: string;
    puntaje: number;
    nivel: string;
  }> = [];
  for (const w of workers) {
    for (const [dominio, entry] of Object.entries(w.domainScores)) {
      rows.push({
        username: w.username,
        nombre: w.nombre,
        categoria: DOMAIN_TO_CATEGORY.get(dominio) ?? "",
        dominio,
        puntaje: entry.score,
        nivel: riskLevelLabel(entry.riskLevel),
      });
    }
  }
  return rows;
}

export type ChartDataset = {
  labels: string[];
  values: number[];
};

export function buildChartDatasets(report: NormalizedFullReport): {
  riskDistribution: ChartDataset;
  categoryAverages: ChartDataset;
  domainAverages: ChartDataset;
  completionStatus: ChartDataset;
} {
  const { counts, riskDistribution, categoryAverages, domainAverages } = report;
  return {
    riskDistribution: {
      labels: RISK_LEVELS.map(riskLevelLabel),
      values: RISK_LEVELS.map((l) => riskDistribution[l]),
    },
    categoryAverages: {
      labels: Object.keys(categoryAverages),
      values: Object.values(categoryAverages),
    },
    domainAverages: {
      labels: Object.keys(domainAverages),
      values: Object.values(domainAverages),
    },
    completionStatus: {
      labels: ["Completados", "Pendientes", "En progreso"],
      values: [counts.realCompleted, counts.realPending, counts.realInProgress],
    },
  };
}
