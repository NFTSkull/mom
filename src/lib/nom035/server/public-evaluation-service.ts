import "server-only";

import { GUIA_I_QUESTIONS, GUIA_I_SECTION_I_ID } from "@/data/nom035/guia-i";
import {
  NOM035_QUESTIONNAIRE_VERSION,
  NOM035_SCORING_VERSION,
} from "@/data/nom035/guia-ii-manifest";
import {
  calculateGuiaIIResult,
  calculateGuiaIResult,
} from "@/lib/nom035/scoring-engine";
import {
  getSkippedQuestionNumbers,
  validateGuiaIIAnswers,
} from "@/lib/nom035/validate-guia-ii";
import type {
  EvaluationResponse,
  GuiaIIAnswers,
  GuiaIIGateAnswer,
  GuiaIILikertAnswer,
} from "@/types/nom035";

/**
 * Servicio server-only: valida el instrumento y ejecuta el motor CERTIFICADO.
 * El cliente NUNCA es autoridad del cálculo. Los campos de puntaje/identidad que
 * pudiera enviar el navegador se ignoran explícitamente (se registran como warning).
 */

export class EvaluationValidationError extends Error {
  readonly code = "invalid_payload";
  readonly details: string[];
  constructor(details: string[]) {
    super(`Payload de evaluación inválido: ${details.join(" ")}`);
    this.name = "EvaluationValidationError";
    this.details = details;
  }
}

/** Campos que el cliente jamás puede imponer. */
export const CLIENT_AUTHORITATIVE_FIELDS = [
  "finalScore",
  "riskLevel",
  "finalRiskLevel",
  "categoryScores",
  "domainScores",
  "dimensionScores",
  "alerts",
  "scoringVersion",
  "workerId",
  "campaignId",
  "assignmentId",
] as const;

export interface RawEvaluationInput {
  guiaI?: { responses?: Record<string, unknown> } | null;
  guiaII?: {
    gateClientes?: unknown;
    gateJefe?: unknown;
    responses?: Record<string, unknown> | null;
  } | null;
  [key: string]: unknown;
}

export interface CanonicalAnswerRow {
  questionnaire_code: "GUIA_I" | "GUIA_II";
  question_id: string;
  answer_value: string;
}

export interface CanonicalResultPayload {
  guia_i_requires_clinical_attention: boolean;
  guia_i_risk_label: string;
  guia_ii_final_score: number | null;
  guia_ii_final_risk_level: string | null;
  guia_ii_category_scores: unknown;
  guia_ii_domain_scores: unknown;
  guia_ii_dimension_scores: unknown;
  alerts: string[];
  validation_warnings: string[];
}

export interface PreparedSubmission {
  answers: CanonicalAnswerRow[];
  result: CanonicalResultPayload;
  scoringVersion: string;
  questionnaireVersion: string;
  calculatedAt: string;
  validationWarnings: string[];
  // Expuestos para verificación server-side; NUNCA se devuelven al trabajador.
  serverFinalScore: number | null;
  serverFinalRiskLevel: string | null;
}

/** Detecta y elimina campos de autoridad del cliente; devuelve las advertencias. */
export function detectIgnoredClientFields(raw: RawEvaluationInput): string[] {
  const warnings: string[] = [];
  const scopes: Array<Record<string, unknown> | null | undefined> = [
    raw,
    raw?.guiaI as Record<string, unknown> | undefined,
    raw?.guiaII as Record<string, unknown> | undefined,
  ];
  for (const scope of scopes) {
    if (!scope || typeof scope !== "object") continue;
    for (const field of CLIENT_AUTHORITATIVE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(scope, field)) {
        warnings.push(`Campo ignorado enviado por cliente: ${field}.`);
      }
    }
  }
  return warnings;
}

function toBinary(value: unknown): 0 | 1 | null {
  if (value === 1 || value === "1" || value === true || value === "si") return 1;
  if (value === 0 || value === "0" || value === false || value === "no") return 0;
  return null;
}

function toGate(value: unknown): GuiaIIGateAnswer | null {
  if (value === "si" || value === true) return "si";
  if (value === "no" || value === false) return "no";
  return null;
}

/**
 * Valida el instrumento completo y produce el resultado CERTIFICADO + respuestas
 * canónicas listas para persistir. Lanza EvaluationValidationError si algo falla.
 */
export function prepareCanonicalSubmission(
  raw: RawEvaluationInput,
  options: { requireGuiaII: boolean }
): PreparedSubmission {
  const errors: string[] = [];
  const validationWarnings = detectIgnoredClientFields(raw);

  // ---- Guía I ----
  const guiaIResponsesRaw = raw?.guiaI?.responses ?? {};
  if (typeof guiaIResponsesRaw !== "object" || guiaIResponsesRaw === null) {
    throw new EvaluationValidationError(["Guía I: formato de respuestas inválido."]);
  }

  const sectionIValue = toBinary((guiaIResponsesRaw as Record<string, unknown>)[GUIA_I_SECTION_I_ID]);
  if (sectionIValue === null) {
    errors.push("Guía I: falta la respuesta de la sección I.");
  }

  const traumatic = sectionIValue === 1;
  const applicableGuiaI = traumatic
    ? GUIA_I_QUESTIONS
    : GUIA_I_QUESTIONS.filter((q) => q.section === "I");

  const guiaIResponses: EvaluationResponse[] = [];
  for (const question of applicableGuiaI) {
    const bin = toBinary((guiaIResponsesRaw as Record<string, unknown>)[question.id]);
    if (bin === null) {
      errors.push(`Guía I: falta o es inválida la respuesta ${question.id}.`);
      continue;
    }
    guiaIResponses.push({ questionId: question.id, value: bin });
  }

  // ---- Guía II ----
  let guiaIIAnswers: GuiaIIAnswers | null = null;
  const rawGuiaII = raw?.guiaII;
  if (options.requireGuiaII || rawGuiaII) {
    if (!rawGuiaII || typeof rawGuiaII !== "object") {
      errors.push("Guía II: sección requerida ausente.");
    } else {
      const gateClientes = toGate(rawGuiaII.gateClientes);
      const gateJefe = toGate(rawGuiaII.gateJefe);
      if (gateClientes === null) errors.push("Guía II: compuerta de clientes inválida.");
      if (gateJefe === null) errors.push("Guía II: compuerta de supervisión inválida.");

      const responsesRaw = (rawGuiaII.responses ?? {}) as Record<string, unknown>;
      const skipped = new Set(
        getSkippedQuestionNumbers({
          gateClientes: gateClientes ?? undefined,
          gateJefe: gateJefe ?? undefined,
        })
      );
      const responses: Partial<Record<number, GuiaIILikertAnswer>> = {};
      for (const [key, value] of Object.entries(responsesRaw)) {
        const n = Number(key);
        if (!Number.isInteger(n)) continue;
        // Limpieza de preguntas no aplicables: no se toman aunque el cliente las mande.
        if (skipped.has(n)) continue;
        responses[n] = value as GuiaIILikertAnswer;
      }

      if (gateClientes !== null && gateJefe !== null) {
        guiaIIAnswers = { gateClientes, gateJefe, responses };
        const validation = validateGuiaIIAnswers(guiaIIAnswers);
        if (!validation.valid) {
          errors.push(...validation.errors);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new EvaluationValidationError([...new Set(errors)]);
  }

  // ---- Motor certificado (solo servidor) ----
  const guiaIResult = calculateGuiaIResult(guiaIResponses);
  const guiaIIResult = guiaIIAnswers ? calculateGuiaIIResult(guiaIIAnswers) : null;

  // ---- Respuestas canónicas (skipped NO se insertan) ----
  const answers: CanonicalAnswerRow[] = [];
  for (const response of guiaIResponses) {
    answers.push({
      questionnaire_code: "GUIA_I",
      question_id: response.questionId,
      answer_value: response.value === 1 ? "si" : "no",
    });
  }
  if (guiaIIAnswers) {
    answers.push({
      questionnaire_code: "GUIA_II",
      question_id: "guia_ii_gate_clientes",
      answer_value: guiaIIAnswers.gateClientes,
    });
    answers.push({
      questionnaire_code: "GUIA_II",
      question_id: "guia_ii_gate_jefe",
      answer_value: guiaIIAnswers.gateJefe,
    });
    const skipped = new Set(guiaIIResult?.skippedQuestions ?? []);
    for (const [key, value] of Object.entries(guiaIIAnswers.responses)) {
      const n = Number(key);
      if (skipped.has(n) || value === undefined) continue;
      answers.push({
        questionnaire_code: "GUIA_II",
        question_id: `guia_ii_${n}`,
        answer_value: value,
      });
    }
  }

  const alerts = [...guiaIResult.alerts, ...(guiaIIResult?.alerts ?? [])];
  const combinedWarnings = [
    ...validationWarnings,
    ...(guiaIResult.validationWarnings ?? []),
    ...(guiaIIResult?.validationWarnings ?? []),
  ];

  const result: CanonicalResultPayload = {
    guia_i_requires_clinical_attention: guiaIResult.requiresClinicalAttention,
    guia_i_risk_label: guiaIResult.riskLabel,
    guia_ii_final_score: guiaIIResult?.finalScore ?? null,
    guia_ii_final_risk_level: guiaIIResult?.finalRiskLevel ?? null,
    guia_ii_category_scores: guiaIIResult?.categoryScores ?? {},
    guia_ii_domain_scores: guiaIIResult?.domainScores ?? {},
    guia_ii_dimension_scores: guiaIIResult?.dimensionScores ?? {},
    alerts,
    validation_warnings: combinedWarnings,
  };

  return {
    answers,
    result,
    scoringVersion: NOM035_SCORING_VERSION,
    questionnaireVersion: NOM035_QUESTIONNAIRE_VERSION,
    calculatedAt: new Date().toISOString(),
    validationWarnings: combinedWarnings,
    serverFinalScore: guiaIIResult?.finalScore ?? null,
    serverFinalRiskLevel: guiaIIResult?.finalRiskLevel ?? null,
  };
}
