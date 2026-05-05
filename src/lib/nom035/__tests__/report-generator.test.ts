import { describe, expect, it } from "vitest";
import {
  generateExecutiveConclusion,
  generateGeneralRecommendations,
  generateInterventionPlan,
} from "../report-generator";

describe("report-generator helpers", () => {
  it("conclusion para cero evaluaciones", () => {
    const result = generateExecutiveConclusion({
      completedCount: 0,
      dominantRiskLevel: null,
      guiaIFollowUpCases: 0,
    });
    expect(result[0]).toContain("Aun no se cuenta con informacion suficiente");
  });

  it("conclusion para riesgo alto con seguimiento guia I", () => {
    const result = generateExecutiveConclusion({
      completedCount: 10,
      dominantRiskLevel: "alto",
      guiaIFollowUpCases: 2,
    });
    expect(result.join(" ")).toContain("atencion prioritaria");
    expect(result.join(" ")).toContain("seguimiento confidencial");
  });

  it("recomendaciones generales usa dominios criticos", () => {
    const recs = generateGeneralRecommendations([
      { domain: "Carga de trabajo", recommendation: "Revisar distribucion de tareas." },
      { domain: "Liderazgo", recommendation: "Fortalecer comunicacion." },
    ]);
    expect(recs).toEqual(["Revisar distribucion de tareas.", "Fortalecer comunicacion."]);
  });

  it("plan de intervencion genera tres niveles", () => {
    const plan = generateInterventionPlan();
    expect(plan).toHaveLength(3);
    expect(plan[0].focus).toBe("Organizacional");
    expect(plan[2].focus).toBe("Individual confidencial");
  });
});
