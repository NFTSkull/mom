import { describe, expect, it } from "vitest";
import {
  permissionIsSensitive,
  permissionRequiresAal2,
} from "../auth/permissions";

describe("B4.21 results without AAL2", () => {
  it("ver resultados no exige AAL2 pero sí sensitive", () => {
    for (const p of [
      "results.individual.read",
      "results.answers.read",
      "results.clinical.read",
    ] as const) {
      expect(permissionRequiresAal2(p)).toBe(false);
      expect(permissionIsSensitive(p)).toBe(true);
    }
  });

  it("quejas y users.manage siguen exigiendo AAL2", () => {
    expect(permissionRequiresAal2("complaints.detail")).toBe(true);
    expect(permissionRequiresAal2("users.manage")).toBe(true);
    expect(permissionRequiresAal2("evidence.download")).toBe(true);
  });
});
