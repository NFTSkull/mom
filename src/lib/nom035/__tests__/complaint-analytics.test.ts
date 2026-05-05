import { describe, expect, it } from "vitest";
import type { ConfidentialComplaint } from "@/types/nom035";
import {
  generateComplaintFolio,
  getComplaintStats,
  getComplaintStatusLabel,
  getComplaintTypeLabel,
} from "../complaint-analytics";

const baseComplaint = (id: string, status: ConfidentialComplaint["status"]): ConfidentialComplaint => ({
  id,
  folio: `NOM035-Q-2026-000${id}`,
  complaintType: "violencia_laboral",
  description: "desc",
  isAnonymous: true,
  status,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("complaint-analytics", () => {
  it("etiquetas de tipo y estado", () => {
    expect(getComplaintTypeLabel("entorno_organizacional")).toBe("Entorno organizacional");
    expect(getComplaintStatusLabel("en_revision")).toBe("En revision");
  });

  it("estadisticas por estado", () => {
    const stats = getComplaintStats([
      baseComplaint("1", "recibida"),
      baseComplaint("2", "en_revision"),
      baseComplaint("3", "resuelta"),
      baseComplaint("4", "cerrada"),
    ]);
    expect(stats.total).toBe(4);
    expect(stats.recibidas).toBe(1);
    expect(stats.enRevision).toBe(1);
    expect(stats.resueltas).toBe(1);
    expect(stats.cerradas).toBe(1);
  });

  it("genera folio incremental", () => {
    const folio = generateComplaintFolio([
      { ...baseComplaint("1", "recibida"), folio: "NOM035-Q-2026-0001" },
      { ...baseComplaint("2", "recibida"), folio: "NOM035-Q-2026-0003" },
    ]);
    expect(folio).toBe("NOM035-Q-2026-0004");
  });
});
