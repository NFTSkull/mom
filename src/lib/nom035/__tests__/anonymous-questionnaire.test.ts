import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_QUESTIONNAIRE_ITEMS,
  ANONYMOUS_QUESTIONNAIRE_MARKER,
  buildAnonymousQuestionnaireDescription,
  isAnonymousQuestionnaireText,
  questionnaireIsComplete,
} from "@/lib/nom035/anonymous-questionnaire";

const completeRatings = Object.fromEntries(
  ANONYMOUS_QUESTIONNAIRE_ITEMS.map((item) => [item.id, 4])
);

describe("cuestionario anónimo", () => {
  it("requiere las cinco respuestas de escala", () => {
    expect(questionnaireIsComplete(completeRatings)).toBe(true);
    expect(questionnaireIsComplete({ respeto: 4 })).toBe(false);
  });

  it("rechaza valores fuera de 1 a 5", () => {
    expect(questionnaireIsComplete({ ...completeRatings, respeto: 6 })).toBe(false);
    expect(questionnaireIsComplete({ ...completeRatings, respeto: 0 })).toBe(false);
  });

  it("genera un texto sin campos de identidad", () => {
    const text = buildAnonymousQuestionnaireDescription({
      ratings: completeRatings,
      concern: "Mejorar comunicación.",
      suggestion: "Más reuniones breves.",
    });
    expect(text.startsWith(ANONYMOUS_QUESTIONNAIRE_MARKER)).toBe(true);
    expect(text).toContain("4/5");
    expect(text).not.toMatch(/nombre|correo|nss|número de empleado/i);
  });

  it("usa texto neutro cuando los comentarios están vacíos", () => {
    const text = buildAnonymousQuestionnaireDescription({
      ratings: completeRatings,
      concern: " ",
      suggestion: "",
    });
    expect(text.match(/Sin comentario/g)).toHaveLength(2);
  });

  it("identifica respuestas del cuestionario por marcador", () => {
    expect(isAnonymousQuestionnaireText(`${ANONYMOUS_QUESTIONNAIRE_MARKER}\n1. ...`)).toBe(true);
    expect(isAnonymousQuestionnaireText("Otro reporte")).toBe(false);
  });
});
