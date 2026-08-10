import { describe, expect, it } from "vitest";
import {
  assertUsernameIsPaddedSequence,
  buildSequenceMapping,
  isLegacyEmpleadoUsername,
  sequenceUsername,
  sortWorkersLikeB414Creation,
} from "../b418-username-sequence";

describe("B4.18 username sequence", () => {
  it('"001" permanece string y no se convierte en "1"', () => {
    const u = sequenceUsername(1);
    expect(u).toBe("001");
    expect(typeof u).toBe("string");
    expect(u).not.toBe("1");
    expect(Number(u)).toBe(1); // Number colapsa, pero nosotros NO almacenamos Number(u)
    expect(String(Number(u))).not.toBe(u);
  });

  it('"083" funciona', () => {
    expect(sequenceUsername(83)).toBe("083");
    assertUsernameIsPaddedSequence("083");
  });

  it('"084" no es válido en el rango actual', () => {
    expect(() => sequenceUsername(84)).toThrow(/1–83/);
    expect(() => assertUsernameIsPaddedSequence("084")).toThrow();
  });

  it("mapping 83 respeta orden de lista (no reordena por nombre)", () => {
    const ordered = Array.from({ length: 83 }, (_, i) => ({
      oldUsername: `empleado.${String(i + 1).padStart(4, "0")}`,
      employeeNumberRaw: String(i + 1),
    }));
    // Desordenar nombres no aplica: buildSequenceMapping no ordena
    const mapping = buildSequenceMapping(ordered);
    expect(mapping).toHaveLength(83);
    expect(mapping[0]).toMatchObject({
      oldUsername: "empleado.0001",
      newUsername: "001",
    });
    expect(mapping[1]?.newUsername).toBe("002");
    expect(mapping[82]).toMatchObject({
      oldUsername: "empleado.0083",
      newUsername: "083",
    });
  });

  it("sortWorkersLikeB414Creation es numérico, no alfabético de nombre", () => {
    const sorted = sortWorkersLikeB414Creation([
      { externalReference: "100", nombre: "Zeta" },
      { externalReference: "3", nombre: "Alfa" },
      { externalReference: "29", nombre: "Beta" },
    ] as Array<{ externalReference: string; nombre: string }>);
    expect(sorted.map((r) => r.externalReference)).toEqual(["3", "29", "100"]);
  });

  it("detecta username legado empleado.*", () => {
    expect(isLegacyEmpleadoUsername("empleado.0003")).toBe(true);
    expect(isLegacyEmpleadoUsername("001")).toBe(false);
  });

  it("buildSequenceMapping rechaza longitud ≠ 83", () => {
    expect(() =>
      buildSequenceMapping([
        { oldUsername: "empleado.0001", employeeNumberRaw: "1" },
      ])
    ).toThrow(/83/);
  });
});
