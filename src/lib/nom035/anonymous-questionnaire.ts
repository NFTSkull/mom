export const ANONYMOUS_QUESTIONNAIRE_MARKER = "CUESTIONARIO ANÓNIMO NOM-035";

export const ANONYMOUS_QUESTIONNAIRE_ITEMS = [
  {
    id: "respeto",
    label: "Me siento tratado/a con respeto en mi lugar de trabajo.",
  },
  {
    id: "carga_manejable",
    label: "Considero que mi carga de trabajo es manejable.",
  },
  {
    id: "expresar_inquietudes",
    label: "Siento que puedo expresar inquietudes sin temor a represalias.",
  },
  {
    id: "apoyo",
    label: "Recibo apoyo suficiente de mi jefe o equipo cuando lo necesito.",
  },
  {
    id: "ambiente_seguro",
    label: "Percibo un ambiente laboral seguro y saludable.",
  },
] as const;

export type AnonymousQuestionnaireItemId =
  (typeof ANONYMOUS_QUESTIONNAIRE_ITEMS)[number]["id"];

export type AnonymousQuestionnaireRatings = Record<string, number>;

export function questionnaireIsComplete(
  ratings: AnonymousQuestionnaireRatings
): boolean {
  return ANONYMOUS_QUESTIONNAIRE_ITEMS.every((item) => {
    const value = ratings[item.id];
    return Number.isInteger(value) && value >= 1 && value <= 5;
  });
}

function cleanOpenText(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Sin comentario";
}

export function buildAnonymousQuestionnaireDescription(input: {
  ratings: AnonymousQuestionnaireRatings;
  concern: string;
  suggestion: string;
}): string {
  if (!questionnaireIsComplete(input.ratings)) {
    throw new Error("incomplete_questionnaire");
  }

  const ratingLines = ANONYMOUS_QUESTIONNAIRE_ITEMS.map(
    (item, index) =>
      `${index + 1}. ${item.label} — ${input.ratings[item.id]}/5`
  );

  return [
    ANONYMOUS_QUESTIONNAIRE_MARKER,
    "",
    ...ratingLines,
    "",
    "PREOCUPACIÓN / ASPECTO A ATENDER:",
    cleanOpenText(input.concern),
    "",
    "SUGERENCIA DE MEJORA:",
    cleanOpenText(input.suggestion),
  ].join("\n");
}

export function isAnonymousQuestionnaireText(value: string | null | undefined): boolean {
  return Boolean(value?.trimStart().startsWith(ANONYMOUS_QUESTIONNAIRE_MARKER));
}
