import { describe, expect, it } from "vitest";
import {
  assertLocalPasswordPolicy,
  assertPasswordEqualsCanonical,
  B4154PolicyError,
  buildPasswordPlan,
  buildWorkerPassword,
  normalizeEmployeeNumber,
  passwordFromEmployeeNumber,
  proposedUsername,
  legacyEmpleadoUsername,
  redactPlanForLog,
} from "../../../../scripts/lib/b4154-employee-password";
import {
  assertRefsMatch,
  extractProjectRefFromUrl,
  sanitizeRef,
} from "../../../../scripts/lib/assert-production-only";

describe("B4.15.4B NOM+employee password", () => {
  it("preserva ceros iniciales en NOM+número", () => {
    expect(normalizeEmployeeNumber("0003")).toBe("0003");
    expect(buildWorkerPassword("0003")).toBe("NOM0003");
    expect(passwordFromEmployeeNumber("0003")).toBe("NOM0003");
    expect(legacyEmpleadoUsername("0003")).toBe("empleado.0003");
  });

  it("nunca convierte a número y no usa !", () => {
    const pwd = passwordFromEmployeeNumber("3");
    expect(pwd).toBe("NOM0003");
    expect(pwd.includes("!")).toBe(false);
    expect(typeof pwd).toBe("string");
    expect(passwordFromEmployeeNumber("0003")).not.toBe(
      `NOM${String(parseInt("0003", 10))}`
    );
  });

  it("ejemplos de producto", () => {
    expect(buildWorkerPassword("0003")).toBe("NOM0003");
    expect(buildWorkerPassword("0127")).toBe("NOM0127");
    expect(buildWorkerPassword("1045")).toBe("NOM1045");
  });

  it("password coincide con NOM+canónico", () => {
    assertPasswordEqualsCanonical("NOM0042", "42");
    expect(() => assertPasswordEqualsCanonical("0042", "42")).toThrow(
      B4154PolicyError
    );
    expect(() => assertPasswordEqualsCanonical("NOM0042!", "42")).toThrow(
      B4154PolicyError
    );
  });

  it("B4.18 retira proposedUsername empleado.*", () => {
    expect(() => proposedUsername("42")).toThrow(/B4\.18/);
    expect(legacyEmpleadoUsername("42")).toBe("empleado.0042");
  });

  it("rechaza worker sin número", () => {
    expect(() => normalizeEmployeeNumber("")).toThrow(B4154PolicyError);
    expect(() => buildWorkerPassword("")).toThrow(/inválido/i);
    expect(() => buildWorkerPassword("   ")).toThrow(/inválido/i);
  });

  it("rechaza duplicados en el plan", () => {
    const built = buildPasswordPlan([
      {
        workerId: "w1",
        authUserId: "a1",
        username: "empleado.0001",
        externalReference: "1",
      },
      {
        workerId: "w2",
        authUserId: "a2",
        username: "empleado.0001",
        externalReference: "0001",
      },
    ]);
    expect(built.duplicates.length).toBe(1);
    expect(built.uniquePasswords).toBe(1);
  });

  it("rechaza política local incompatible", () => {
    const r = assertLocalPasswordPolicy(["NOM1", "short"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failing).toBeGreaterThan(0);
  });

  it("rechaza ! en política local", () => {
    const r = assertLocalPasswordPolicy(["NOM0003!"]);
    expect(r.ok).toBe(false);
  });

  it("NOM+4 dígitos cumple min 6", () => {
    const pwd = passwordFromEmployeeNumber("3");
    expect(pwd.length).toBeGreaterThanOrEqual(6);
    expect(assertLocalPasswordPolicy([pwd, "NOM0127", "NOM1045"]).ok).toBe(true);
  });

  it("no imprime passwords en redact", () => {
    const built = buildPasswordPlan([
      {
        workerId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        authUserId: "auth",
        username: "empleado.0007",
        externalReference: "7",
      },
    ]);
    const redacted = JSON.stringify(redactPlanForLog(built.plan));
    expect(redacted).not.toContain("NOM0007");
    expect(redacted).not.toContain(built.plan[0]!.passwordCandidate);
  });

  it("dry-run plan no muta ids", () => {
    const built = buildPasswordPlan([
      {
        workerId: "w",
        authUserId: "a",
        username: "empleado.0009",
        externalReference: "9",
      },
    ]);
    expect(built.plan[0]!.workerId).toBe("w");
    expect(built.plan[0]!.authUserId).toBe("a");
    expect(built.plan[0]!.username).toBe("empleado.0009");
    expect(built.plan[0]!.passwordCandidate).toBe("NOM0009");
  });

  it("segunda ejecución mantiene mismos valores", () => {
    expect(passwordFromEmployeeNumber("0003")).toBe(
      passwordFromEmployeeNumber("3")
    );
    expect(passwordFromEmployeeNumber("0003")).toBe("NOM0003");
  });

  it("ConCasa es rechazado", () => {
    expect(() =>
      extractProjectRefFromUrl("https://concasa.example.supabase.co")
    ).toThrow(/ConCasa|ABORT/i);
    expect(() =>
      assertRefsMatch({
        urlRef: "fvtqxxxxvwzy",
        expected: "fvtqxxxxvwzy",
        confirmed: "fvtqxxxxvwzy",
      })
    ).toThrow(/ConCasa|prohibido|ABORT/i);
  });

  it("sanitizeRef no expone ref completo", () => {
    const s = sanitizeRef("agblifmcnhfvyrfvkubf");
    expect(s).toContain("…");
    expect(s.length).toBeLessThan(12);
  });
});
