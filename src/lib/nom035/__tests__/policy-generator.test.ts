import { describe, expect, it } from "vitest";
import { MOCK_COMPANY } from "../../../data/nom035/mock-company";
import { generateBasePolicy, getPolicyStatusLabel } from "../policy-generator";

describe("policy-generator", () => {
  it("genera politica base con empresa y compromisos", () => {
    const policy = generateBasePolicy(MOCK_COMPANY);
    expect(policy.title).toContain(MOCK_COMPANY.legalName);
    expect(policy.version).toBe("1.0");
    expect(policy.content).toContain("prevenir factores de riesgo psicosocial");
    expect(policy.content).toContain("mecanismos confidenciales");
    expect(policy.content).toContain("No se permitiran represalias");
  });

  it("etiqueta estatus de politica", () => {
    expect(getPolicyStatusLabel("borrador")).toBe("Borrador");
    expect(getPolicyStatusLabel("publicada")).toBe("Publicada");
  });
});
