import {
  GUIA_II_GATE_CLIENTES_TEXT,
  GUIA_II_GATE_JEFE_TEXT,
  GUIA_II_MANIFEST,
} from "@/data/nom035/guia-ii-manifest";
import {
  GUIA_III_GATE_CLIENTES_TEXT,
  GUIA_III_GATE_JEFE_TEXT,
  GUIA_III_MANIFEST,
  type GuiaIIIManifestItem,
} from "@/data/nom035/guia-iii-manifest";
import type { GuiaIIGateAnswer } from "@/types/nom035";

export type FrpKind = "GUIA_II" | "GUIA_III";

export interface FrpBlock {
  id: string;
  title: string;
  description: string;
  questionNumbers: number[];
  gate?: "clientes" | "jefe";
}

export interface FrpQuestionView {
  id: string;
  questionNumber: number;
  text: string;
}

const PAGE_SIZE = 10;

function chunkNumbers(nums: number[], size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < nums.length; i += size) out.push(nums.slice(i, i + size));
  return out;
}

/** Bloques de UI derivados del manifiesto (sin hardcodear IDs de reactivos). */
export function buildFrpBlocks(kind: FrpKind): FrpBlock[] {
  const prefix = kind === "GUIA_III" ? "Guía III" : "Guía II";
  const manifest = kind === "GUIA_III" ? GUIA_III_MANIFEST : GUIA_II_MANIFEST;
  const core = manifest.filter((i) => i.gate === null).map((i) => i.questionNumber);
  const clientes = manifest.filter((i) => i.gate === "clientes").map((i) => i.questionNumber);
  const jefe = manifest.filter((i) => i.gate === "jefe").map((i) => i.questionNumber);

  const blocks: FrpBlock[] = chunkNumbers(core, PAGE_SIZE).map((questionNumbers, idx) => ({
    id: `${kind.toLowerCase()}-b${idx + 1}`,
    title: `${prefix} · Bloque ${idx + 1}`,
    description: "Responde según tu experiencia reciente de trabajo.",
    questionNumbers,
  }));

  blocks.push({
    id: `${kind.toLowerCase()}-clientes`,
    title: `${prefix} · Atención a clientes o usuarios`,
    description: "Primero responde la compuerta y después, si aplica, las preguntas de esta sección.",
    questionNumbers: clientes,
    gate: "clientes",
  });
  blocks.push({
    id: `${kind.toLowerCase()}-jefe`,
    title: `${prefix} · Jefatura o supervisión`,
    description: "Primero responde la compuerta y después, si aplica, las preguntas de esta sección.",
    questionNumbers: jefe,
    gate: "jefe",
  });

  return blocks;
}

export function buildFrpQuestionMap(kind: FrpKind): Map<number, FrpQuestionView> {
  const manifest = kind === "GUIA_III" ? GUIA_III_MANIFEST : GUIA_II_MANIFEST;
  return new Map(
    (manifest as GuiaIIIManifestItem[]).map((item) => [
      item.questionNumber,
      { id: item.id, questionNumber: item.questionNumber, text: item.text },
    ])
  );
}

export function frpGateTexts(kind: FrpKind): { clientes: string; jefe: string } {
  if (kind === "GUIA_III") {
    return { clientes: GUIA_III_GATE_CLIENTES_TEXT, jefe: GUIA_III_GATE_JEFE_TEXT };
  }
  return { clientes: GUIA_II_GATE_CLIENTES_TEXT, jefe: GUIA_II_GATE_JEFE_TEXT };
}

export function frpRadioNamePrefix(kind: FrpKind): string {
  return kind === "GUIA_III" ? "guia-iii-" : "guia-ii-";
}

export function frpStageName(kind: FrpKind): "guia_ii" | "guia_iii" {
  return kind === "GUIA_III" ? "guia_iii" : "guia_ii";
}

export function gateControlledNumbers(
  kind: FrpKind,
  gate: "clientes" | "jefe"
): number[] {
  const manifest = kind === "GUIA_III" ? GUIA_III_MANIFEST : GUIA_II_MANIFEST;
  return manifest.filter((i) => i.gate === gate).map((i) => i.questionNumber);
}

export function clearGateAnswers(
  answers: Record<number, string>,
  kind: FrpKind,
  gate: "clientes" | "jefe",
  value: GuiaIIGateAnswer
): Record<number, string> {
  if (value !== "no") return answers;
  const next = { ...answers };
  for (const n of gateControlledNumbers(kind, gate)) delete next[n];
  return next;
}
