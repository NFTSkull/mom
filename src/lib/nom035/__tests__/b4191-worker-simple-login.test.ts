import { describe, expect, it } from "vitest";
import {
  ADMIN_AAL1_OK_EXAMPLES,
  ADMIN_AAL2_PERMISSIONS,
  ADMIN_MFA_IS_SEPARATE,
  WORKER_MFA_REQUIRED,
  workerLoginRequiresOnlyUsernamePassword,
} from "../worker-simple-login";
import {
  permissionRequiresAal2,
  type AppPermission,
} from "../auth/permissions";

describe("B4.19.1 worker simple login", () => {
  it("WORKER_MFA_REQUIRED=false y ADMIN_MFA_IS_SEPARATE=true", () => {
    expect(WORKER_MFA_REQUIRED).toBe(false);
    expect(ADMIN_MFA_IS_SEPARATE).toBe(true);
  });

  it("respuesta login worker no incluye campos MFA", () => {
    expect(
      workerLoginRequiresOnlyUsernamePassword([
        "ok",
        "mustChangePassword",
        "requestId",
      ])
    ).toBe(true);
    expect(
      workerLoginRequiresOnlyUsernamePassword(["ok", "mfa", "factorId"])
    ).toBe(false);
  });

  it("results.individual.read NO exige AAL2; users.manage sí", () => {
    expect(permissionRequiresAal2("results.individual.read")).toBe(false);
    expect(permissionRequiresAal2("results.answers.read")).toBe(false);
    expect(permissionRequiresAal2("results.clinical.read")).toBe(false);
    expect(permissionRequiresAal2("dashboard.view")).toBe(false);
    expect(permissionRequiresAal2("results.aggregate.read")).toBe(false);
    expect(permissionRequiresAal2("users.manage")).toBe(true);
    for (const p of ADMIN_AAL2_PERMISSIONS) {
      expect(permissionRequiresAal2(p as AppPermission)).toBe(true);
    }
    for (const p of ADMIN_AAL1_OK_EXAMPLES) {
      expect(permissionRequiresAal2(p as AppPermission)).toBe(false);
    }
  });
});
