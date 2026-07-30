import type { QuestionnaireType } from "@/types/nom035";

/**
 * Regla inicial de asignacion de guias para MVP local.
 * Ajustaremos con las reglas oficiales al integrar contratos finales.
 */
export function getRequiredQuestionnaires(employeeCount: number): QuestionnaireType[] {
  if (employeeCount <= 15) return ["GUIA_I"];
  if (employeeCount <= 50) return ["GUIA_I", "GUIA_II"];
  // >50: Guía I (eventos traumáticos) + Guía III (FRP y entorno organizacional).
  // Guía II no aplica como instrumento productivo para N>50.
  return ["GUIA_I", "GUIA_III"];
}
