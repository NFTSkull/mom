import { GUIA_I_QUESTIONS, GUIA_I_SECTION_I_ID } from "../../data/nom035/guia-i";
import { GUIA_II_GROUPS } from "../../data/nom035/guia-ii-groups";
import {
  GUIA_II_DIRECT_SCORED_ITEMS,
  GUIA_II_MANIFEST_BY_NUMBER,
  GUIA_II_REVERSE_SCORED_ITEMS,
  NOM035_QUESTIONNAIRE_VERSION,
  NOM035_SCORING_VERSION,
} from "../../data/nom035/guia-ii-manifest";
import {
  GUIA_II_CATEGORY_THRESHOLDS,
  GUIA_II_DOMAIN_THRESHOLDS,
  GUIA_II_FINAL_THRESHOLDS,
} from "../../data/nom035/guia-ii-thresholds";
import { GUIA_III_GROUPS } from "../../data/nom035/guia-iii-groups";
import {
  GUIA_III_DIRECT_SCORED_ITEMS,
  GUIA_III_MANIFEST_BY_NUMBER,
  GUIA_III_REVERSE_SCORED_ITEMS,
  NOM035_GUIA_III_QUESTIONNAIRE_VERSION,
  NOM035_GUIA_III_SCORING_VERSION,
} from "../../data/nom035/guia-iii-manifest";
import {
  GUIA_III_CATEGORY_THRESHOLDS,
  GUIA_III_DOMAIN_THRESHOLDS,
  GUIA_III_FINAL_THRESHOLDS,
} from "../../data/nom035/guia-iii-thresholds";
import { assertValidGuiaIIAnswers, getSkippedQuestionNumbers } from "./validate-guia-ii";
import {
  assertValidGuiaIIIAnswers,
  getGuiaIIISkippedQuestionNumbers,
} from "./validate-guia-iii";
import type {
  EvaluationResponse,
  GuiaIIAnswers,
  GuiaIILikertAnswer,
  GuiaIIResult,
  GuiaIIThresholds,
  GuiaIIIAnswers,
  GuiaIIIResult,
  GuiaIResult,
  QuestionnaireType,
  RiskLevelNom035,
} from "../../types/nom035";

function countSectionYesAnswers(
  section: "II" | "III" | "IV",
  answerMap: Map<string, number>
): number {
  return GUIA_I_QUESTIONS.filter((question) => question.section === section).reduce((total, question) => {
    return total + (answerMap.get(question.id) === 1 ? 1 : 0);
  }, 0);
}

function withGuiaIMeta(result: Omit<GuiaIResult, "scoringVersion" | "questionnaireVersion" | "calculatedAt" | "validationWarnings">): GuiaIResult {
  return {
    ...result,
    scoringVersion: NOM035_SCORING_VERSION,
    questionnaireVersion: NOM035_QUESTIONNAIRE_VERSION,
    calculatedAt: new Date().toISOString(),
    validationWarnings: [],
  };
}

export function calculateGuiaIResult(answers: EvaluationResponse[]): GuiaIResult {
  const answerMap = new Map(answers.map((item) => [item.questionId, item.value]));
  const traumaticEvent = answerMap.get(GUIA_I_SECTION_I_ID) === 1;

  // Si Sección I = No, se ignoran respuestas residuales de II/III/IV.
  if (!traumaticEvent) {
    return withGuiaIMeta({
      questionnaireCode: "GUIA_I",
      traumaticEvent: false,
      sectionIIScore: 0,
      sectionIIIScore: 0,
      sectionIVScore: 0,
      requiresClinicalAttention: false,
      riskLabel: "sin_alerta",
      alerts: [],
    });
  }

  const applicable = GUIA_I_QUESTIONS.filter((q) => q.section !== "I");
  const missing = applicable.filter((q) => answerMap.get(q.id) === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Guía I incompleta: faltan respuestas aplicables (${missing.map((q) => q.id).join(", ")}).`
    );
  }

  const sectionIIScore = countSectionYesAnswers("II", answerMap);
  const sectionIIIScore = countSectionYesAnswers("III", answerMap);
  const sectionIVScore = countSectionYesAnswers("IV", answerMap);
  const alerts: string[] = [];

  if (sectionIIScore >= 1) {
    alerts.push("Sección II con al menos una respuesta afirmativa.");
  }
  if (sectionIIIScore >= 3) {
    alerts.push("Sección III con tres o más respuestas afirmativas.");
  }
  if (sectionIVScore >= 2) {
    alerts.push("Sección IV con dos o más respuestas afirmativas.");
  }

  const requiresClinicalAttention = alerts.length > 0;

  return withGuiaIMeta({
    questionnaireCode: "GUIA_I",
    traumaticEvent: true,
    sectionIIScore,
    sectionIIIScore,
    sectionIVScore,
    requiresClinicalAttention,
    riskLabel: requiresClinicalAttention
      ? "requiere_seguimiento_confidencial"
      : "sin_alerta",
    alerts,
  });
}

const DIRECT_SCORE_MAP: Record<GuiaIILikertAnswer, number> = {
  siempre: 4,
  casi_siempre: 3,
  algunas_veces: 2,
  casi_nunca: 1,
  nunca: 0,
};

const REVERSE_SCORE_MAP: Record<GuiaIILikertAnswer, number> = {
  siempre: 0,
  casi_siempre: 1,
  algunas_veces: 2,
  casi_nunca: 3,
  nunca: 4,
};

export function scoreGuiaIIAnswer(questionNumber: number, answer: GuiaIILikertAnswer): number {
  const item = GUIA_II_MANIFEST_BY_NUMBER.get(questionNumber);
  if (!item) {
    throw new Error(`El reactivo ${questionNumber} no pertenece a la Guía II.`);
  }
  if (item.scoring === "reverse" || GUIA_II_REVERSE_SCORED_ITEMS.has(questionNumber)) {
    return REVERSE_SCORE_MAP[answer];
  }
  if (item.scoring === "direct" || GUIA_II_DIRECT_SCORED_ITEMS.has(questionNumber)) {
    return DIRECT_SCORE_MAP[answer];
  }
  throw new Error(`El reactivo ${questionNumber} no tiene regla de puntuación.`);
}

/**
 * Política operativa de fronteras (ver docs/SCORING_BOUNDARY_POLICY.md):
 * nulo: score < bajoMin
 * bajo: bajoMin <= score < medioMin
 * medio: medioMin <= score < altoMin
 * alto: altoMin <= score < muyAltoMin
 * muy_alto: score >= muyAltoMin
 */
export function getRiskLevelFromThresholds(
  score: number,
  thresholds: GuiaIIThresholds
): RiskLevelNom035 {
  if (score >= thresholds.muyAltoMin) return "muy_alto";
  if (score >= thresholds.altoMin) return "alto";
  if (score >= thresholds.medioMin) return "medio";
  if (score >= thresholds.bajoMin) return "bajo";
  return "nulo";
}

export function calculateGuiaIIResult(answers: GuiaIIAnswers): GuiaIIResult {
  assertValidGuiaIIAnswers(answers);

  const skippedQuestions = getSkippedQuestionNumbers({
    gateClientes: answers.gateClientes,
    gateJefe: answers.gateJefe,
  });
  const skippedSet = new Set(skippedQuestions);
  const questionScoreMap = new Map<number, number>();
  const alerts: string[] = [];
  const validationWarnings: string[] = [];

  for (const [questionNumber, answer] of Object.entries(answers.responses)) {
    const n = Number(questionNumber);
    if (skippedSet.has(n)) continue;
    questionScoreMap.set(n, scoreGuiaIIAnswer(n, answer as GuiaIILikertAnswer));
  }

  for (const skippedQuestion of skippedQuestions) {
    questionScoreMap.set(skippedQuestion, 0);
  }

  let finalScore = 0;
  for (const [questionNumber, score] of questionScoreMap.entries()) {
    if (skippedSet.has(questionNumber)) continue;
    finalScore += score;
  }

  const dimensionScores: GuiaIIResult["dimensionScores"] = {};
  const domainScores: GuiaIIResult["domainScores"] = {};
  const categoryScores: GuiaIIResult["categoryScores"] = {};

  for (const category of GUIA_II_GROUPS) {
    let categoryScore = 0;

    for (const domain of category.domains) {
      let domainScore = 0;

      for (const dimension of domain.dimensions) {
        const dimensionScore = dimension.questions.reduce((acc, questionNumber) => {
          if (skippedSet.has(questionNumber)) return acc;
          return acc + (questionScoreMap.get(questionNumber) ?? 0);
        }, 0);

        dimensionScores[dimension.name] = { score: dimensionScore };
        domainScore += dimensionScore;
      }

      const domainThresholds = GUIA_II_DOMAIN_THRESHOLDS[domain.name];
      if (!domainThresholds) {
        throw new Error(`Umbral de dominio ausente: ${domain.name}`);
      }

      domainScores[domain.name] = {
        score: domainScore,
        riskLevel: getRiskLevelFromThresholds(domainScore, domainThresholds),
      };
      categoryScore += domainScore;
    }

    const categoryThresholds = GUIA_II_CATEGORY_THRESHOLDS[category.name];
    if (!categoryThresholds) {
      throw new Error(`Umbral de categoría ausente: ${category.name}`);
    }

    categoryScores[category.name] = {
      score: categoryScore,
      riskLevel: getRiskLevelFromThresholds(categoryScore, categoryThresholds),
    };
  }

  const finalRiskLevel = getRiskLevelFromThresholds(finalScore, GUIA_II_FINAL_THRESHOLDS);
  if (["medio", "alto", "muy_alto"].includes(finalRiskLevel)) {
    alerts.push("Se recomienda programa de intervención.");
  }

  if (["medio", "alto", "muy_alto"].includes(domainScores.Violencia.riskLevel)) {
    alerts.push("Revisar posibles condiciones de violencia laboral.");
  }

  if (["alto", "muy_alto"].includes(domainScores["Carga de trabajo"].riskLevel)) {
    alerts.push("Revisar distribución y ritmo de trabajo.");
  }

  if (["alto", "muy_alto"].includes(domainScores.Liderazgo.riskLevel)) {
    alerts.push("Revisar liderazgo, comunicación y apoyo del jefe inmediato.");
  }

  return {
    questionnaireCode: "GUIA_II",
    finalScore,
    finalRiskLevel,
    categoryScores,
    domainScores,
    dimensionScores,
    skippedQuestions,
    alerts,
    scoringVersion: NOM035_SCORING_VERSION,
    questionnaireVersion: NOM035_QUESTIONNAIRE_VERSION,
    calculatedAt: new Date().toISOString(),
    validationWarnings,
  };
}

export function scoreGuiaIIIAnswer(questionNumber: number, answer: GuiaIILikertAnswer): number {
  const item = GUIA_III_MANIFEST_BY_NUMBER.get(questionNumber);
  if (!item) {
    throw new Error(`El reactivo ${questionNumber} no pertenece a la Guía III.`);
  }
  if (item.scoring === "reverse" || GUIA_III_REVERSE_SCORED_ITEMS.has(questionNumber)) {
    return REVERSE_SCORE_MAP[answer];
  }
  if (item.scoring === "direct" || GUIA_III_DIRECT_SCORED_ITEMS.has(questionNumber)) {
    return DIRECT_SCORE_MAP[answer];
  }
  throw new Error(`El reactivo ${questionNumber} no tiene regla de puntuación.`);
}

export function calculateGuiaIIIResult(answers: GuiaIIIAnswers): GuiaIIIResult {
  assertValidGuiaIIIAnswers(answers);

  const skippedQuestions = getGuiaIIISkippedQuestionNumbers({
    gateClientes: answers.gateClientes,
    gateJefe: answers.gateJefe,
  });
  const skippedSet = new Set(skippedQuestions);
  const questionScoreMap = new Map<number, number>();
  const alerts: string[] = [];
  const validationWarnings: string[] = [];

  for (const [questionNumber, answer] of Object.entries(answers.responses)) {
    const n = Number(questionNumber);
    if (skippedSet.has(n)) continue;
    questionScoreMap.set(n, scoreGuiaIIIAnswer(n, answer as GuiaIILikertAnswer));
  }

  let finalScore = 0;
  for (const [questionNumber, score] of questionScoreMap.entries()) {
    if (skippedSet.has(questionNumber)) continue;
    finalScore += score;
  }

  const dimensionScores: GuiaIIIResult["dimensionScores"] = {};
  const domainScores: GuiaIIIResult["domainScores"] = {};
  const categoryScores: GuiaIIIResult["categoryScores"] = {};

  for (const category of GUIA_III_GROUPS) {
    let categoryScore = 0;

    for (const domain of category.domains) {
      let domainScore = 0;

      for (const dimension of domain.dimensions) {
        const dimensionScore = dimension.questions.reduce((acc, questionNumber) => {
          if (skippedSet.has(questionNumber)) return acc;
          return acc + (questionScoreMap.get(questionNumber) ?? 0);
        }, 0);

        dimensionScores[dimension.name] = { score: dimensionScore };
        domainScore += dimensionScore;
      }

      const domainThresholds = GUIA_III_DOMAIN_THRESHOLDS[domain.name];
      if (!domainThresholds) {
        throw new Error(`Umbral de dominio Guía III ausente: ${domain.name}`);
      }

      domainScores[domain.name] = {
        score: domainScore,
        riskLevel: getRiskLevelFromThresholds(domainScore, domainThresholds),
      };
      categoryScore += domainScore;
    }

    const categoryThresholds = GUIA_III_CATEGORY_THRESHOLDS[category.name];
    if (!categoryThresholds) {
      throw new Error(`Umbral de categoría Guía III ausente: ${category.name}`);
    }

    categoryScores[category.name] = {
      score: categoryScore,
      riskLevel: getRiskLevelFromThresholds(categoryScore, categoryThresholds),
    };
  }

  const finalRiskLevel = getRiskLevelFromThresholds(finalScore, GUIA_III_FINAL_THRESHOLDS);
  if (["medio", "alto", "muy_alto"].includes(finalRiskLevel)) {
    alerts.push("Se recomienda programa de intervención.");
  }
  if (domainScores.Violencia && ["medio", "alto", "muy_alto"].includes(domainScores.Violencia.riskLevel)) {
    alerts.push("Revisar posibles condiciones de violencia laboral.");
  }

  const answerCount = questionScoreMap.size;
  const applicableQuestionCount = 72 - skippedQuestions.length;

  return {
    questionnaireCode: "GUIA_III",
    finalScore,
    finalRiskLevel,
    categoryScores,
    domainScores,
    dimensionScores,
    skippedQuestions,
    applicableQuestionCount,
    answerCount,
    alerts,
    scoringVersion: NOM035_GUIA_III_SCORING_VERSION,
    questionnaireVersion: NOM035_GUIA_III_QUESTIONNAIRE_VERSION,
    calculatedAt: new Date().toISOString(),
    validationWarnings,
    sourceSha256: "8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76",
  };
}

export function calculateNom035Result(
  questionnaireType: QuestionnaireType,
  responses: EvaluationResponse[]
): GuiaIResult {
  if (questionnaireType !== "GUIA_I") {
    throw new Error("Este MVP local solo soporta cálculo oficial de GUIA_I.");
  }

  return calculateGuiaIResult(responses);
}

export function getScoringVersionLabel(
  result: { scoringVersion?: string } | null | undefined
): string {
  return result?.scoringVersion ?? "versión no registrada";
}

export {
  NOM035_SCORING_VERSION,
  NOM035_QUESTIONNAIRE_VERSION,
  NOM035_GUIA_III_SCORING_VERSION,
  NOM035_GUIA_III_QUESTIONNAIRE_VERSION,
};
