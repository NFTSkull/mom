/**
 * B4.29 — Fixture equivalente al dataset productivo (conteos agregados, sin PII).
 * Fuente: auditoría READ-ONLY `scripts/b429-audit-distributions.ts` (REAL_RESULTS=80).
 * Los puntajes son sintéticos dentro de la banda de corte de cada nivel.
 */
import {
  GUIA_III_CATEGORY_THRESHOLDS,
  GUIA_III_DOMAIN_THRESHOLDS,
} from "@/data/nom035/guia-iii-manifest";
import {
  normalizeFullReportPayload,
  type NormalizedFullReport,
  type ReportWorkerRow,
} from "@/lib/nom035/report-data";
import type { RiskLevelNom035 } from "@/types/nom035";

type Counts = [nulo: number, bajo: number, medio: number, alto: number, muyAlto: number];

const LEVELS: RiskLevelNom035[] = ["nulo", "bajo", "medio", "alto", "muy_alto"];

export const B429_REAL_RESULTS = 80;

export const B429_OVERALL: Counts = [21, 25, 14, 12, 8];

export const B429_CATEGORIES: Record<string, Counts> = {
  "Ambiente de trabajo": [48, 23, 7, 2, 0],
  "Factores propios de la actividad": [4, 20, 33, 20, 3],
  "Organización del tiempo de trabajo": [26, 13, 21, 18, 2],
  "Liderazgo y relaciones en el trabajo": [37, 20, 12, 9, 2],
  "Entorno organizacional": [40, 18, 10, 7, 5],
};

export const B429_DOMAINS: Record<string, Counts> = {
  "Condiciones en el ambiente de trabajo": [48, 23, 7, 2, 0],
  "Carga de trabajo": [14, 23, 23, 18, 2],
  "Falta de control sobre el trabajo": [28, 15, 17, 6, 14],
  "Jornada de trabajo": [14, 10, 22, 24, 10],
  "Interferencia en la relación trabajo-familia": [33, 23, 21, 2, 1],
  Liderazgo: [50, 6, 8, 5, 11],
  "Relaciones en el trabajo": [57, 12, 9, 1, 1],
  Violencia: [57, 9, 3, 5, 6],
  "Reconocimiento del desempeño": [32, 21, 15, 10, 2],
  "Insuficiente sentido de pertenencia e inestabilidad": [57, 14, 6, 1, 2],
};

/** Promedios brutos observados en Production (solo para demostrar que NO se usan). */
export const B429_RAW_DOMAIN_AVERAGES: Record<string, number> = {
  "Jornada de trabajo": 2.86,
  "Carga de trabajo": 21.74,
};

/** Suma objetivo de puntajes para reproducir el promedio bruto observado. */
const TARGET_SUMS: Record<string, number> = {
  "Jornada de trabajo": 229, // 229 / 80 = 2.8625
  "Carga de trabajo": 1739, // 1739 / 80 = 21.7375
};

type Thresholds = { bajoMin: number; medioMin: number; altoMin: number; muyAltoMin: number };

function band(t: Thresholds, level: RiskLevelNom035): [number, number] {
  if (level === "nulo") return [0, t.bajoMin - 1];
  if (level === "bajo") return [t.bajoMin, t.medioMin - 1];
  if (level === "medio") return [t.medioMin, t.altoMin - 1];
  if (level === "alto") return [t.altoMin, t.muyAltoMin - 1];
  return [t.muyAltoMin, t.muyAltoMin + 10];
}

function levelsFor(counts: Counts): RiskLevelNom035[] {
  const out: RiskLevelNom035[] = [];
  counts.forEach((n, i) => {
    for (let k = 0; k < n; k++) out.push(LEVELS[i]!);
  });
  return out;
}

function scoresFor(levels: RiskLevelNom035[], t: Thresholds, targetSum?: number): number[] {
  const scores = levels.map((l) => band(t, l)[0]);
  if (targetSum === undefined) return scores;
  let remaining = targetSum - scores.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scores.length && remaining > 0; i++) {
    const room = band(t, levels[i]!)[1] - scores[i]!;
    const add = Math.min(room, remaining);
    scores[i]! += add;
    remaining -= add;
  }
  if (remaining !== 0) throw new Error("fixture: targetSum fuera de banda");
  return scores;
}

export function buildB429ProductionLikeReport(): NormalizedFullReport {
  const n = B429_REAL_RESULTS;
  const workers: Array<Partial<ReportWorkerRow> & Record<string, unknown>> = [];
  const overall = levelsFor(B429_OVERALL);
  const catLevels = Object.fromEntries(
    Object.entries(B429_CATEGORIES).map(([k, c]) => [k, levelsFor(c)])
  );
  const domLevels = Object.fromEntries(
    Object.entries(B429_DOMAINS).map(([k, c]) => [k, levelsFor(c)])
  );
  const catScores = Object.fromEntries(
    Object.entries(catLevels).map(([k, l]) => [
      k,
      scoresFor(l, GUIA_III_CATEGORY_THRESHOLDS[k] as Thresholds),
    ])
  );
  const domScores = Object.fromEntries(
    Object.entries(domLevels).map(([k, l]) => [
      k,
      scoresFor(l, GUIA_III_DOMAIN_THRESHOLDS[k] as Thresholds, TARGET_SUMS[k]),
    ])
  );

  for (let i = 0; i < n; i++) {
    const categoryScores: Record<string, { score: number; riskLevel: RiskLevelNom035 }> = {};
    for (const k of Object.keys(B429_CATEGORIES)) {
      categoryScores[k] = { score: catScores[k]![i]!, riskLevel: catLevels[k]![i]! };
    }
    const domainScores: Record<string, { score: number; riskLevel: RiskLevelNom035 }> = {};
    for (const k of Object.keys(B429_DOMAINS)) {
      domainScores[k] = { score: domScores[k]![i]!, riskLevel: domLevels[k]![i]! };
    }
    workers.push({
      resultId: `r-${i + 1}`,
      username: String(i + 1).padStart(3, "0"),
      nombre: `Trabajador ${i + 1}`,
      status: "completed",
      guiaIStatus: "submitted",
      guiaIIIStatus: "submitted",
      finalScore: 50,
      finalRiskLevel: overall[i]!,
      categoryScores,
      domainScores,
      guiaIRequiresClinicalAttention: i === 0,
      scoringVersion: "nom035-stps-2018-guia-i-iii-v1",
      questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
      answers: [
        {
          questionnaireCode: "GUIA_I",
          questionId: "guia_i_1",
          answerText: null,
          answerValue: i < 2 ? "si" : "no",
        },
      ],
    });
  }

  const riskDistribution = Object.fromEntries(
    LEVELS.map((l, i) => [l, B429_OVERALL[i]!])
  );

  return normalizeFullReportPayload({
    ok: true,
    generatedAt: "2026-10-06T16:00:00.000Z",
    campaign: { nombre: "Evaluación NOM-035 2026", status: "closed" },
    counts: {
      realWorkers: 83,
      realCompleted: n,
      realPending: 3,
      realInProgress: 0,
      realResults: n,
      testWorkers: 1,
      testResultsStored: 1,
      testResultsIncluded: 0,
      guiaICompleted: n,
      guiaIIICompleted: n,
      guiaIICompleted: 0,
    },
    riskDistribution,
    categoryAverages: {},
    domainAverages: { ...B429_RAW_DOMAIN_AVERAGES },
    workers,
  })!;
}
