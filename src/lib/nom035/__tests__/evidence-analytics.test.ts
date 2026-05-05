import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "@/types/nom035";
import { getEvidenceChecklist, getEvidenceStats, getEvidenceTypeLabel } from "../evidence-analytics";

const baseItem = (type: EvidenceItem["evidenceType"], id: string): EvidenceItem => ({
  id,
  campaignId: "camp-1",
  title: `Item ${id}`,
  evidenceType: type,
  description: "desc",
  fileName: "",
  fileUrl: "",
  notes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("evidence-analytics", () => {
  it("getEvidenceTypeLabel devuelve etiqueta", () => {
    expect(getEvidenceTypeLabel("plan_accion")).toBe("Plan de accion");
  });

  it("getEvidenceStats calcula conteos", () => {
    const items = [
      baseItem("politica", "1"),
      baseItem("reporte", "2"),
      baseItem("resultados", "3"),
      baseItem("plan_accion", "4"),
      baseItem("difusion", "5"),
    ];
    const stats = getEvidenceStats(items);
    expect(stats.total).toBe(5);
    expect(stats.politica).toBe(1);
    expect(stats.resultadosReportes).toBe(2);
    expect(stats.planAccion).toBe(1);
    expect(stats.capacitacionDifusion).toBe(1);
  });

  it("getEvidenceChecklist marca completos segun tipo", () => {
    const items = [
      baseItem("politica", "1"),
      baseItem("difusion", "2"),
      baseItem("resultados", "3"),
      baseItem("plan_accion", "4"),
    ];
    const checklist = getEvidenceChecklist(items);
    expect(checklist.find((item) => item.key === "politica")?.completed).toBe(true);
    expect(checklist.find((item) => item.key === "quejas")?.completed).toBe(false);
  });
});
