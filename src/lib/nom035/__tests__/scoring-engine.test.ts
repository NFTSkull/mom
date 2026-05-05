import { describe, expect, it } from "vitest";
import { GUIA_II_REVERSE_SCORED_ITEMS } from "../../../data/nom035/guia-ii";
import type { GuiaIIAnswers, GuiaIILikertAnswer } from "../../../types/nom035";
import {
  calculateGuiaIResult,
  calculateGuiaIIResult,
  getRiskLevelFromThresholds,
  scoreGuiaIIAnswer,
} from "../scoring-engine";

describe("calculateGuiaIResult", () => {
  it("caso 1: seccion I = NO => no requiere seguimiento", () => {
    const result = calculateGuiaIResult([
      { questionId: "guia_i_1", value: 0 },
    ]);

    expect(result.traumaticEvent).toBe(false);
    expect(result.requiresClinicalAttention).toBe(false);
    expect(result.riskLabel).toBe("sin_alerta");
  });

  it("caso 2: seccion I = SI + una SI en seccion II => requiere seguimiento", () => {
    const result = calculateGuiaIResult([
      { questionId: "guia_i_1", value: 1 },
      { questionId: "guia_i_2", value: 1 },
      { questionId: "guia_i_3", value: 0 },
    ]);

    expect(result.sectionIIScore).toBe(1);
    expect(result.requiresClinicalAttention).toBe(true);
    expect(result.riskLabel).toBe("requiere_seguimiento_confidencial");
  });

  it("caso 3: seccion I = SI + tres SI en seccion III => requiere seguimiento", () => {
    const result = calculateGuiaIResult([
      { questionId: "guia_i_1", value: 1 },
      { questionId: "guia_i_4", value: 1 },
      { questionId: "guia_i_5", value: 1 },
      { questionId: "guia_i_6", value: 1 },
    ]);

    expect(result.sectionIIIScore).toBe(3);
    expect(result.requiresClinicalAttention).toBe(true);
    expect(result.riskLabel).toBe("requiere_seguimiento_confidencial");
  });

  it("caso 4: seccion I = SI + dos SI en seccion IV => requiere seguimiento", () => {
    const result = calculateGuiaIResult([
      { questionId: "guia_i_1", value: 1 },
      { questionId: "guia_i_11", value: 1 },
      { questionId: "guia_i_12", value: 1 },
    ]);

    expect(result.sectionIVScore).toBe(2);
    expect(result.requiresClinicalAttention).toBe(true);
    expect(result.riskLabel).toBe("requiere_seguimiento_confidencial");
  });

  it("caso 5: seccion I = SI sin umbrales => no requiere seguimiento", () => {
    const result = calculateGuiaIResult([
      { questionId: "guia_i_1", value: 1 },
      { questionId: "guia_i_2", value: 0 },
      { questionId: "guia_i_3", value: 0 },
      { questionId: "guia_i_4", value: 1 },
      { questionId: "guia_i_5", value: 0 },
      { questionId: "guia_i_11", value: 1 },
      { questionId: "guia_i_12", value: 0 },
    ]);

    expect(result.sectionIIScore).toBe(0);
    expect(result.sectionIIIScore).toBe(1);
    expect(result.sectionIVScore).toBe(1);
    expect(result.requiresClinicalAttention).toBe(false);
    expect(result.riskLabel).toBe("sin_alerta");
  });
});

function buildGuiaIIResponses(
  resolver: (questionNumber: number) => GuiaIILikertAnswer
): Partial<Record<number, GuiaIILikertAnswer>> {
  const entries: Array<[number, GuiaIILikertAnswer]> = [];
  for (let questionNumber = 1; questionNumber <= 46; questionNumber += 1) {
    entries.push([questionNumber, resolver(questionNumber)]);
  }
  return Object.fromEntries(entries);
}

describe("scoreGuiaIIAnswer", () => {
  it("item 1 siempre = 4", () => {
    expect(scoreGuiaIIAnswer(1, "siempre")).toBe(4);
  });

  it("item 1 nunca = 0", () => {
    expect(scoreGuiaIIAnswer(1, "nunca")).toBe(0);
  });

  it("item 18 siempre = 0", () => {
    expect(scoreGuiaIIAnswer(18, "siempre")).toBe(0);
  });

  it("item 18 nunca = 4", () => {
    expect(scoreGuiaIIAnswer(18, "nunca")).toBe(4);
  });
});

describe("getRiskLevelFromThresholds", () => {
  const thresholds = { bajoMin: 20, medioMin: 45, altoMin: 70, muyAltoMin: 90 };

  it("score 19 => nulo", () => {
    expect(getRiskLevelFromThresholds(19, thresholds)).toBe("nulo");
  });

  it("score 20 => bajo", () => {
    expect(getRiskLevelFromThresholds(20, thresholds)).toBe("bajo");
  });

  it("score 45 => medio", () => {
    expect(getRiskLevelFromThresholds(45, thresholds)).toBe("medio");
  });

  it("score 70 => alto", () => {
    expect(getRiskLevelFromThresholds(70, thresholds)).toBe("alto");
  });

  it("score 90 => muy_alto", () => {
    expect(getRiskLevelFromThresholds(90, thresholds)).toBe("muy_alto");
  });
});

describe("calculateGuiaIIResult", () => {
  it("respuestas de bajo riesgo dan nivel nulo o bajo", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "si",
      gateJefe: "si",
      responses: buildGuiaIIResponses((questionNumber) =>
        GUIA_II_REVERSE_SCORED_ITEMS.has(questionNumber) ? "siempre" : "nunca"
      ),
    };

    const result = calculateGuiaIIResult(answers);
    expect(["nulo", "bajo"]).toContain(result.finalRiskLevel);
  });

  it("respuestas de alto riesgo dan nivel muy_alto", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "si",
      gateJefe: "si",
      responses: buildGuiaIIResponses((questionNumber) =>
        GUIA_II_REVERSE_SCORED_ITEMS.has(questionNumber) ? "nunca" : "siempre"
      ),
    };

    const result = calculateGuiaIIResult(answers);
    expect(result.finalRiskLevel).toBe("muy_alto");
  });

  it("si gate clientes es no, 41-43 se omiten y puntuan 0", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "no",
      gateJefe: "si",
      responses: buildGuiaIIResponses(() => "siempre"),
    };

    const result = calculateGuiaIIResult(answers);
    expect(result.skippedQuestions).toEqual(expect.arrayContaining([41, 42, 43]));
    expect(result.dimensionScores["Cargas psicologicas emocionales"].score).toBe(0);
  });

  it("si gate jefe es no, 44-46 se omiten y puntuan 0", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "si",
      gateJefe: "no",
      responses: buildGuiaIIResponses(() => "siempre"),
    };

    const result = calculateGuiaIIResult(answers);
    expect(result.skippedQuestions).toEqual(expect.arrayContaining([44, 45, 46]));
    expect(result.dimensionScores["Deficiente relacion con los colaboradores que supervisa"].score).toBe(
      0
    );
  });

  it("calcula domainScores y categoryScores", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "si",
      gateJefe: "si",
      responses: buildGuiaIIResponses(() => "algunas_veces"),
    };

    const result = calculateGuiaIIResult(answers);
    expect(result.domainScores["Carga de trabajo"]).toBeDefined();
    expect(result.categoryScores["Factores propios de la actividad"]).toBeDefined();
  });

  it("genera alerta cuando Violencia esta en medio/alto/muy_alto", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "no",
      gateJefe: "no",
      responses: buildGuiaIIResponses((questionNumber) => {
        if (questionNumber === 34 || questionNumber === 35 || questionNumber === 36) return "siempre";
        if (GUIA_II_REVERSE_SCORED_ITEMS.has(questionNumber)) return "siempre";
        return "nunca";
      }),
    };

    const result = calculateGuiaIIResult(answers);
    expect(result.domainScores.Violencia.riskLevel).toBe("medio");
    expect(result.alerts).toContain("Revisar posibles condiciones de violencia laboral.");
  });
});
