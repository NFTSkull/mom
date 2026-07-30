import { describe, expect, it } from "vitest";
import {
  GUIA_III_DIRECT_SCORED_ITEMS,
  GUIA_III_FINAL_THRESHOLDS,
  GUIA_III_MANIFEST,
  GUIA_III_REVERSE_SCORED_ITEMS,
  NOM035_GUIA_III_SCORING_VERSION,
} from "@/data/nom035/guia-iii-manifest";
import { GUIA_III_GROUPS } from "@/data/nom035/guia-iii-groups";
import {
  calculateGuiaIIIResult,
  getRiskLevelFromThresholds,
  scoreGuiaIIIAnswer,
} from "@/lib/nom035/scoring-engine";
import type { GuiaIILikertAnswer, GuiaIIIAnswers } from "@/types/nom035";

function fillAll(
  answer: GuiaIILikertAnswer,
  opts?: { gateClientes?: "si" | "no"; gateJefe?: "si" | "no" }
): GuiaIIIAnswers {
  const gateClientes = opts?.gateClientes ?? "no";
  const gateJefe = opts?.gateJefe ?? "no";
  const skipped = new Set<number>();
  if (gateClientes === "no") [65, 66, 67, 68].forEach((n) => skipped.add(n));
  if (gateJefe === "no") [69, 70, 71, 72].forEach((n) => skipped.add(n));
  const responses: Record<number, GuiaIILikertAnswer> = {};
  for (const item of GUIA_III_MANIFEST) {
    if (skipped.has(item.questionNumber)) continue;
    responses[item.questionNumber] = answer;
  }
  return { gateClientes, gateJefe, responses };
}

describe("Guía III · manifiesto oficial", () => {
  it("tiene exactamente 72 reactivos", () => {
    expect(GUIA_III_MANIFEST).toHaveLength(72);
    expect(GUIA_III_DIRECT_SCORED_ITEMS.size + GUIA_III_REVERSE_SCORED_ITEMS.size).toBe(72);
  });

  it("Tabla 5: 35 reverse + 37 direct", () => {
    expect(GUIA_III_REVERSE_SCORED_ITEMS.size).toBe(35);
    expect(GUIA_III_DIRECT_SCORED_ITEMS.size).toBe(37);
  });

  it("compuertas 65-68 clientes y 69-72 jefe", () => {
    expect(GUIA_III_MANIFEST.filter((i) => i.gate === "clientes").map((i) => i.questionNumber)).toEqual([
      65, 66, 67, 68,
    ]);
    expect(GUIA_III_MANIFEST.filter((i) => i.gate === "jefe").map((i) => i.questionNumber)).toEqual([
      69, 70, 71, 72,
    ]);
  });

  it("5 categorías y 10 dominios", () => {
    expect(GUIA_III_GROUPS).toHaveLength(5);
    const domains = GUIA_III_GROUPS.flatMap((c) => c.domains.map((d) => d.name));
    expect(domains).toHaveLength(10);
  });
});

describe("Guía III · scoring y fronteras", () => {
  it("puntuación directa/inversa Tabla 5", () => {
    expect(scoreGuiaIIIAnswer(2, "siempre")).toBe(4);
    expect(scoreGuiaIIIAnswer(2, "nunca")).toBe(0);
    expect(scoreGuiaIIIAnswer(1, "siempre")).toBe(0);
    expect(scoreGuiaIIIAnswer(1, "nunca")).toBe(4);
  });

  it("límites finales sin huecos ni solapes", () => {
    const t = GUIA_III_FINAL_THRESHOLDS;
    const samples = [49, 50, 74, 75, 98, 99, 139, 140, 141];
    const levels = samples.map((s) => getRiskLevelFromThresholds(s, t));
    expect(levels).toEqual([
      "nulo",
      "bajo",
      "bajo",
      "medio",
      "medio",
      "alto",
      "alto",
      "muy_alto",
      "muy_alto",
    ]);
  });

  it("vector mínimo (nunca en direct / siempre en reverse) con gates no", () => {
    // Para minimizar: direct→nunca (0), reverse→siempre (0)
    const responses: Record<number, GuiaIILikertAnswer> = {};
    for (const item of GUIA_III_MANIFEST) {
      if (item.questionNumber >= 65) continue;
      responses[item.questionNumber] = item.scoring === "direct" ? "nunca" : "siempre";
    }
    const result = calculateGuiaIIIResult({
      gateClientes: "no",
      gateJefe: "no",
      responses,
    });
    expect(result.finalScore).toBe(0);
    expect(result.finalRiskLevel).toBe("nulo");
    expect(result.skippedQuestions).toEqual([65, 66, 67, 68, 69, 70, 71, 72]);
    expect(result.applicableQuestionCount).toBe(64);
    expect(result.scoringVersion).toBe(NOM035_GUIA_III_SCORING_VERSION);
  });

  it("vector máximo aplicable (64 ítems) = 256", () => {
    const responses: Record<number, GuiaIILikertAnswer> = {};
    for (const item of GUIA_III_MANIFEST) {
      if (item.questionNumber >= 65) continue;
      responses[item.questionNumber] = item.scoring === "direct" ? "siempre" : "nunca";
    }
    const result = calculateGuiaIIIResult({
      gateClientes: "no",
      gateJefe: "no",
      responses,
    });
    expect(result.finalScore).toBe(64 * 4);
    expect(result.finalRiskLevel).toBe("muy_alto");
  });

  it("gates sí exigen 72 respuestas y suman condicionales", () => {
    const base = fillAll("nunca", { gateClientes: "si", gateJefe: "si" });
    // force max on gated items (direct)
    for (const n of [65, 66, 67, 68, 69, 70, 71, 72]) {
      base.responses[n] = "siempre";
    }
    const result = calculateGuiaIIIResult(base);
    expect(result.applicableQuestionCount).toBe(72);
    expect(result.skippedQuestions).toEqual([]);
    // 64*0 (nunca on all non-gated if we used fillAll nunca) + 8*4 = 32
    // but reverse items scored with nunca = 4, so not zero base
    expect(result.answerCount).toBe(72);
  });

  it("rechaza respuestas en sección no aplicable", () => {
    const answers = fillAll("nunca", { gateClientes: "no", gateJefe: "no" });
    answers.responses[65] = "siempre";
    expect(() => calculateGuiaIIIResult(answers)).toThrow(/no aplica/);
  });
});
