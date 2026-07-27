import type { GuiaIIGateQuestion, GuiaIIQuestion } from "@/types/nom035";
import {
  GUIA_II_DIRECT_SCORED_ITEMS as MANIFEST_DIRECT,
  GUIA_II_GATE_CLIENTES_TEXT,
  GUIA_II_GATE_JEFE_TEXT,
  GUIA_II_MANIFEST,
  GUIA_II_REVERSE_SCORED_ITEMS as MANIFEST_REVERSE,
} from "@/data/nom035/guia-ii-manifest";

export const GUIA_II_GATES: GuiaIIGateQuestion[] = [
  {
    id: "guia_ii_gate_clientes",
    questionnaireCode: "GUIA_II",
    text: GUIA_II_GATE_CLIENTES_TEXT,
    responseType: "yes_no",
    order: 40.5,
    controlsQuestions: [41, 42, 43],
  },
  {
    id: "guia_ii_gate_jefe",
    questionnaireCode: "GUIA_II",
    text: GUIA_II_GATE_JEFE_TEXT,
    responseType: "yes_no",
    order: 43.5,
    controlsQuestions: [44, 45, 46],
  },
];

export const GUIA_II_QUESTIONS: GuiaIIQuestion[] = GUIA_II_MANIFEST.map((item) => ({
  id: item.id,
  questionnaireCode: "GUIA_II",
  questionNumber: item.questionNumber,
  text: item.text,
  responseType: "likert",
  order: item.questionNumber,
}));

export const GUIA_II_REVERSE_SCORED_ITEMS = MANIFEST_REVERSE;
export const GUIA_II_DIRECT_SCORED_ITEMS = MANIFEST_DIRECT;
