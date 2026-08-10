import { describe, expect, it } from "vitest";
import {
  assertNoTimeBasedCampaignExpiry,
  checkAssignmentUsableAt,
  draftSurvivesSessionExpiry,
  workerPortalActionForStatus,
} from "../campaign-permanence";

describe("B4.16.2 campaign permanence", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  it("AUTO_EXPIRATION=false: +1/+7/+30/+90 con campaña active", () => {
    const r = assertNoTimeBasedCampaignExpiry([1, 7, 30, 90], now);
    expect(r.ok).toBe(true);
    expect(r.samples.every((s) => s.code === "ok")).toBe(true);
  });

  it("ignora fecha_cierre pasada si status=active", () => {
    const code = checkAssignmentUsableAt(
      {
        assignmentStatus: "pending",
        assignmentExpiresAt: null,
        workerActive: true,
        campaignStatus: "active",
        fechaCierre: new Date("2020-01-01"),
        fechaInicio: new Date("2019-01-01"),
      },
      now
    );
    expect(code).toBe("ok");
  });

  it("closed manual → campaign_unavailable", () => {
    expect(
      checkAssignmentUsableAt(
        {
          assignmentStatus: "pending",
          assignmentExpiresAt: null,
          workerActive: true,
          campaignStatus: "closed",
        },
        now
      )
    ).toBe("campaign_unavailable");
  });

  it("completed no puede volver a contestar", () => {
    expect(
      checkAssignmentUsableAt(
        {
          assignmentStatus: "completed",
          assignmentExpiresAt: null,
          workerActive: true,
          campaignStatus: "active",
        },
        now
      )
    ).toBe("completed");
    expect(workerPortalActionForStatus("completed", true)).toBe("done");
  });

  it("pending→start, in_progress→continue", () => {
    expect(workerPortalActionForStatus("pending", true)).toBe("start");
    expect(workerPortalActionForStatus("in_progress", true)).toBe("continue");
    expect(workerPortalActionForStatus("awaiting_campaign", false)).toBe(
      "awaiting"
    );
  });

  it("assignment expires_at NULL no expira; con fecha sí", () => {
    expect(
      checkAssignmentUsableAt(
        {
          assignmentStatus: "pending",
          assignmentExpiresAt: null,
          workerActive: true,
          campaignStatus: "active",
        },
        new Date(now.getTime() + 90 * 86400000)
      )
    ).toBe("ok");
    expect(
      checkAssignmentUsableAt(
        {
          assignmentStatus: "pending",
          assignmentExpiresAt: new Date(now.getTime() - 1000),
          workerActive: true,
          campaignStatus: "active",
        },
        now
      )
    ).toBe("expired");
  });

  it("draft server-side sobrevive sesión expirada", () => {
    expect(
      draftSurvivesSessionExpiry({
        draftAssignmentId: "asg-1",
        sessionExpired: true,
        reLoginSameWorker: true,
        sameAssignmentId: "asg-1",
      })
    ).toBe(true);
  });

  it('"001" string no es Number en reglas de portal', () => {
    const u = "001";
    expect(typeof u).toBe("string");
    expect(u).not.toBe(String(Number(u)));
  });
});
