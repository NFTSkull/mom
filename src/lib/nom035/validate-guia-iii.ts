import {
  GUIA_III_MANIFEST,
  GUIA_III_MANIFEST_BY_NUMBER,
} from "@/data/nom035/guia-iii-manifest";
import type { GuiaIIIAnswers, GuiaIIGateAnswer, GuiaIILikertAnswer } from "@/types/nom035";

const LIKERT = new Set<GuiaIILikertAnswer>([
  "siempre",
  "casi_siempre",
  "algunas_veces",
  "casi_nunca",
  "nunca",
]);

export function getGuiaIIISkippedQuestionNumbers(input: {
  gateClientes: GuiaIIGateAnswer;
  gateJefe: GuiaIIGateAnswer;
}): number[] {
  const skipped: number[] = [];
  if (input.gateClientes === "no") skipped.push(65, 66, 67, 68);
  if (input.gateJefe === "no") skipped.push(69, 70, 71, 72);
  return skipped;
}

export function assertValidGuiaIIIAnswers(answers: GuiaIIIAnswers): void {
  if (answers.gateClientes !== "si" && answers.gateClientes !== "no") {
    throw new Error("Guía III incompleta: falta la compuerta de clientes.");
  }
  if (answers.gateJefe !== "si" && answers.gateJefe !== "no") {
    throw new Error("Guía III incompleta: falta la compuerta de jefatura.");
  }

  const skipped = new Set(
    getGuiaIIISkippedQuestionNumbers({
      gateClientes: answers.gateClientes,
      gateJefe: answers.gateJefe,
    })
  );

  for (const item of GUIA_III_MANIFEST) {
    if (skipped.has(item.questionNumber)) {
      if (answers.responses[item.questionNumber] !== undefined) {
        throw new Error(
          `Guía III inválida: el reactivo ${item.questionNumber} no aplica y no debe responderse.`
        );
      }
      continue;
    }
    const answer = answers.responses[item.questionNumber];
    if (answer === undefined) {
      throw new Error(`Guía III incompleta: falta el reactivo ${item.questionNumber}.`);
    }
    if (!LIKERT.has(answer)) {
      throw new Error(`Guía III inválida: valor no permitido en reactivo ${item.questionNumber}.`);
    }
    if (!GUIA_III_MANIFEST_BY_NUMBER.has(item.questionNumber)) {
      throw new Error(`Guía III inválida: reactivo ${item.questionNumber} desconocido.`);
    }
  }

  for (const key of Object.keys(answers.responses)) {
    const n = Number(key);
    if (!GUIA_III_MANIFEST_BY_NUMBER.has(n)) {
      throw new Error(`Guía III inválida: reactivo ${n} no pertenece al instrumento.`);
    }
  }
}

export { getGuiaIIISkippedQuestionNumbers as getSkippedGuiaIIIQuestionNumbers };
