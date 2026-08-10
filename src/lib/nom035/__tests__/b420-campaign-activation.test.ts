import { describe, expect, it } from "vitest";
import {
  assertCampaignActivationStructuralOk,
  campaignActivationRequiresAdminAal2,
  sensitiveAdminEndpointRequiresAal2,
  type CampaignActivationSnapshot,
} from "../campaign-activation-gates";
import { permissionRequiresAal2 } from "../auth/permissions";
import { assertNoTimeBasedCampaignExpiry } from "../campaign-permanence";
import { WORKER_MFA_REQUIRED } from "../worker-simple-login";

const good: CampaignActivationSnapshot = {
  campaignStatus: "draft",
  campaignsNamed: 1,
  activeCampaigns: 0,
  workers: 83,
  workerAccounts: 83,
  assignments: 83,
  pending: 83,
  dupWorkers: 0,
  sessions: 0,
  answers: 0,
  results: 0,
  guiaI: 83,
  guiaII: 0,
  guiaIII: 83,
  asgExpiresSet: 0,
  fechaCierreNull: true,
  fechaInicioNull: true,
  closedAtNull: true,
};

describe("B4.20 campaign activation gates", () => {
  it("structural OK sin MFA", () => {
    expect(assertCampaignActivationStructuralOk(good).ok).toBe(true);
    expect(campaignActivationRequiresAdminAal2()).toBe(false);
    expect(WORKER_MFA_REQUIRED).toBe(false);
  });

  it("bloquea si hay otra active o conteos mal", () => {
    expect(
      assertCampaignActivationStructuralOk({ ...good, activeCampaigns: 1 }).ok
    ).toBe(false);
    expect(
      assertCampaignActivationStructuralOk({ ...good, assignments: 82 }).ok
    ).toBe(false);
  });

  it("AAL1 puede documentar activación y ver resultados; AAL2 sigue en quejas/users", () => {
    expect(campaignActivationRequiresAdminAal2()).toBe(false);
    expect(sensitiveAdminEndpointRequiresAal2("results.individual.read")).toBe(
      false
    );
    expect(permissionRequiresAal2("results.individual.read")).toBe(false);
    expect(permissionRequiresAal2("dashboard.view")).toBe(false);
    expect(sensitiveAdminEndpointRequiresAal2("complaints.detail")).toBe(true);
    expect(permissionRequiresAal2("users.manage")).toBe(true);
  });

  it("NO_TIME_BASED_EXPIRATION +1/+7/+30/+90", () => {
    const r = assertNoTimeBasedCampaignExpiry(
      [1, 7, 30, 90],
      new Date("2026-08-10T12:00:00Z")
    );
    expect(r.ok).toBe(true);
    expect(r.samples.every((s) => s.code === "ok")).toBe(true);
  });
});
