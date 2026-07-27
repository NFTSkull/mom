import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GUIA_II_GROUPS } from "../../../data/nom035/guia-ii-groups";
import {
  GUIA_II_CATEGORY_THRESHOLDS,
  GUIA_II_DIRECT_SCORED_ITEMS,
  GUIA_II_DOMAIN_THRESHOLDS,
  GUIA_II_FINAL_THRESHOLDS,
  GUIA_II_MANIFEST,
  GUIA_II_REVERSE_SCORED_ITEMS,
  NOM035_SCORING_VERSION,
} from "../../../data/nom035/guia-ii-manifest";
import {
  calculateGuiaIResult,
  calculateGuiaIIResult,
  getRiskLevelFromThresholds,
} from "../scoring-engine";
import { validateGuiaIIAnswers } from "../validate-guia-ii";
import type { GuiaIIAnswers } from "../../../types/nom035";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

describe("Guía II manifiesto canónico", () => {
  it("tiene exactamente 46 reactivos 1-46 sin duplicados", () => {
    const nums = GUIA_II_MANIFEST.map((i) => i.questionNumber).sort((a, b) => a - b);
    expect(nums).toEqual([...Array(46)].map((_, i) => i + 1));
    expect(new Set(GUIA_II_MANIFEST.map((i) => i.id)).size).toBe(46);
  });

  it("unión directa+invertida = 1-46 e intersección vacía", () => {
    const direct = [...GUIA_II_DIRECT_SCORED_ITEMS];
    const reverse = [...GUIA_II_REVERSE_SCORED_ITEMS].sort((a, b) => a - b);
    expect(direct.length + reverse.length).toBe(46);
    expect(direct.some((n) => GUIA_II_REVERSE_SCORED_ITEMS.has(n))).toBe(false);
    expect(reverse).toEqual([
      18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
    ]);
  });

  it("grupos Tabla 3 cubren 1-46 sin huérfanos ni duplicados", () => {
    const all: number[] = [];
    for (const cat of GUIA_II_GROUPS) {
      for (const domain of cat.domains) {
        for (const dimension of domain.dimensions) {
          all.push(...dimension.questions);
        }
      }
    }
    expect([...all].sort((a, b) => a - b)).toEqual([...Array(46)].map((_, i) => i + 1));
    expect(new Set(all).size).toBe(46);
  });
});

describe("validateGuiaIIAnswers", () => {
  it("marca incompleta", () => {
    const result = validateGuiaIIAnswers({
      gateClientes: "si",
      gateJefe: "si",
      responses: { 1: "siempre" },
    });
    expect(result.valid).toBe(false);
    expect(result.missingQuestionIds.length).toBeGreaterThan(0);
  });

  it("marca no aplicables presentes", () => {
    const responses: GuiaIIAnswers["responses"] = {};
    for (let n = 1; n <= 46; n += 1) responses[n] = "nunca";
    const result = validateGuiaIIAnswers({
      gateClientes: "no",
      gateJefe: "no",
      responses,
    });
    expect(result.valid).toBe(false);
    expect(result.unexpectedQuestionIds).toEqual(
      expect.arrayContaining(["guia_ii_41", "guia_ii_44"])
    );
  });
});

describe("fronteras categoría y dominio", () => {
  it("cubre fronteras finales documentadas", () => {
    expect(getRiskLevelFromThresholds(19, GUIA_II_FINAL_THRESHOLDS)).toBe("nulo");
    expect(getRiskLevelFromThresholds(20, GUIA_II_FINAL_THRESHOLDS)).toBe("bajo");
    expect(getRiskLevelFromThresholds(45, GUIA_II_FINAL_THRESHOLDS)).toBe("medio");
    expect(getRiskLevelFromThresholds(70, GUIA_II_FINAL_THRESHOLDS)).toBe("alto");
    expect(getRiskLevelFromThresholds(90, GUIA_II_FINAL_THRESHOLDS)).toBe("muy_alto");
  });

  it("cubre un punto antes/exacto/después en cada umbral de categoría", () => {
    for (const thr of Object.values(GUIA_II_CATEGORY_THRESHOLDS)) {
      expect(getRiskLevelFromThresholds(thr.bajoMin - 1, thr)).toBe("nulo");
      expect(getRiskLevelFromThresholds(thr.bajoMin, thr)).toBe("bajo");
      expect(getRiskLevelFromThresholds(thr.medioMin, thr)).toBe("medio");
      expect(getRiskLevelFromThresholds(thr.altoMin, thr)).toBe("alto");
      expect(getRiskLevelFromThresholds(thr.muyAltoMin, thr)).toBe("muy_alto");
    }
  });

  it("cubre fronteras de dominio", () => {
    for (const thr of Object.values(GUIA_II_DOMAIN_THRESHOLDS)) {
      expect(getRiskLevelFromThresholds(thr.bajoMin - 1, thr)).toBe("nulo");
      expect(getRiskLevelFromThresholds(thr.bajoMin, thr)).toBe("bajo");
      expect(getRiskLevelFromThresholds(thr.muyAltoMin, thr)).toBe("muy_alto");
    }
  });
});

describe("fixtures golden", () => {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));

  it("tiene al menos 10 fixtures", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of files) {
    it(`fixture ${file}`, () => {
      const raw = JSON.parse(readFileSync(path.join(FIXTURES_DIR, file), "utf8")) as {
        answers: unknown;
        expected?: Record<string, unknown>;
        expectError?: boolean;
      };

      if (file.startsWith("guia-i-")) {
        const result = calculateGuiaIResult(raw.answers as never);
        expect(result.scoringVersion).toBe(NOM035_SCORING_VERSION);
        expect(result.requiresClinicalAttention).toBe(raw.expected?.requiresClinicalAttention);
        expect(result.riskLabel).toBe(raw.expected?.riskLabel);
        expect(result.sectionIIScore).toBe(raw.expected?.sectionIIScore);
        expect(result.sectionIIIScore).toBe(raw.expected?.sectionIIIScore);
        expect(result.sectionIVScore).toBe(raw.expected?.sectionIVScore);
        return;
      }

      if (raw.expectError) {
        expect(() => calculateGuiaIIResult(raw.answers as GuiaIIAnswers)).toThrow();
        return;
      }

      const inputClone = structuredClone(raw.answers);
      const first = calculateGuiaIIResult(raw.answers as GuiaIIAnswers);
      const second = calculateGuiaIIResult(inputClone as GuiaIIAnswers);
      expect(JSON.stringify(raw.answers)).toBe(JSON.stringify(inputClone));
      expect(first.finalScore).toBe(raw.expected?.finalScore);
      expect(first.finalRiskLevel).toBe(raw.expected?.finalRiskLevel);
      expect(first.skippedQuestions).toEqual(raw.expected?.skippedQuestions);
      expect(first.categoryScores).toEqual(raw.expected?.categoryScores);
      expect(first.domainScores).toEqual(raw.expected?.domainScores);
      expect(first.dimensionScores).toEqual(raw.expected?.dimensionScores);
      expect(first.alerts).toEqual(raw.expected?.alerts);
      expect(first.scoringVersion).toBe(NOM035_SCORING_VERSION);
      expect(first.finalScore).toBe(second.finalScore);
      expect(Number.isInteger(first.finalScore)).toBe(true);
      expect(first.finalScore).toBeGreaterThanOrEqual(0);
      const applicableCount = 46 - first.skippedQuestions.length;
      expect(first.finalScore).toBeLessThanOrEqual(applicableCount * 4);
      const catSum = Object.values(first.categoryScores).reduce((a, b) => a + b.score, 0);
      const domSum = Object.values(first.domainScores).reduce((a, b) => a + b.score, 0);
      expect(catSum).toBe(first.finalScore);
      expect(domSum).toBe(first.finalScore);
    });
  }
});
