import "server-only";

/**
 * Mapeo de detalle de resultados admin.
 * No recalcula scoring: solo presenta lo persistido por el servidor.
 */

export type AdminAnswerRow = {
  questionnaireCode: string;
  questionId: string;
  answerText: string | null;
  answerValue: number | null;
};

export type MappedResultDetail = {
  id: string;
  assignmentId: string;
  worker: { id: string; nombre: string; departamento: string | null; puesto: string | null };
  campaign: { id: string; nombre: string; status: string };
  status: string;
  completedAt: string | null;
  startedAt: string | null;
  guiaIAnswers: AdminAnswerRow[];
  guiaIIAnswers: AdminAnswerRow[];
  skippedNote: string;
  guiaIRequiresClinicalAttention: boolean | null;
  guiaIRiskLabel: string | null;
  finalScore: number | null;
  finalRiskLevel: string | null;
  categoryScores: unknown;
  domainScores: unknown;
  dimensionScores: unknown;
  alerts: unknown;
  scoringVersion: string | null;
  questionnaireVersion: string | null;
  validationWarnings: unknown;
  disclaimer: string;
};

export function mapResultDetail(rpc: Record<string, unknown>): MappedResultDetail | null {
  if (rpc.ok === false) return null;
  const detail = rpc.detail as Record<string, unknown> | undefined;
  if (!detail) return null;

  const answers = (detail.answers as AdminAnswerRow[]) ?? [];
  const { guiaI: guiaIAnswers, guiaII: guiaIIAnswers } = splitAnswersByGuide(answers);

  return {
    id: String(detail.id),
    assignmentId: String(detail.assignmentId),
    worker: detail.worker as MappedResultDetail["worker"],
    campaign: detail.campaign as MappedResultDetail["campaign"],
    status: String(detail.status),
    completedAt: (detail.completedAt as string | null) ?? null,
    startedAt: (detail.startedAt as string | null) ?? null,
    guiaIAnswers,
    guiaIIAnswers,
    skippedNote:
      "Las preguntas no aplicables (skipped) no se almacenan como contestadas.",
    guiaIRequiresClinicalAttention:
      (detail.guiaIRequiresClinicalAttention as boolean | null) ?? null,
    guiaIRiskLabel: (detail.guiaIRiskLabel as string | null) ?? null,
    finalScore: (detail.finalScore as number | null) ?? null,
    finalRiskLevel: (detail.finalRiskLevel as string | null) ?? null,
    categoryScores: detail.categoryScores,
    domainScores: detail.domainScores,
    dimensionScores: detail.dimensionScores,
    alerts: detail.alerts,
    scoringVersion: (detail.scoringVersion as string | null) ?? null,
    questionnaireVersion: (detail.questionnaireVersion as string | null) ?? null,
    validationWarnings: detail.validationWarnings,
    disclaimer:
      typeof rpc.disclaimer === "string"
        ? rpc.disclaimer
        : "Resultado calculado conforme al instrumento NOM-035. No sustituye una valoración clínica profesional.",
  };
}

/** Separación Guía I / II según códigos usados en submit público. */
export function splitAnswersByGuide(answers: AdminAnswerRow[]): {
  guiaI: AdminAnswerRow[];
  guiaII: AdminAnswerRow[];
} {
  const guiaI: AdminAnswerRow[] = [];
  const guiaII: AdminAnswerRow[] = [];
  for (const a of answers) {
    const code = String(a.questionnaireCode).toUpperCase();
    if (code === "GUIA_I" || code === "I") {
      guiaI.push(a);
    } else {
      guiaII.push(a);
    }
  }
  return { guiaI, guiaII };
}
