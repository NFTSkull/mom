import type { EvidenceItem } from "@/types/nom035";

export function getEvidenceTypeLabel(type: EvidenceItem["evidenceType"]): string {
  const labels: Record<EvidenceItem["evidenceType"], string> = {
    politica: "Politica",
    difusion: "Difusion",
    resultados: "Resultados",
    reporte: "Reporte",
    capacitacion: "Capacitacion",
    plan_accion: "Plan de accion",
    quejas: "Quejas",
    canalizacion: "Canalizacion",
    otro: "Otro",
  };
  return labels[type];
}

export function getEvidenceStats(items: EvidenceItem[]) {
  return {
    total: items.length,
    politica: items.filter((item) => item.evidenceType === "politica").length,
    resultadosReportes: items.filter((item) => item.evidenceType === "resultados" || item.evidenceType === "reporte")
      .length,
    planAccion: items.filter((item) => item.evidenceType === "plan_accion").length,
    capacitacionDifusion: items.filter(
      (item) => item.evidenceType === "capacitacion" || item.evidenceType === "difusion"
    ).length,
  };
}

export function getEvidenceChecklist(items: EvidenceItem[]) {
  const hasType = (type: EvidenceItem["evidenceType"]): boolean =>
    items.some((item) => item.evidenceType === type);

  return [
    { key: "politica", label: "Politica de prevencion registrada", completed: hasType("politica") },
    { key: "difusion", label: "Evidencia de difusion registrada", completed: hasType("difusion") },
    {
      key: "reporte",
      label: "Reporte de resultados registrado",
      completed: hasType("resultados") || hasType("reporte"),
    },
    { key: "plan_accion", label: "Plan de accion registrado", completed: hasType("plan_accion") },
    { key: "capacitacion", label: "Evidencia de capacitacion registrada", completed: hasType("capacitacion") },
    { key: "quejas", label: "Mecanismo de quejas documentado", completed: hasType("quejas") },
    { key: "canalizacion", label: "Canalizaciones documentadas, si aplica", completed: hasType("canalizacion") },
  ];
}
