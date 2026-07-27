import {
  GUIA_II_LIKERT_VALUES,
  GUIA_II_MANIFEST,
  GUIA_II_MANIFEST_BY_NUMBER,
} from "../../data/nom035/guia-ii-manifest";
import type { GuiaIIAnswers, GuiaIIGateAnswer, GuiaIILikertAnswer } from "../../types/nom035";

export interface GuiaIIValidationResult {
  valid: boolean;
  missingQuestionIds: string[];
  unexpectedQuestionIds: string[];
  skippedQuestionIds: string[];
  duplicateQuestionIds: string[];
  errors: string[];
}

const LIKERT_SET = new Set<string>(GUIA_II_LIKERT_VALUES);

function isGate(value: GuiaIIGateAnswer | undefined): value is GuiaIIGateAnswer {
  return value === "si" || value === "no";
}

export function getSkippedQuestionNumbers(gates: {
  gateClientes?: GuiaIIGateAnswer;
  gateJefe?: GuiaIIGateAnswer;
}): number[] {
  const skipped: number[] = [];
  if (gates.gateClientes === "no") skipped.push(41, 42, 43);
  if (gates.gateJefe === "no") skipped.push(44, 45, 46);
  return skipped;
}

export function validateGuiaIIAnswers(answers: GuiaIIAnswers): GuiaIIValidationResult {
  const errors: string[] = [];
  const missingQuestionIds: string[] = [];
  const unexpectedQuestionIds: string[] = [];
  const duplicateQuestionIds: string[] = [];

  if (!isGate(answers.gateClientes)) {
    errors.push("Falta la compuerta de atención a clientes o usuarios.");
  }
  if (!isGate(answers.gateJefe)) {
    errors.push("Falta la compuerta de supervisión de personal.");
  }

  const skipped = getSkippedQuestionNumbers({
    gateClientes: answers.gateClientes,
    gateJefe: answers.gateJefe,
  });
  const skippedSet = new Set(skipped);
  const skippedQuestionIds = skipped.map((n) => `guia_ii_${n}`);

  const responseEntries = Object.entries(answers.responses ?? {});
  const seen = new Set<number>();

  for (const [rawKey, value] of responseEntries) {
    const questionNumber = Number(rawKey);
    if (!Number.isInteger(questionNumber) || !GUIA_II_MANIFEST_BY_NUMBER.has(questionNumber)) {
      unexpectedQuestionIds.push(`guia_ii_${rawKey}`);
      errors.push(`Reactivo desconocido: ${rawKey}.`);
      continue;
    }

    if (seen.has(questionNumber)) {
      duplicateQuestionIds.push(`guia_ii_${questionNumber}`);
      errors.push(`Respuesta duplicada para reactivo ${questionNumber}.`);
    }
    seen.add(questionNumber);

    if (skippedSet.has(questionNumber)) {
      unexpectedQuestionIds.push(`guia_ii_${questionNumber}`);
      errors.push(
        `Existe respuesta al reactivo ${questionNumber} que no aplica según la compuerta.`
      );
      continue;
    }

    if (!LIKERT_SET.has(String(value))) {
      errors.push(`Opción inválida para reactivo ${questionNumber}.`);
    }
  }

  for (const item of GUIA_II_MANIFEST) {
    if (skippedSet.has(item.questionNumber)) continue;
    const answer = answers.responses[item.questionNumber];
    if (answer === undefined) {
      missingQuestionIds.push(item.id);
      errors.push(`Falta respuesta para reactivo ${item.questionNumber}.`);
    }
  }

  if (
    answers.gateClientes === "si" &&
    [41, 42, 43].some((n) => answers.responses[n] === undefined)
  ) {
    errors.push("La compuerta de clientes es Sí; los reactivos 41-43 son obligatorios.");
  }
  if (
    answers.gateJefe === "si" &&
    [44, 45, 46].some((n) => answers.responses[n] === undefined)
  ) {
    errors.push("La compuerta de supervisión es Sí; los reactivos 44-46 son obligatorios.");
  }

  const uniqueErrors = [...new Set(errors)];

  return {
    valid: uniqueErrors.length === 0,
    missingQuestionIds: [...new Set(missingQuestionIds)],
    unexpectedQuestionIds: [...new Set(unexpectedQuestionIds)],
    skippedQuestionIds,
    duplicateQuestionIds: [...new Set(duplicateQuestionIds)],
    errors: uniqueErrors,
  };
}

export function assertValidGuiaIIAnswers(answers: GuiaIIAnswers): void {
  const validation = validateGuiaIIAnswers(answers);
  if (!validation.valid) {
    throw new Error(`Respuestas Guía II inválidas: ${validation.errors.join(" ")}`);
  }
}

export function isLikertAnswer(value: unknown): value is GuiaIILikertAnswer {
  return typeof value === "string" && LIKERT_SET.has(value);
}
