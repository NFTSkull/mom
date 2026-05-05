import { describe, expect, it } from "vitest";
import { getRequiredQuestionnaires } from "../get-required-questionnaires";

describe("getRequiredQuestionnaires", () => {
  it("asigna GUIA_I para empresas pequenas", () => {
    expect(getRequiredQuestionnaires(10)).toEqual(["GUIA_I"]);
  });

  it("asigna GUIA_I y GUIA_II para empresa mediana", () => {
    expect(getRequiredQuestionnaires(30)).toEqual(["GUIA_I", "GUIA_II"]);
  });

  it("asigna las tres guias para empresa grande", () => {
    expect(getRequiredQuestionnaires(120)).toEqual(["GUIA_I", "GUIA_II", "GUIA_III"]);
  });
});
