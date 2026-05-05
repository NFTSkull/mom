import { describe, expect, it } from "vitest";
import type { ActionPlanItem, EvaluationRecord } from "@/types/nom035";
import {
  generateSuggestedActionsFromResults,
  getActionPlanStats,
  isActionOverdue,
} from "../action-plan-generator";

function makeRecord(input: {
  workerId: string;
  guiaIRisk: "sin_alerta" | "requiere_seguimiento_confidencial";
  domainRisk?: "medio" | "alto" | "muy_alto";
}): EvaluationRecord {
  return {
    id: `rec-${input.workerId}`,
    campaignId: "camp-1",
    workerId: input.workerId,
    token: `tok-${input.workerId}`,
    questionnaireType: "GUIA_I",
    responses: [],
    submittedAtISO: "2026-05-05T10:00:00.000Z",
    calculated: null,
    status: "completed",
    completedAt: "2026-05-05T10:00:00.000Z",
    guiaIAnswers: [],
    guiaIIAnswers: null,
    guiaIResult: {
      questionnaireCode: "GUIA_I",
      traumaticEvent: true,
      sectionIIScore: 0,
      sectionIIIScore: 0,
      sectionIVScore: 0,
      requiresClinicalAttention: input.guiaIRisk === "requiere_seguimiento_confidencial",
      riskLabel: input.guiaIRisk,
      alerts: [],
    },
    guiaIIResult: {
      questionnaireCode: "GUIA_II",
      finalScore: 70,
      finalRiskLevel: "alto",
      categoryScores: {},
      domainScores: {
        "Condiciones en el ambiente de trabajo": { score: 0, riskLevel: "nulo" },
        "Carga de trabajo": { score: 12, riskLevel: input.domainRisk ?? "alto" },
        "Falta de control sobre el trabajo": { score: 0, riskLevel: "nulo" },
        "Jornada de trabajo": { score: 0, riskLevel: "nulo" },
        "Interferencia en la relacion trabajo-familia": { score: 0, riskLevel: "nulo" },
        Liderazgo: { score: 0, riskLevel: "nulo" },
        "Relaciones en el trabajo": { score: 0, riskLevel: "nulo" },
        Violencia: { score: 0, riskLevel: "nulo" },
      },
      dimensionScores: {},
      skippedQuestions: [],
      alerts: [],
    },
  };
}

describe("action-plan-generator", () => {
  it("isActionOverdue detecta vencidas", () => {
    const action: ActionPlanItem = {
      id: "a1",
      campaignId: "camp-1",
      area: "RH",
      riskFactor: "Carga de trabajo",
      riskLevel: "alto",
      actionLevel: "primer_nivel",
      actionType: "organizacional",
      description: "x",
      responsible: "RH",
      dueDate: "2020-01-01",
      status: "pendiente",
      followUpNotes: "",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    };

    expect(isActionOverdue(action, "2026-01-01T00:00:00.000Z")).toBe(true);
  });

  it("getActionPlanStats resume conteos", () => {
    const base: ActionPlanItem = {
      id: "a",
      campaignId: "camp-1",
      area: "RH",
      riskFactor: "Carga de trabajo",
      riskLevel: "alto",
      actionLevel: "primer_nivel",
      actionType: "organizacional",
      description: "x",
      responsible: "RH",
      dueDate: "2030-01-01",
      status: "pendiente",
      followUpNotes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const stats = getActionPlanStats([
      base,
      { ...base, id: "a2", status: "en_proceso" },
      { ...base, id: "a3", status: "completada" },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.pendientes).toBe(1);
    expect(stats.enProceso).toBe(1);
    expect(stats.completadas).toBe(1);
  });

  it("generateSuggestedActionsFromResults crea acciones y evita duplicados", () => {
    const records = [
      makeRecord({ workerId: "w1", guiaIRisk: "sin_alerta", domainRisk: "alto" }),
      makeRecord({
        workerId: "w2",
        guiaIRisk: "requiere_seguimiento_confidencial",
        domainRisk: "muy_alto",
      }),
    ];
    const suggested = generateSuggestedActionsFromResults({
      campaignId: "camp-1",
      records,
      existingActions: [],
    });

    expect(suggested.some((item) => item.riskFactor === "Carga de trabajo")).toBe(true);
    expect(
      suggested.some((item) => item.riskFactor === "Seguimiento confidencial Guia I")
    ).toBe(true);

    const deduped = generateSuggestedActionsFromResults({
      campaignId: "camp-1",
      records,
      existingActions: suggested.map((item, index) => ({
        ...item,
        id: `existing-${index}`,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })),
    });
    expect(deduped.length).toBe(0);
  });
});
