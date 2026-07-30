import { describe, expect, it } from "vitest";
import { GUIA_III_MANIFEST } from "@/data/nom035/guia-iii-manifest";
import { NOM035_I_III_QUESTIONNAIRE_VERSION } from "@/data/nom035/guia-iii-manifest";
import { buildFrpBlocks, gateControlledNumbers } from "@/lib/nom035/frp-ui-blocks";
import { getRequiredQuestionnaires } from "@/lib/nom035/get-required-questionnaires";
import {
  resolveFrpInstrument,
  resolveQuestionnaireVersionForWorkerCount,
} from "@/lib/nom035/resolve-questionnaire-version";
import {
  prepareCanonicalSubmission,
  recalculateFrpSnapshotMatch,
} from "@/lib/nom035/server/public-evaluation-service";
import type { GuiaIIIAnswers, GuiaIILikertAnswer } from "@/types/nom035";

function fullGuiaIII(gates: { clientes: "si" | "no"; jefe: "si" | "no" }): GuiaIIIAnswers {
  const responses: Record<number, GuiaIILikertAnswer> = {};
  for (const item of GUIA_III_MANIFEST) {
    if (item.gate === "clientes" && gates.clientes === "no") continue;
    if (item.gate === "jefe" && gates.jefe === "no") continue;
    responses[item.questionNumber] = "nunca";
  }
  return { gateClientes: gates.clientes, gateJefe: gates.jefe, responses };
}

describe("B4.10 · cableado Guía III", () => {
  it("83 trabajadores → I+III (versión combinada)", () => {
    expect(getRequiredQuestionnaires(83)).toEqual(["GUIA_I", "GUIA_III"]);
    expect(getRequiredQuestionnaires(83)).not.toContain("GUIA_II");
    expect(resolveQuestionnaireVersionForWorkerCount(83)).toBe(
      NOM035_I_III_QUESTIONNAIRE_VERSION
    );
    expect(resolveFrpInstrument(NOM035_I_III_QUESTIONNAIRE_VERSION)).toBe("GUIA_III");
  });

  it("16–50 → I+II; ≤15 → solo I", () => {
    expect(getRequiredQuestionnaires(16)).toEqual(["GUIA_I", "GUIA_II"]);
    expect(getRequiredQuestionnaires(50)).toEqual(["GUIA_I", "GUIA_II"]);
    expect(getRequiredQuestionnaires(15)).toEqual(["GUIA_I"]);
  });

  it("bloques UI Guía III desde manifiesto (65–68 / 69–72)", () => {
    const blocks = buildFrpBlocks("GUIA_III");
    expect(blocks.length).toBeGreaterThan(2);
    expect(gateControlledNumbers("GUIA_III", "clientes")).toEqual([65, 66, 67, 68]);
    expect(gateControlledNumbers("GUIA_III", "jefe")).toEqual([69, 70, 71, 72]);
    const gateBlocks = blocks.filter((b) => b.gate);
    expect(gateBlocks).toHaveLength(2);
  });

  it("prepareCanonicalSubmission I+III + snapshot reproducible", () => {
    const guiaIII = fullGuiaIII({ clientes: "no", jefe: "no" });
    const prepared = prepareCanonicalSubmission(
      {
        guiaI: { responses: { guia_i_1: 0 } },
        guiaIII,
        finalScore: 9999,
      },
      { questionnaireVersion: NOM035_I_III_QUESTIONNAIRE_VERSION }
    );
    expect(prepared.questionnaireVersion).toBe(NOM035_I_III_QUESTIONNAIRE_VERSION);
    expect(prepared.result.result_snapshot.guide_type).toBe("GUIA_III");
    expect(prepared.answers.some((a) => a.questionnaire_code === "GUIA_III")).toBe(true);
    expect(prepared.answers.some((a) => a.questionnaire_code === "GUIA_II")).toBe(false);
    expect(prepared.validationWarnings.some((w) => w.includes("finalScore"))).toBe(true);

    const match = recalculateFrpSnapshotMatch({
      frp: "GUIA_III",
      guiaIResponses: [{ questionId: "guia_i_1", value: 0 }],
      frpAnswers: guiaIII,
      snapshot: prepared.result.result_snapshot,
    });
    expect(match.match).toBe(true);
  });

  it("cliente no puede forzar Guía II vía payload cuando versión es i-iii", () => {
    const guiaIII = fullGuiaIII({ clientes: "si", jefe: "no" });
    const prepared = prepareCanonicalSubmission(
      {
        guiaI: { responses: { guia_i_1: 0 } },
        guiaII: {
          gateClientes: "si",
          gateJefe: "si",
          responses: { 1: "siempre" },
        },
        guiaIII,
      },
      { questionnaireVersion: NOM035_I_III_QUESTIONNAIRE_VERSION }
    );
    expect(prepared.result.result_snapshot.guide_type).toBe("GUIA_III");
    expect(prepared.answers.every((a) => a.questionnaire_code !== "GUIA_II")).toBe(true);
  });
});
