import {
  GUIA_III_GATE_CLIENTES_TEXT,
  GUIA_III_GATE_JEFE_TEXT,
  GUIA_III_MANIFEST,
} from "@/data/nom035/guia-iii-manifest";
import type { GuiaIIIGateQuestion, GuiaIIIQuestion } from "@/types/nom035";

export const GUIA_III_QUESTIONS: GuiaIIIQuestion[] = GUIA_III_MANIFEST.map((item) => ({
  id: item.id,
  questionnaireCode: "GUIA_III",
  questionNumber: item.questionNumber,
  text: item.text,
  responseType: "likert",
  order: item.questionNumber,
}));

export const GUIA_III_GATE_QUESTIONS: GuiaIIIGateQuestion[] = [
  {
    id: "guia_iii_gate_clientes",
    questionnaireCode: "GUIA_III",
    text: GUIA_III_GATE_CLIENTES_TEXT,
    responseType: "yes_no",
    order: 64.5,
    controlsQuestions: [65, 66, 67, 68],
  },
  {
    id: "guia_iii_gate_jefe",
    questionnaireCode: "GUIA_III",
    text: GUIA_III_GATE_JEFE_TEXT,
    responseType: "yes_no",
    order: 68.5,
    controlsQuestions: [69, 70, 71, 72],
  },
];
