import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { NOM035_SCORING_VERSION } from "@/data/nom035/guia-ii-manifest";

beforeAll(() => {
  process.env.NOM035_PUBLIC_EVALUATION_BACKEND = "supabase";
  process.env.NOM035_TOKEN_PEPPER = "svc-token-" + randomBytes(8).toString("hex");
  process.env.NOM035_SESSION_PEPPER = "svc-session-" + randomBytes(8).toString("hex");
  process.env.NOM035_RATE_LIMIT_PEPPER = "svc-rate-" + randomBytes(8).toString("hex");
  process.env.NOM035_EVALUATION_SESSION_MINUTES = "120";
});

function buildMinimalGuiaII(overrides?: {
  gateClientes?: "si" | "no";
  gateJefe?: "si" | "no";
  answer?: "nunca" | "siempre";
}) {
  const responses: Record<number, string> = {};
  const gateClientes = overrides?.gateClientes ?? "no";
  const gateJefe = overrides?.gateJefe ?? "no";
  const answer = overrides?.answer ?? "nunca";
  for (let n = 1; n <= 40; n++) responses[n] = answer;
  if (gateClientes === "si") {
    responses[41] = answer;
    responses[42] = answer;
    responses[43] = answer;
  }
  if (gateJefe === "si") {
    responses[44] = answer;
    responses[45] = answer;
    responses[46] = answer;
  }
  return { gateClientes, gateJefe, responses };
}

describe("B4.3 · prepareCanonicalSubmission (servidor)", () => {
  it("calcula en servidor e ignora score manipulado del cliente", async () => {
    const mod = await import("@/lib/nom035/server/public-evaluation-service");
    const prepared = mod.prepareCanonicalSubmission(
      {
        guiaI: { responses: { guia_i_1: 0 } },
        guiaII: buildMinimalGuiaII({ answer: "nunca" }),
        finalScore: 999,
        riskLevel: "muy_alto",
        scoringVersion: "fake-client-version",
        workerId: "should-be-ignored",
        campaignId: "should-be-ignored",
      },
      { requireGuiaII: true }
    );

    // Score de servidor: 16 reverse × 4 = 64 (nunca en reverse = 4), direct = 0.
    expect(prepared.serverFinalScore).toBe(64);
    expect(prepared.serverFinalRiskLevel).toBe("medio");
    expect(prepared.serverFinalScore).not.toBe(999);
    expect(prepared.scoringVersion).toBe(NOM035_SCORING_VERSION);
    expect(prepared.scoringVersion).not.toBe("fake-client-version");
    expect(prepared.validationWarnings.some((w) => w.includes("finalScore"))).toBe(true);
    expect(prepared.validationWarnings.some((w) => w.includes("riskLevel"))).toBe(true);
    expect(prepared.validationWarnings.some((w) => w.includes("scoringVersion"))).toBe(true);
    expect(prepared.validationWarnings.some((w) => w.includes("workerId"))).toBe(true);
  });

  it("no inserta preguntas skipped cuando gates = No", async () => {
    const mod = await import("@/lib/nom035/server/public-evaluation-service");
    const prepared = mod.prepareCanonicalSubmission(
      {
        guiaI: { responses: { guia_i_1: 0 } },
        guiaII: {
          ...buildMinimalGuiaII({ gateClientes: "no", gateJefe: "no" }),
          // Cliente intenta mandar 41-46 aunque gates = No.
          responses: {
            ...buildMinimalGuiaII().responses,
            41: "siempre",
            42: "siempre",
            43: "siempre",
            44: "siempre",
            45: "siempre",
            46: "siempre",
          },
        },
      },
      { requireGuiaII: true }
    );
    const ids = prepared.answers.map((a) => a.question_id);
    expect(ids).not.toContain("guia_ii_41");
    expect(ids).not.toContain("guia_ii_46");
    expect(ids).toContain("guia_ii_1");
    expect(ids).toContain("guia_ii_gate_clientes");
  });

  it("rechaza payload incompleto", async () => {
    const mod = await import("@/lib/nom035/server/public-evaluation-service");
    expect(() =>
      mod.prepareCanonicalSubmission(
        { guiaI: { responses: {} }, guiaII: buildMinimalGuiaII() },
        { requireGuiaII: true }
      )
    ).toThrow(/inválido/i);
  });

  it("incluye exactamente las respuestas aplicables cuando gates = Sí", async () => {
    const mod = await import("@/lib/nom035/server/public-evaluation-service");
    const prepared = mod.prepareCanonicalSubmission(
      {
        guiaI: { responses: { guia_i_1: 0 } },
        guiaII: buildMinimalGuiaII({ gateClientes: "si", gateJefe: "si" }),
      },
      { requireGuiaII: true }
    );
    const ids = prepared.answers.map((a) => a.question_id);
    expect(ids).toContain("guia_ii_41");
    expect(ids).toContain("guia_ii_46");
  });
});
