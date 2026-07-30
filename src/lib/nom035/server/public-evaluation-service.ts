import "server-only";

import { createHash } from "node:crypto";
import { GUIA_I_QUESTIONS, GUIA_I_SECTION_I_ID } from "@/data/nom035/guia-i";
import {
  GUIA_II_MANIFEST,
  NOM035_QUESTIONNAIRE_VERSION,
  NOM035_SCORING_VERSION,
} from "@/data/nom035/guia-ii-manifest";
import {
  GUIA_III_MANIFEST,
  NOM035_I_III_QUESTIONNAIRE_VERSION,
  NOM035_I_III_SCORING_VERSION,
  NOM035_SOURCE_SHA256,
} from "@/data/nom035/guia-iii-manifest";
import {
  calculateGuiaIIResult,
  calculateGuiaIIIResult,
  calculateGuiaIResult,
} from "@/lib/nom035/scoring-engine";
import {
  getSkippedQuestionNumbers,
  validateGuiaIIAnswers,
} from "@/lib/nom035/validate-guia-ii";
import {
  assertValidGuiaIIIAnswers,
  getGuiaIIISkippedQuestionNumbers,
} from "@/lib/nom035/validate-guia-iii";
import type {
  EvaluationResponse,
  GuiaIIAnswers,
  GuiaIIGateAnswer,
  GuiaIILikertAnswer,
  GuiaIIIAnswers,
} from "@/types/nom035";

export class EvaluationValidationError extends Error {
  readonly code = "invalid_payload";
  readonly details: string[];
  constructor(details: string[]) {
    super(`Payload de evaluación inválido: ${details.join(" ")}`);
    this.name = "EvaluationValidationError";
    this.details = details;
  }
}

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

export type FrpInstrument = "GUIA_II" | "GUIA_III";

export interface RawEvaluationInput {
  guiaI?: { responses?: Record<string, unknown> } | null;
  guiaII?: {
    gateClientes?: unknown;
    gateJefe?: unknown;
    responses?: Record<string, unknown> | null;
  } | null;
  guiaIII?: {
    gateClientes?: unknown;
    gateJefe?: unknown;
    responses?: Record<string, unknown> | null;
  } | null;
  [key: string]: unknown;
}

export interface CanonicalAnswerRow {
  questionnaire_code: "GUIA_I" | "GUIA_II" | "GUIA_III";
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
  result_snapshot: Record<string, unknown>;
}

export interface PreparedSubmission {
  answers: CanonicalAnswerRow[];
  result: CanonicalResultPayload;
  scoringVersion: string;
  questionnaireVersion: string;
  calculatedAt: string;
  validationWarnings: string[];
  serverFinalScore: number | null;
  serverFinalRiskLevel: string | null;
}

export function detectIgnoredClientFields(raw: RawEvaluationInput): string[] {
  const warnings: string[] = [];
  const scopes: Array<Record<string, unknown> | null | undefined> = [
    raw,
    raw?.guiaI as Record<string, unknown> | undefined,
    raw?.guiaII as Record<string, unknown> | undefined,
    raw?.guiaIII as Record<string, unknown> | undefined,
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

export function resolveFrpFromQuestionnaireVersion(
  version: string | null | undefined
): FrpInstrument | null {
  if (version === NOM035_QUESTIONNAIRE_VERSION) return "GUIA_II";
  if (version === NOM035_I_III_QUESTIONNAIRE_VERSION) return "GUIA_III";
  return null;
}

function questionSetHash(ids: string[]): string {
  return createHash("sha256").update(ids.join("|")).digest("hex");
}

/**
 * Valida el instrumento y produce resultado CERTIFICADO.
 * El FRP (II o III) lo decide el servidor vía questionnaireVersion del assignment.
 */
export function prepareCanonicalSubmission(
  raw: RawEvaluationInput,
  options: {
    requireGuiaII?: boolean;
    frp?: FrpInstrument | null;
    questionnaireVersion?: string;
  }
): PreparedSubmission {
  const frp =
    options.frp ??
    (options.requireGuiaII === true ? "GUIA_II" : undefined) ??
    resolveFrpFromQuestionnaireVersion(options.questionnaireVersion) ??
    null;

  const errors: string[] = [];
  const validationWarnings = detectIgnoredClientFields(raw);

  if (!frp) {
    throw new EvaluationValidationError([
      "Instrumento FRP no resuelto: falta questionnaireVersion de assignment válida.",
    ]);
  }

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

  let guiaIIAnswers: GuiaIIAnswers | null = null;
  let guiaIIIAnswers: GuiaIIIAnswers | null = null;

  if (frp === "GUIA_II") {
    const rawGuiaII = raw?.guiaII;
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
        if (!Number.isInteger(n) || skipped.has(n)) continue;
        responses[n] = value as GuiaIILikertAnswer;
      }

      if (gateClientes !== null && gateJefe !== null) {
        guiaIIAnswers = { gateClientes, gateJefe, responses };
        const validation = validateGuiaIIAnswers(guiaIIAnswers);
        if (!validation.valid) errors.push(...validation.errors);
      }
    }
  }

  if (frp === "GUIA_III") {
    const rawGuiaIII = raw?.guiaIII ?? raw?.guiaII;
    if (!rawGuiaIII || typeof rawGuiaIII !== "object") {
      errors.push("Guía III: sección requerida ausente.");
    } else {
      const gateClientes = toGate(rawGuiaIII.gateClientes);
      const gateJefe = toGate(rawGuiaIII.gateJefe);
      if (gateClientes === null) errors.push("Guía III: compuerta de clientes inválida.");
      if (gateJefe === null) errors.push("Guía III: compuerta de jefatura inválida.");

      const responsesRaw = (rawGuiaIII.responses ?? {}) as Record<string, unknown>;
      const skipped = new Set(
        getGuiaIIISkippedQuestionNumbers({
          gateClientes: gateClientes ?? "no",
          gateJefe: gateJefe ?? "no",
        })
      );
      const responses: Record<number, GuiaIILikertAnswer> = {};
      for (const [key, value] of Object.entries(responsesRaw)) {
        const n = Number(key);
        if (!Number.isInteger(n) || skipped.has(n)) continue;
        responses[n] = value as GuiaIILikertAnswer;
      }

      if (gateClientes !== null && gateJefe !== null) {
        guiaIIIAnswers = { gateClientes, gateJefe, responses };
        try {
          assertValidGuiaIIIAnswers(guiaIIIAnswers);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Guía III inválida.");
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new EvaluationValidationError([...new Set(errors)]);
  }

  const guiaIResult = calculateGuiaIResult(guiaIResponses);
  const guiaIIResult = guiaIIAnswers ? calculateGuiaIIResult(guiaIIAnswers) : null;
  const guiaIIIResult = guiaIIIAnswers ? calculateGuiaIIIResult(guiaIIIAnswers) : null;
  const frpResult = guiaIIIResult ?? guiaIIResult;

  const answers: CanonicalAnswerRow[] = [];
  for (const response of guiaIResponses) {
    answers.push({
      questionnaire_code: "GUIA_I",
      question_id: response.questionId,
      answer_value: response.value === 1 ? "si" : "no",
    });
  }

  if (guiaIIAnswers && guiaIIResult) {
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
    const skipped = new Set(guiaIIResult.skippedQuestions);
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

  if (guiaIIIAnswers && guiaIIIResult) {
    answers.push({
      questionnaire_code: "GUIA_III",
      question_id: "guia_iii_gate_clientes",
      answer_value: guiaIIIAnswers.gateClientes,
    });
    answers.push({
      questionnaire_code: "GUIA_III",
      question_id: "guia_iii_gate_jefe",
      answer_value: guiaIIIAnswers.gateJefe,
    });
    const skipped = new Set(guiaIIIResult.skippedQuestions);
    for (const [key, value] of Object.entries(guiaIIIAnswers.responses)) {
      const n = Number(key);
      if (skipped.has(n) || value === undefined) continue;
      answers.push({
        questionnaire_code: "GUIA_III",
        question_id: `guia_iii_${n}`,
        answer_value: value,
      });
    }
  }

  const alerts = [...guiaIResult.alerts, ...(frpResult?.alerts ?? [])];
  const combinedWarnings = [
    ...validationWarnings,
    ...(guiaIResult.validationWarnings ?? []),
    ...(frpResult?.validationWarnings ?? []),
  ];

  const frpManifestIds =
    frp === "GUIA_III"
      ? GUIA_III_MANIFEST.map((i) => i.id)
      : GUIA_II_MANIFEST.map((i) => i.id);

  const result_snapshot: Record<string, unknown> = {
    guide_id: frp === "GUIA_III" ? "guia-referencia-iii" : "guia-referencia-ii",
    guide_type: frp,
    guide_version:
      frp === "GUIA_III"
        ? NOM035_I_III_QUESTIONNAIRE_VERSION
        : NOM035_QUESTIONNAIRE_VERSION,
    scoring_version:
      frp === "GUIA_III" ? NOM035_I_III_SCORING_VERSION : NOM035_SCORING_VERSION,
    source_sha256: NOM035_SOURCE_SHA256,
    question_set_hash: questionSetHash(frpManifestIds),
    algorithm_version: frp === "GUIA_III" ? "calculateGuiaIIIResult@v1" : "calculateGuiaIIResult@v1",
    answer_count: frpResult && "answerCount" in frpResult ? frpResult.answerCount : null,
    applicable_question_count:
      frpResult && "applicableQuestionCount" in frpResult
        ? frpResult.applicableQuestionCount
        : frp === "GUIA_II"
          ? 46 - (guiaIIResult?.skippedQuestions.length ?? 0)
          : null,
    final_score: frpResult?.finalScore ?? null,
    final_risk_level: frpResult?.finalRiskLevel ?? null,
    category_scores: frpResult?.categoryScores ?? {},
    domain_scores: frpResult?.domainScores ?? {},
    dimension_scores: frpResult?.dimensionScores ?? {},
    conditional_state: {
      gateClientes: guiaIIIAnswers?.gateClientes ?? guiaIIAnswers?.gateClientes ?? null,
      gateJefe: guiaIIIAnswers?.gateJefe ?? guiaIIAnswers?.gateJefe ?? null,
      skippedQuestions: frpResult?.skippedQuestions ?? [],
    },
    calculated_at: new Date().toISOString(),
  };

  const result: CanonicalResultPayload = {
    guia_i_requires_clinical_attention: guiaIResult.requiresClinicalAttention,
    guia_i_risk_label: guiaIResult.riskLabel,
    // Columnas legacy guia_ii_* almacenan el FRP activo (II o III) para agregados.
    guia_ii_final_score: frpResult?.finalScore ?? null,
    guia_ii_final_risk_level: frpResult?.finalRiskLevel ?? null,
    guia_ii_category_scores: frpResult?.categoryScores ?? {},
    guia_ii_domain_scores: frpResult?.domainScores ?? {},
    guia_ii_dimension_scores: frpResult?.dimensionScores ?? {},
    alerts,
    validation_warnings: combinedWarnings,
    result_snapshot,
  };

  return {
    answers,
    result,
    scoringVersion:
      frp === "GUIA_III" ? NOM035_I_III_SCORING_VERSION : NOM035_SCORING_VERSION,
    questionnaireVersion:
      frp === "GUIA_III"
        ? NOM035_I_III_QUESTIONNAIRE_VERSION
        : NOM035_QUESTIONNAIRE_VERSION,
    calculatedAt: new Date().toISOString(),
    validationWarnings: combinedWarnings,
    serverFinalScore: frpResult?.finalScore ?? null,
    serverFinalRiskLevel: frpResult?.finalRiskLevel ?? null,
  };
}

/** Recalcula desde answers canónicas y compara con snapshot (sin mutar). */
export function recalculateFrpSnapshotMatch(input: {
  frp: FrpInstrument;
  guiaIResponses: EvaluationResponse[];
  frpAnswers: GuiaIIAnswers | GuiaIIIAnswers;
  snapshot: Record<string, unknown>;
}): { match: boolean; expectedScore: number; snapshotScore: number | null } {
  const frpResult =
    input.frp === "GUIA_III"
      ? calculateGuiaIIIResult(input.frpAnswers as GuiaIIIAnswers)
      : calculateGuiaIIResult(input.frpAnswers as GuiaIIAnswers);
  const snapshotScore =
    typeof input.snapshot.final_score === "number" ? input.snapshot.final_score : null;
  return {
    match:
      snapshotScore === frpResult.finalScore &&
      input.snapshot.final_risk_level === frpResult.finalRiskLevel,
    expectedScore: frpResult.finalScore,
    snapshotScore,
  };
}
