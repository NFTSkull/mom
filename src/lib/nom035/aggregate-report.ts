/**
 * B4.26 — Dataset agregado único (web + Excel + PNG).
 * Solo agrega snapshots/scores ya persistidos; no recalcula scoring.
 */

import {
  GUIA_III_ACTION_BY_LEVEL,
  GUIA_III_CATEGORY_THRESHOLDS,
  GUIA_III_DOMAIN_THRESHOLDS,
} from "@/data/nom035/guia-iii-manifest";
import type { RiskLevelNom035 } from "@/types/nom035";
import {
  type NormalizedFullReport,
  type ReportAnswerRow,
  type ReportWorkerRow,
  riskLevelLabel,
} from "@/lib/nom035/report-data";
import {
  normalizeRiskLevel,
  RISK_DISPLAY_LABEL,
  RISK_LEVEL_ORDER,
  RISK_SHORT_LABEL,
} from "@/lib/nom035/risk-palette";

export const NOM035_REPORT_MODEL_LABEL = "GUÍA I Y III DE NOM-035";
export const NOM035_REPORT_MODEL_CODE = "GUIA_I_Y_III" as const;

export const GUIA_III_CATEGORY_ORDER = Object.keys(GUIA_III_CATEGORY_THRESHOLDS);
export const GUIA_III_DOMAIN_ORDER = Object.keys(GUIA_III_DOMAIN_THRESHOLDS);

const DOMAIN_CATEGORY_MAP: Record<string, string> = {
  "Condiciones en el ambiente de trabajo": "Ambiente de trabajo",
  "Carga de trabajo": "Factores propios de la actividad",
  "Falta de control sobre el trabajo": "Factores propios de la actividad",
  "Jornada de trabajo": "Organización del tiempo de trabajo",
  "Interferencia en la relación trabajo-familia":
    "Organización del tiempo de trabajo",
  Liderazgo: "Liderazgo y relaciones en el trabajo",
  "Relaciones en el trabajo": "Liderazgo y relaciones en el trabajo",
  Violencia: "Liderazgo y relaciones en el trabajo",
  "Reconocimiento del desempeño": "Entorno organizacional",
  "Insuficiente sentido de pertenencia e inestabilidad":
    "Entorno organizacional",
};

function domainCategory(domain: string): string {
  return DOMAIN_CATEGORY_MAP[domain] ?? "";
}

export type LevelCount = {
  level: RiskLevelNom035;
  label: string;
  shortLabel: string;
  count: number;
  percentage: number;
};

export type NamedLevelMatrix = {
  name: string;
  category?: string;
  levels: Record<RiskLevelNom035, { count: number; percentage: number }>;
  total: number;
};

export type TopIndicator = {
  name: string;
  count: number;
  percentage: number;
};

export type BinaryIndicator = {
  yes: number;
  no: number;
  percentageYes: number;
  denominator: number;
};

export type Nom035AggregateReport = {
  companyName: string;
  campaignName: string;
  campaignStatus: string;
  campaignStatusLabel: string;
  model: typeof NOM035_REPORT_MODEL_CODE;
  modelLabel: typeof NOM035_REPORT_MODEL_LABEL;
  generatedAt: string;
  scoringVersion: string | null;
  questionnaireVersion: string | null;
  population: {
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
  overallRiskDistribution: LevelCount[];
  predominantRisk: {
    level: RiskLevelNom035 | null;
    label: string;
    count: number;
    percentage: number;
    /** Nunca se inventa un % de riesgo agregado distinto a esta métrica descriptiva. */
    metricKind: "predominant_risk";
  };
  categories: NamedLevelMatrix[];
  domains: NamedLevelMatrix[];
  traumaticEvent: BinaryIndicator;
  clinicalAttention: BinaryIndicator;
  topDomainsHighRisk: TopIndicator[];
  topCategoriesMediumPlus: TopIndicator[];
  levelDefinitions: Record<RiskLevelNom035, string>;
  /** Auditoría: contribución de test siempre 0. */
  testContribution: {
    rows: number;
    chart: number;
    average: number;
    trauma: number;
  };
};

function emptyLevels(): Record<RiskLevelNom035, { count: number; percentage: number }> {
  return {
    nulo: { count: 0, percentage: 0 },
    bajo: { count: 0, percentage: 0 },
    medio: { count: 0, percentage: 0 },
    alto: { count: 0, percentage: 0 },
    muy_alto: { count: 0, percentage: 0 },
  };
}

function pct(count: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.round((count / denom) * 10000) / 100;
}

export function hasGuiaITraumaticEvent(answers: ReportAnswerRow[]): boolean {
  const a = answers.find((x) => x.questionId === "guia_i_1");
  if (!a) return false;
  const v = String(a.answerValue ?? a.answerText ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return v === "si" || v === "1" || v === "true" || v === "yes";
}

function campaignStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "closed" || s === "cerrada") return "CERRADA";
  if (s === "active" || s === "activa") return "ACTIVA";
  if (s === "draft") return "BORRADOR";
  return status.toUpperCase() || "—";
}

function buildLevelMatrix(
  names: string[],
  pickLevel: (worker: ReportWorkerRow, name: string) => RiskLevelNom035 | null,
  realResults: number,
  workers: ReportWorkerRow[],
  withCategory?: (name: string) => string
): NamedLevelMatrix[] {
  return names.map((name) => {
    const levels = emptyLevels();
    for (const w of workers) {
      const lvl = pickLevel(w, name);
      if (lvl) levels[lvl].count += 1;
    }
    let total = 0;
    for (const lvl of RISK_LEVEL_ORDER) {
      levels[lvl].percentage = pct(levels[lvl].count, realResults);
      total += levels[lvl].count;
    }
    return {
      name,
      category: withCategory?.(name),
      levels,
      total,
    };
  });
}

export function buildNom035AggregateReport(
  report: NormalizedFullReport,
  opts?: { companyName?: string | null }
): Nom035AggregateReport {
  const { counts, workers, riskDistribution } = report;
  const realResults = counts.realResults;

  const overallRiskDistribution: LevelCount[] = RISK_LEVEL_ORDER.map((level) => {
    const count = riskDistribution[level] ?? 0;
    return {
      level,
      label: RISK_DISPLAY_LABEL[level],
      shortLabel: RISK_SHORT_LABEL[level],
      count,
      percentage: pct(count, realResults),
    };
  });

  // Moda determinística: primer máximo en orden Nulo→Muy alto.
  let predominant: Nom035AggregateReport["predominantRisk"] = {
    level: null,
    label: "—",
    count: 0,
    percentage: 0,
    metricKind: "predominant_risk",
  };
  let maxCount = -1;
  for (const row of overallRiskDistribution) {
    if (row.count > maxCount) {
      maxCount = row.count;
      predominant = {
        level: row.level,
        label: row.label,
        count: row.count,
        percentage: row.percentage,
        metricKind: "predominant_risk",
      };
    }
  }

  const categories = buildLevelMatrix(
    GUIA_III_CATEGORY_ORDER,
    (w, name) => normalizeRiskLevel(w.categoryScores[name]?.riskLevel),
    realResults,
    workers
  );

  const domains = buildLevelMatrix(
    GUIA_III_DOMAIN_ORDER,
    (w, name) => normalizeRiskLevel(w.domainScores[name]?.riskLevel),
    realResults,
    workers,
    (name) => domainCategory(name)
  );

  const guiaIWorkers = workers.filter(
    (w) =>
      w.guiaIStatus === "submitted" ||
      w.answers.some((a) => {
        const c = a.questionnaireCode.toUpperCase();
        return c === "GUIA_I" || c === "I";
      })
  );
  const guiaIDenom = guiaIWorkers.length || counts.guiaICompleted || realResults;

  let atsYes = 0;
  for (const w of guiaIWorkers) {
    if (hasGuiaITraumaticEvent(w.answers)) atsYes += 1;
  }
  const atsNo = Math.max(0, guiaIDenom - atsYes);

  let clinicalYes = 0;
  for (const w of guiaIWorkers) {
    if (w.guiaIRequiresClinicalAttention === true) clinicalYes += 1;
  }
  const clinicalNo = Math.max(0, guiaIDenom - clinicalYes);

  const topDomainsHighRisk: TopIndicator[] = domains
    .map((d) => {
      const count = d.levels.alto.count + d.levels.muy_alto.count;
      return {
        name: d.name,
        count,
        percentage: pct(count, realResults),
      };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
    .slice(0, 5);

  const topCategoriesMediumPlus: TopIndicator[] = categories
    .map((c) => {
      const count =
        c.levels.medio.count + c.levels.alto.count + c.levels.muy_alto.count;
      return {
        name: c.name,
        count,
        percentage: pct(count, realResults),
      };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
    .slice(0, 5);

  const scoringVersion =
    workers.find((w) => w.scoringVersion)?.scoringVersion ?? null;
  const questionnaireVersion =
    workers.find((w) => w.questionnaireVersion)?.questionnaireVersion ?? null;

  return {
    companyName: (opts?.companyName ?? "").trim() || "—",
    campaignName: report.campaignName,
    campaignStatus: report.campaignStatus,
    campaignStatusLabel: campaignStatusLabel(report.campaignStatus),
    model: NOM035_REPORT_MODEL_CODE,
    modelLabel: NOM035_REPORT_MODEL_LABEL,
    generatedAt: report.generatedAt,
    scoringVersion,
    questionnaireVersion,
    population: {
      realWorkers: counts.realWorkers,
      realCompleted: counts.realCompleted,
      realPending: counts.realPending,
      realInProgress: counts.realInProgress,
      realResults: counts.realResults,
      testWorkers: counts.testWorkers,
      testResultsStored: counts.testResultsStored,
      testResultsIncluded: counts.testResultsIncluded,
      guiaICompleted: counts.guiaICompleted,
      guiaIIICompleted: counts.guiaIIICompleted,
      guiaIICompleted: counts.guiaIICompleted,
    },
    overallRiskDistribution,
    predominantRisk: predominant,
    categories,
    domains,
    traumaticEvent: {
      yes: atsYes,
      no: atsNo,
      percentageYes: pct(atsYes, guiaIDenom),
      denominator: guiaIDenom,
    },
    clinicalAttention: {
      yes: clinicalYes,
      no: clinicalNo,
      percentageYes: pct(clinicalYes, guiaIDenom),
      denominator: guiaIDenom,
    },
    topDomainsHighRisk,
    topCategoriesMediumPlus,
    levelDefinitions: { ...GUIA_III_ACTION_BY_LEVEL },
    testContribution: {
      rows: counts.testResultsIncluded,
      chart: counts.testResultsIncluded,
      average: counts.testResultsIncluded,
      trauma: 0,
    },
  };
}

export function assertAggregateMath(agg: Nom035AggregateReport): {
  ok: true;
} | { ok: false; reason: string } {
  const real = agg.population.realResults;
  const sumRisk = agg.overallRiskDistribution.reduce((a, b) => a + b.count, 0);
  if (sumRisk !== real) {
    return { ok: false, reason: `sum(risk)=${sumRisk} ≠ realResults=${real}` };
  }
  const pctSum = agg.overallRiskDistribution.reduce((a, b) => a + b.percentage, 0);
  if (Math.abs(pctSum - 100) > 0.2 && real > 0) {
    return { ok: false, reason: `sum(pct)=${pctSum}` };
  }
  for (const cat of agg.categories) {
    if (cat.total !== real) {
      return {
        ok: false,
        reason: `categoría ${cat.name} total=${cat.total} ≠ ${real}`,
      };
    }
  }
  for (const dom of agg.domains) {
    if (dom.total !== real) {
      return {
        ok: false,
        reason: `dominio ${dom.name} total=${dom.total} ≠ ${real}`,
      };
    }
  }
  if (
    agg.traumaticEvent.yes + agg.traumaticEvent.no !==
    agg.traumaticEvent.denominator
  ) {
    return { ok: false, reason: "ATS yes+no ≠ denominator" };
  }
  if (
    agg.clinicalAttention.yes + agg.clinicalAttention.no !==
    agg.clinicalAttention.denominator
  ) {
    return { ok: false, reason: "clínica yes+no ≠ denominator" };
  }
  if (agg.population.testResultsIncluded !== 0) {
    return { ok: false, reason: "testResultsIncluded ≠ 0" };
  }
  if (agg.testContribution.rows !== 0) {
    return { ok: false, reason: "TEST_ROWS ≠ 0" };
  }
  if (agg.model !== "GUIA_I_Y_III") {
    return { ok: false, reason: "modelo inválido" };
  }
  if (agg.predominantRisk.metricKind !== "predominant_risk") {
    return { ok: false, reason: "métrica agregada inventada" };
  }
  return { ok: true };
}

export function aggregateContainsGuiaIILabel(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  // Evitar falsos positivos con "guia iii".
  return /guia\s*ii(?!i)\b|guia\s*i\s*(y|\+)\s*ii(?!i)\b/.test(t);
}


export function formatRiskLevelForReport(level: string | null | undefined): string {
  const n = normalizeRiskLevel(level);
  if (n) return RISK_DISPLAY_LABEL[n];
  return riskLevelLabel(level);
}
