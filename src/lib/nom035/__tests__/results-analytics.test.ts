import { describe, expect, it } from "vitest";
import type { EvaluationRecord, RiskLevelNom035, Worker } from "@/types/nom035";
import {
  getAverageGuiaIIScore,
  getCriticalDomains,
  getDepartmentSummaries,
  getDominantRiskLevel,
  getRiskDistribution,
  getWorkerCriticalDomains,
} from "../results-analytics";

const workers: Worker[] = [
  {
    id: "w1",
    employeeNumber: "1",
    fullName: "Ana",
    email: "ana@x.test",
    department: "Operaciones",
    position: "Coord",
    status: "ACTIVE",
  },
  {
    id: "w2",
    employeeNumber: "2",
    fullName: "Luis",
    email: "luis@x.test",
    department: "Operaciones",
    position: "Aux",
    status: "ACTIVE",
  },
  {
    id: "w3",
    employeeNumber: "3",
    fullName: "Sofia",
    email: "sofia@x.test",
    department: "RH",
    position: "Generalista",
    status: "ACTIVE",
  },
];

function recordFactory(input: {
  id: string;
  workerId: string;
  finalRisk: "nulo" | "bajo" | "medio" | "alto" | "muy_alto";
  score: number;
  completedAt: string;
  guiaIRisk?: "sin_alerta" | "requiere_seguimiento_confidencial";
  domainLevels?: Partial<
    Record<
      | "Condiciones en el ambiente de trabajo"
      | "Carga de trabajo"
      | "Falta de control sobre el trabajo"
      | "Jornada de trabajo"
      | "Interferencia en la relacion trabajo-familia"
      | "Liderazgo"
      | "Relaciones en el trabajo"
      | "Violencia",
      "nulo" | "bajo" | "medio" | "alto" | "muy_alto"
    >
  >;
}): EvaluationRecord {
  const baseDomains: Record<string, { score: number; riskLevel: RiskLevelNom035 }> = {
    "Condiciones en el ambiente de trabajo": { score: 0, riskLevel: "nulo" },
    "Carga de trabajo": { score: 0, riskLevel: "nulo" },
    "Falta de control sobre el trabajo": { score: 0, riskLevel: "nulo" },
    "Jornada de trabajo": { score: 0, riskLevel: "nulo" },
    "Interferencia en la relacion trabajo-familia": { score: 0, riskLevel: "nulo" },
    Liderazgo: { score: 0, riskLevel: "nulo" },
    "Relaciones en el trabajo": { score: 0, riskLevel: "nulo" },
    Violencia: { score: 0, riskLevel: "nulo" },
  };

  for (const [key, value] of Object.entries(input.domainLevels ?? {})) {
    baseDomains[key as keyof typeof baseDomains] = { score: 10, riskLevel: value };
  }

  return {
    id: input.id,
    campaignId: "c1",
    workerId: input.workerId,
    token: `t-${input.workerId}`,
    questionnaireType: "GUIA_I",
    responses: [],
    submittedAtISO: input.completedAt,
    calculated: null,
    status: "completed",
    completedAt: input.completedAt,
    guiaIAnswers: [],
    guiaIIAnswers: null,
    guiaIResult: {
      questionnaireCode: "GUIA_I",
      traumaticEvent: true,
      sectionIIScore: 0,
      sectionIIIScore: 0,
      sectionIVScore: 0,
      requiresClinicalAttention: input.guiaIRisk === "requiere_seguimiento_confidencial",
      riskLabel: input.guiaIRisk ?? "sin_alerta",
      alerts: [],
    },
    guiaIIResult: {
      questionnaireCode: "GUIA_II",
      finalScore: input.score,
      finalRiskLevel: input.finalRisk,
      categoryScores: {},
      domainScores: baseDomains,
      dimensionScores: {},
      skippedQuestions: [],
      alerts: [],
    },
  };
}

const records: EvaluationRecord[] = [
  recordFactory({
    id: "r1",
    workerId: "w1",
    finalRisk: "alto",
    score: 80,
    completedAt: "2026-05-01T10:00:00.000Z",
    guiaIRisk: "requiere_seguimiento_confidencial",
    domainLevels: { "Carga de trabajo": "alto", Violencia: "medio" },
  }),
  recordFactory({
    id: "r2",
    workerId: "w2",
    finalRisk: "medio",
    score: 55,
    completedAt: "2026-05-02T10:00:00.000Z",
    guiaIRisk: "sin_alerta",
    domainLevels: { Liderazgo: "medio" },
  }),
  recordFactory({
    id: "r3",
    workerId: "w3",
    finalRisk: "alto",
    score: 30,
    completedAt: "2026-05-03T10:00:00.000Z",
    guiaIRisk: "sin_alerta",
    domainLevels: { "Relaciones en el trabajo": "medio" },
  }),
];

describe("results-analytics helpers", () => {
  it("getRiskDistribution cuenta niveles", () => {
    const dist = getRiskDistribution(records);
    expect(dist.alto).toBe(2);
    expect(dist.medio).toBe(1);
    expect(dist.bajo).toBe(0);
  });

  it("getDominantRiskLevel obtiene predominante", () => {
    expect(getDominantRiskLevel(records)).toBe("alto");
  });

  it("getAverageGuiaIIScore calcula promedio", () => {
    expect(getAverageGuiaIIScore(records)).toBe(55);
  });

  it("getWorkerCriticalDomains entrega maximo 3 dominios >= medio", () => {
    const list = getWorkerCriticalDomains(records[0]);
    expect(list).toContain("Carga de trabajo");
    expect(list).toContain("Violencia");
    expect(list.length).toBeLessThanOrEqual(3);
  });

  it("getCriticalDomains agrega dominios con recomendacion", () => {
    const domains = getCriticalDomains(records);
    expect(domains[0].workers).toBeGreaterThanOrEqual(1);
    expect(domains[0].recommendation.length).toBeGreaterThan(10);
  });

  it("getDepartmentSummaries agrega por departamento", () => {
    const rows = getDepartmentSummaries(records, workers);
    const ops = rows.find((row) => row.department === "Operaciones");
    expect(ops?.evaluatedWorkers).toBe(2);
    expect(ops?.averageGuiaIIScore).toBe(67.5);
    expect(ops?.guiaIFollowUpCases).toBe(1);
  });
});
