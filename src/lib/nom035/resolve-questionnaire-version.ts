import { NOM035_QUESTIONNAIRE_VERSION } from "@/data/nom035/guia-ii-manifest";
import { NOM035_I_III_QUESTIONNAIRE_VERSION } from "@/data/nom035/guia-iii-manifest";
import { getRequiredQuestionnaires } from "@/lib/nom035/get-required-questionnaires";
import type { QuestionnaireType } from "@/types/nom035";

export type CombinedQuestionnaireVersion =
  | typeof NOM035_QUESTIONNAIRE_VERSION
  | typeof NOM035_I_III_QUESTIONNAIRE_VERSION;

/** Resuelve la versión combinada del assignment según tamaño de plantilla. */
export function resolveQuestionnaireVersionForWorkerCount(
  workerCount: number
): CombinedQuestionnaireVersion {
  const required = getRequiredQuestionnaires(workerCount);
  if (required.includes("GUIA_III")) return NOM035_I_III_QUESTIONNAIRE_VERSION;
  return NOM035_QUESTIONNAIRE_VERSION;
}

export function resolveFrpInstrument(
  version: string | null | undefined
): "GUIA_II" | "GUIA_III" | null {
  if (version === NOM035_I_III_QUESTIONNAIRE_VERSION) return "GUIA_III";
  if (version === NOM035_QUESTIONNAIRE_VERSION) return "GUIA_II";
  return null;
}

export function requiredInstrumentsForVersion(
  version: string | null | undefined
): QuestionnaireType[] {
  if (version === NOM035_I_III_QUESTIONNAIRE_VERSION) return ["GUIA_I", "GUIA_III"];
  if (version === NOM035_QUESTIONNAIRE_VERSION) return ["GUIA_I", "GUIA_II"];
  return ["GUIA_I"];
}
