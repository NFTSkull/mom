import { GUIA_I_QUESTIONS, GUIA_I_SECTION_I_ID } from "../../data/nom035/guia-i";
import { GUIA_II_GROUPS } from "../../data/nom035/guia-ii-groups";
import {
  GUIA_II_DIRECT_SCORED_ITEMS,
  GUIA_II_QUESTIONS,
  GUIA_II_REVERSE_SCORED_ITEMS,
} from "../../data/nom035/guia-ii";
import {
  GUIA_II_CATEGORY_THRESHOLDS,
  GUIA_II_DOMAIN_THRESHOLDS,
  GUIA_II_FINAL_THRESHOLDS,
} from "../../data/nom035/guia-ii-thresholds";
import type {
  EvaluationResponse,
  GuiaIIAnswers,
  GuiaIILikertAnswer,
  GuiaIIResult,
  GuiaIIThresholds,
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

export function calculateGuiaIResult(answers: EvaluationResponse[]): GuiaIResult {
  const answerMap = new Map(answers.map((item) => [item.questionId, item.value]));
  const traumaticEvent = answerMap.get(GUIA_I_SECTION_I_ID) === 1;

  if (!traumaticEvent) {
    return {
      questionnaireCode: "GUIA_I",
      traumaticEvent: false,
      sectionIIScore: 0,
      sectionIIIScore: 0,
      sectionIVScore: 0,
      requiresClinicalAttention: false,
      riskLabel: "sin_alerta",
      alerts: [],
    };
  }

  const sectionIIScore = countSectionYesAnswers("II", answerMap);
  const sectionIIIScore = countSectionYesAnswers("III", answerMap);
  const sectionIVScore = countSectionYesAnswers("IV", answerMap);
  const alerts: string[] = [];

  if (sectionIIScore >= 1) {
    alerts.push("Seccion II con al menos una respuesta afirmativa.");
  }

  if (sectionIIIScore >= 3) {
    alerts.push("Seccion III con tres o mas respuestas afirmativas.");
  }

  if (sectionIVScore >= 2) {
    alerts.push("Seccion IV con dos o mas respuestas afirmativas.");
  }

  const requiresClinicalAttention = alerts.length > 0;

  return {
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
  };
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
  if (GUIA_II_REVERSE_SCORED_ITEMS.has(questionNumber)) {
    return REVERSE_SCORE_MAP[answer];
  }

  if (GUIA_II_DIRECT_SCORED_ITEMS.has(questionNumber)) {
    return DIRECT_SCORE_MAP[answer];
  }

  throw new Error(`El reactivo ${questionNumber} no pertenece a la Guia II.`);
}

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

function getApplicableQuestions(answers: GuiaIIAnswers): {
  skippedQuestions: number[];
  applicableQuestions: number[];
} {
  const skippedQuestions: number[] = [];
  if (answers.gateClientes === "no") skippedQuestions.push(41, 42, 43);
  if (answers.gateJefe === "no") skippedQuestions.push(44, 45, 46);

  const skippedSet = new Set(skippedQuestions);
  const applicableQuestions = GUIA_II_QUESTIONS.map((item) => item.questionNumber).filter(
    (questionNumber) => !skippedSet.has(questionNumber)
  );

  return {
    skippedQuestions: [...new Set(skippedQuestions)].sort((a, b) => a - b),
    applicableQuestions,
  };
}

export function calculateGuiaIIResult(answers: GuiaIIAnswers): GuiaIIResult {
  const { skippedQuestions, applicableQuestions } = getApplicableQuestions(answers);
  const skippedSet = new Set(skippedQuestions);
  const questionScoreMap = new Map<number, number>();
  const alerts: string[] = [];

  for (const questionNumber of applicableQuestions) {
    const answer = answers.responses[questionNumber];
    if (!answer) {
      alerts.push(`Falta respuesta para reactivo ${questionNumber}. Se asume puntaje 0 en calculo.`);
      questionScoreMap.set(questionNumber, 0);
      continue;
    }
    questionScoreMap.set(questionNumber, scoreGuiaIIAnswer(questionNumber, answer));
  }

  for (const skippedQuestion of skippedQuestions) {
    questionScoreMap.set(skippedQuestion, 0);
  }

  const finalScore = GUIA_II_QUESTIONS.reduce((acc, question) => {
    return acc + (questionScoreMap.get(question.questionNumber) ?? 0);
  }, 0);

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

      domainScores[domain.name] = {
        score: domainScore,
        riskLevel: getRiskLevelFromThresholds(domainScore, GUIA_II_DOMAIN_THRESHOLDS[domain.name]),
      };
      categoryScore += domainScore;
    }

    categoryScores[category.name] = {
      score: categoryScore,
      riskLevel: getRiskLevelFromThresholds(
        categoryScore,
        GUIA_II_CATEGORY_THRESHOLDS[category.name]
      ),
    };
  }

  const finalRiskLevel = getRiskLevelFromThresholds(finalScore, GUIA_II_FINAL_THRESHOLDS);
  if (["medio", "alto", "muy_alto"].includes(finalRiskLevel)) {
    alerts.push("Se recomienda programa de intervencion.");
  }

  if (["medio", "alto", "muy_alto"].includes(domainScores.Violencia.riskLevel)) {
    alerts.push("Revisar posibles condiciones de violencia laboral.");
  }

  if (["alto", "muy_alto"].includes(domainScores["Carga de trabajo"].riskLevel)) {
    alerts.push("Revisar distribucion y ritmo de trabajo.");
  }

  if (["alto", "muy_alto"].includes(domainScores.Liderazgo.riskLevel)) {
    alerts.push("Revisar liderazgo, comunicacion y apoyo del jefe inmediato.");
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
  };
}

export function calculateNom035Result(
  questionnaireType: QuestionnaireType,
  responses: EvaluationResponse[]
): GuiaIResult {
  if (questionnaireType !== "GUIA_I") {
    throw new Error("Este MVP local solo soporta calculo oficial de GUIA_I.");
  }

  return calculateGuiaIResult(responses);
}
