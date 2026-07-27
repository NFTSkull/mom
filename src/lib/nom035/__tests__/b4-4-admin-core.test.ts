import { describe, expect, it } from "vitest";
import { mapWorkerCsv, parseCsv } from "@/lib/nom035/server/admin-worker-import";
import { mapResultDetail, splitAnswersByGuide } from "@/lib/nom035/server/admin-result-mapper";
import { buildWorkerMessage } from "@/lib/nom035/server/admin-campaign-service";

describe("B4.4 · CSV parser", () => {
  it("parsea comillas, acentos y coma dentro de campo", () => {
    const csv = `nombre,email,departamento\n"Pérez, Ana",ana@demo.test,"Ventas, Norte"\n`;
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["nombre", "email", "departamento"]);
    expect(parsed.rows[0]).toEqual(["Pérez, Ana", "ana@demo.test", "Ventas, Norte"]);
  });

  it("rechaza encabezado faltante", () => {
    const preview = mapWorkerCsv("email,departamento\na@b.com,RH\n");
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.code === "missing_header")).toBe(true);
  });

  it("detecta duplicado interno de email", () => {
    const preview = mapWorkerCsv(
      "nombre,email\nUno,a@demo.test\nDos,a@demo.test\n"
    );
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.code === "duplicate_email_in_file")).toBe(true);
  });

  it("acepta activo sí/no", () => {
    const preview = mapWorkerCsv("nombre,activo\nAna,sí\nLuis,no\n");
    expect(preview.ok).toBe(true);
    expect(preview.rows[0]?.activo).toBe(true);
    expect(preview.rows[1]?.activo).toBe(false);
  });

  it("fila vacía se omite", () => {
    const preview = mapWorkerCsv("nombre,email\nAna,a@demo.test\n,,\n");
    expect(preview.ok).toBe(true);
    expect(preview.rows).toHaveLength(1);
  });
});

describe("B4.4 · result mapper", () => {
  it("separa GUIA_I y GUIA_II", () => {
    const { guiaI, guiaII } = splitAnswersByGuide([
      { questionnaireCode: "GUIA_I", questionId: "q1", answerText: "No", answerValue: 0 },
      { questionnaireCode: "GUIA_II", questionId: "q2", answerText: null, answerValue: 1 },
    ]);
    expect(guiaI).toHaveLength(1);
    expect(guiaII).toHaveLength(1);
  });

  it("mapResultDetail incluye disclaimer", () => {
    const mapped = mapResultDetail({
      ok: true,
      disclaimer: "Resultado calculado conforme al instrumento NOM-035. No sustituye una valoración clínica profesional.",
      detail: {
        id: "r1",
        assignmentId: "a1",
        worker: { id: "w1", nombre: "Ana", departamento: "RH", puesto: "Analista" },
        campaign: { id: "c1", nombre: "2026", status: "active" },
        status: "completed",
        completedAt: null,
        startedAt: null,
        answers: [{ questionnaireCode: "GUIA_II", questionId: "x", answerText: null, answerValue: 1 }],
        guiaIRequiresClinicalAttention: false,
        guiaIRiskLabel: null,
        finalScore: 10,
        finalRiskLevel: "bajo",
        categoryScores: {},
        domainScores: {},
        dimensionScores: {},
        alerts: [],
        scoringVersion: "nom035-stps-2018-guia-i-ii-v1",
        questionnaireVersion: "nom035-stps-2018-guias-referencia-i-ii",
        validationWarnings: [],
      },
    });
    expect(mapped?.finalScore).toBe(10);
    expect(mapped?.disclaimer).toMatch(/No sustituye/);
  });
});

describe("B4.4 · mensaje de enlace", () => {
  it("no afirma anonimato", () => {
    const msg = buildWorkerMessage({
      workerName: "Ana",
      companyName: "Demo SA",
      link: "http://localhost:3000/evaluacion/ev_x",
    });
    expect(msg).toContain("Ana");
    expect(msg).toContain("confidencial");
    expect(msg.toLowerCase()).not.toContain("anónim");
  });
});
