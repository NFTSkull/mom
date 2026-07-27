import { describe, expect, it } from "vitest";
import { GUIA_II_REVERSE_SCORED_ITEMS } from "../../../data/nom035/guia-ii";
import { NOM035_SCORING_VERSION } from "../../../data/nom035/guia-ii-manifest";
import type { GuiaIIAnswers, GuiaIILikertAnswer } from "../../../types/nom035";
import {
  calculateGuiaIResult,
  calculateGuiaIIResult,
  getRiskLevelFromThresholds,
  scoreGuiaIIAnswer,
} from "../scoring-engine";

function fullGuiaIAnswers(overrides: Record<string, 0 | 1>): Array<{ questionId: string; value: 0 | 1 }> {
  const base: Record<string, 0 | 1> = {
    guia_i_1: 1,
    guia_i_2: 0,
    guia_i_3: 0,
    guia_i_4: 0,
    guia_i_5: 0,
    guia_i_6: 0,
    guia_i_7: 0,
    guia_i_8: 0,
    guia_i_9: 0,
    guia_i_10: 0,
    guia_i_11: 0,
    guia_i_12: 0,
    guia_i_13: 0,
    guia_i_14: 0,
    guia_i_15: 0,
    ...overrides,
  };
  return Object.entries(base).map(([questionId, value]) => ({ questionId, value }));
}

describe("calculateGuiaIResult", () => {
  it("caso 1: seccion I = NO => no requiere seguimiento e ignora residuales", () => {
    const result = calculateGuiaIResult([
      { questionId: "guia_i_1", value: 0 },
      { questionId: "guia_i_2", value: 1 },
      { questionId: "guia_i_11", value: 1 },
    ]);

    expect(result.traumaticEvent).toBe(false);
    expect(result.sectionIIScore).toBe(0);
    expect(result.requiresClinicalAttention).toBe(false);
    expect(result.riskLabel).toBe("sin_alerta");
    expect(result.scoringVersion).toBe(NOM035_SCORING_VERSION);
  });

  it("caso 2: seccion I = SI + una SI en seccion II => requiere seguimiento", () => {
    const result = calculateGuiaIResult(fullGuiaIAnswers({ guia_i_2: 1 }));
    expect(result.sectionIIScore).toBe(1);
    expect(result.requiresClinicalAttention).toBe(true);
    expect(result.riskLabel).toBe("requiere_seguimiento_confidencial");
  });

  it("caso 3: seccion I = SI + tres SI en seccion III => requiere seguimiento", () => {
    const result = calculateGuiaIResult(
      fullGuiaIAnswers({ guia_i_4: 1, guia_i_5: 1, guia_i_6: 1 })
    );
    expect(result.sectionIIIScore).toBe(3);
    expect(result.requiresClinicalAttention).toBe(true);
  });

  it("caso 4: seccion I = SI + dos SI en seccion IV => requiere seguimiento", () => {
    const result = calculateGuiaIResult(fullGuiaIAnswers({ guia_i_11: 1, guia_i_12: 1 }));
    expect(result.sectionIVScore).toBe(2);
    expect(result.requiresClinicalAttention).toBe(true);
  });

  it("caso 5: seccion I = SI sin umbrales => no requiere seguimiento", () => {
    const result = calculateGuiaIResult(
      fullGuiaIAnswers({ guia_i_4: 1, guia_i_11: 1 })
    );
    expect(result.sectionIIScore).toBe(0);
    expect(result.sectionIIIScore).toBe(1);
    expect(result.sectionIVScore).toBe(1);
    expect(result.requiresClinicalAttention).toBe(false);
  });

  it("Sección I = Sí incompleta lanza error", () => {
    expect(() =>
      calculateGuiaIResult([
        { questionId: "guia_i_1", value: 1 },
        { questionId: "guia_i_2", value: 0 },
      ])
    ).toThrow(/incompleta/i);
  });
});

function buildGuiaIIResponses(
  resolver: (questionNumber: number) => GuiaIILikertAnswer,
  skip: number[] = []
): Partial<Record<number, GuiaIILikertAnswer>> {
  const skipSet = new Set(skip);
  const entries: Array<[number, GuiaIILikertAnswer]> = [];
  for (let questionNumber = 1; questionNumber <= 46; questionNumber += 1) {
    if (skipSet.has(questionNumber)) continue;
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

describe("getRiskLevelFromThresholds fronteras", () => {
  const thresholds = { bajoMin: 20, medioMin: 45, altoMin: 70, muyAltoMin: 90 };

  it.each([
    [19, "nulo"],
    [20, "bajo"],
    [21, "bajo"],
    [44, "bajo"],
    [45, "medio"],
    [46, "medio"],
    [69, "medio"],
    [70, "alto"],
    [71, "alto"],
    [89, "alto"],
    [90, "muy_alto"],
    [91, "muy_alto"],
  ] as const)("score %i => %s", (score, expected) => {
    expect(getRiskLevelFromThresholds(score, thresholds)).toBe(expected);
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
    expect(result.scoringVersion).toBe(NOM035_SCORING_VERSION);
  });

  it("respuestas de alto riesgo dan nivel muy_alto", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "si",
      gateJefe: "si",
      responses: buildGuiaIIResponses((questionNumber) =>
        GUIA_II_REVERSE_SCORED_ITEMS.has(questionNumber) ? "nunca" : "siempre"
      ),
    };
    expect(calculateGuiaIIResult(answers).finalRiskLevel).toBe("muy_alto");
  });

  it("si gate clientes es no, 41-43 se omiten y puntuan 0", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "no",
      gateJefe: "si",
      responses: buildGuiaIIResponses(() => "siempre", [41, 42, 43]),
    };
    const result = calculateGuiaIIResult(answers);
    expect(result.skippedQuestions).toEqual(expect.arrayContaining([41, 42, 43]));
    expect(result.dimensionScores["Cargas psicológicas emocionales"].score).toBe(0);
  });

  it("si gate jefe es no, 44-46 se omiten y puntuan 0", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "si",
      gateJefe: "no",
      responses: buildGuiaIIResponses(() => "siempre", [44, 45, 46]),
    };
    const result = calculateGuiaIIResult(answers);
    expect(result.skippedQuestions).toEqual(expect.arrayContaining([44, 45, 46]));
    expect(
      result.dimensionScores["Deficiente relación con los colaboradores que supervisa"].score
    ).toBe(0);
  });

  it("rechaza respuestas incompletas", () => {
    expect(() =>
      calculateGuiaIIResult({
        gateClientes: "si",
        gateJefe: "si",
        responses: { 1: "siempre" },
      })
    ).toThrow(/inválidas|invalidas/i);
  });

  it("rechaza respuestas a reactivos no aplicables", () => {
    expect(() =>
      calculateGuiaIIResult({
        gateClientes: "no",
        gateJefe: "no",
        responses: buildGuiaIIResponses(() => "nunca"),
      })
    ).toThrow(/no aplica/i);
  });

  it("genera alerta cuando Violencia esta en medio/alto/muy_alto", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "no",
      gateJefe: "no",
      responses: buildGuiaIIResponses((questionNumber) => {
        if (questionNumber === 34 || questionNumber === 35 || questionNumber === 36) return "siempre";
        if (GUIA_II_REVERSE_SCORED_ITEMS.has(questionNumber)) return "siempre";
        return "nunca";
      }, [41, 42, 43, 44, 45, 46]),
    };
    const result = calculateGuiaIIResult(answers);
    expect(result.domainScores.Violencia.riskLevel).toBe("medio");
    expect(result.alerts).toContain("Revisar posibles condiciones de violencia laboral.");
  });

  it("categorías y dominios suman el puntaje final", () => {
    const answers: GuiaIIAnswers = {
      gateClientes: "si",
      gateJefe: "si",
      responses: buildGuiaIIResponses(() => "algunas_veces"),
    };
    const result = calculateGuiaIIResult(answers);
    const catSum = Object.values(result.categoryScores).reduce((a, b) => a + b.score, 0);
    const domSum = Object.values(result.domainScores).reduce((a, b) => a + b.score, 0);
    expect(catSum).toBe(result.finalScore);
    expect(domSum).toBe(result.finalScore);
  });
});
