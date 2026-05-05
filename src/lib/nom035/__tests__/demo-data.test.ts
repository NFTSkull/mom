import { describe, expect, it } from "vitest";
import { computeNom035LocalDataStatus } from "../demo-data-utils";

describe("demo-data", () => {
  it("marca hasData en verdadero cuando hay datos operativos", () => {
    const status = computeNom035LocalDataStatus({
      activeWorkers: 5,
      activeCampaignName: "Campaña demo",
      completedEvaluations: 0,
      pendingEvaluations: 5,
      dominantGuiaIIRisk: "sin_datos",
      pendingActionPlans: 0,
      complaintsCount: 0,
      evidencesCount: 0,
      publishedPolicy: false,
    });
    expect(status.hasData).toBe(true);
  });

  it("marca hasData en falso cuando no hay datos", () => {
    const status = computeNom035LocalDataStatus({
      activeWorkers: 0,
      activeCampaignName: "Sin campaña activa",
      completedEvaluations: 0,
      pendingEvaluations: 0,
      dominantGuiaIIRisk: "sin_datos",
      pendingActionPlans: 0,
      complaintsCount: 0,
      evidencesCount: 0,
      publishedPolicy: false,
    });
    expect(status.hasData).toBe(false);
  });
});
