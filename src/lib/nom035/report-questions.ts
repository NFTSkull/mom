/**
 * B4.24 — Textos oficiales de preguntas para reportes.
 */

import { GUIA_I_QUESTIONS } from "@/data/nom035/guia-i";
import {
  GUIA_III_MANIFEST,
  GUIA_III_MANIFEST_BY_NUMBER,
} from "@/data/nom035/guia-iii-manifest";
import type { ReportAnswerRow } from "@/lib/nom035/report-data";

const GUIA_I_BY_ID = new Map(GUIA_I_QUESTIONS.map((q) => [q.id, q]));
const GUIA_III_BY_ID = new Map(GUIA_III_MANIFEST.map((q) => [q.id, q]));

export function guiaIQuestionText(questionId: string): string {
  return GUIA_I_BY_ID.get(questionId)?.text ?? questionId;
}

export function guiaIQuestionNumber(questionId: string): number {
  const q = GUIA_I_BY_ID.get(questionId);
  return q?.order ?? 0;
}

export function guiaIIIQuestionText(questionId: string): string {
  if (questionId === "guia_iii_gate_clientes") {
    return "En mi trabajo debo brindar servicio a clientes o usuarios:";
  }
  if (questionId === "guia_iii_gate_jefe") {
    return "Soy jefe de otros trabajadores:";
  }
  return GUIA_III_BY_ID.get(questionId)?.text ?? questionId;
}

export function guiaIIIQuestionNumber(questionId: string): number {
  if (questionId === "guia_iii_gate_clientes") return 0;
  if (questionId === "guia_iii_gate_jefe") return 0;
  return GUIA_III_BY_ID.get(questionId)?.questionNumber ?? 0;
}

export function formatAnswerDisplay(answer: ReportAnswerRow): string {
  if (answer.answerText) return answer.answerText;
  if (answer.answerValue == null) return "—";
  const v = String(answer.answerValue);
  if (v === "si") return "Sí";
  if (v === "no") return "No";
  if (v === "siempre") return "Siempre";
  if (v === "casi_siempre") return "Casi siempre";
  if (v === "algunas_veces") return "Algunas veces";
  if (v === "casi_nunca") return "Casi nunca";
  if (v === "nunca") return "Nunca";
  return v;
}

/** Preguntas Guía III condicionales 65–72 no respondidas → no aplicable. */
export function guiaIIIAnswerStatus(
  questionId: string,
  answeredIds: Set<string>
): "respondida" | "no_aplicable" | "pendiente" {
  const item = GUIA_III_BY_ID.get(questionId);
  if (!item) {
    return answeredIds.has(questionId) ? "respondida" : "pendiente";
  }
  if (item.gate && !answeredIds.has(questionId)) {
    return "no_aplicable";
  }
  return answeredIds.has(questionId) ? "respondida" : "pendiente";
}

export function orderedGuiaIIIAnswerRows(
  answers: ReportAnswerRow[]
): Array<ReportAnswerRow & { status: "respondida" | "no_aplicable" }> {
  const guiaIII = answers.filter((a) => {
    const code = a.questionnaireCode.toUpperCase();
    return code === "GUIA_III" || code === "III";
  });
  const byId = new Map(guiaIII.map((a) => [a.questionId, a]));

  const rows: Array<ReportAnswerRow & { status: "respondida" | "no_aplicable" }> = [];

  for (const gateId of ["guia_iii_gate_clientes", "guia_iii_gate_jefe"] as const) {
    const ans = byId.get(gateId);
    if (ans) rows.push({ ...ans, status: "respondida" });
  }

  for (const item of GUIA_III_MANIFEST) {
    const ans = byId.get(item.id);
    if (ans) {
      rows.push({ ...ans, status: "respondida" });
      continue;
    }
    if (item.gate) {
      rows.push({
        questionnaireCode: "GUIA_III",
        questionId: item.id,
        answerText: "No aplicable",
        answerValue: null,
        status: "no_aplicable",
      });
    }
  }

  return rows.sort(
    (a, b) => guiaIIIQuestionNumber(a.questionId) - guiaIIIQuestionNumber(b.questionId)
  );
}

export function orderedGuiaIAnswerRows(answers: ReportAnswerRow[]): ReportAnswerRow[] {
  return answers
    .filter((a) => {
      const code = a.questionnaireCode.toUpperCase();
      return code === "GUIA_I" || code === "I";
    })
    .sort((a, b) => guiaIQuestionNumber(a.questionId) - guiaIQuestionNumber(b.questionId));
}

export { GUIA_III_MANIFEST_BY_NUMBER };
