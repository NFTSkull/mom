import type { Campaign } from "@/types/nom035";

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "campaign-001",
    name: "Piloto NOM-035 Mayo 2026",
    startsAtISO: "2026-05-01T08:00:00.000Z",
    endsAtISO: "2026-05-31T23:59:59.000Z",
    questionnaireTypes: ["GUIA_I"],
    workerIds: ["worker-001", "worker-002", "worker-003"],
  },
];
