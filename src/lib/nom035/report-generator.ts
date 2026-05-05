import type { RiskLevelNom035 } from "@/types/nom035";

export function generateExecutiveConclusion(input: {
  completedCount: number;
  dominantRiskLevel: RiskLevelNom035 | null;
  guiaIFollowUpCases: number;
}): string[] {
  const conclusions: string[] = [];

  if (input.completedCount === 0) {
    conclusions.push(
      "Aun no se cuenta con informacion suficiente para emitir conclusiones, ya que no existen evaluaciones completadas."
    );
    return conclusions;
  }

  if (input.dominantRiskLevel === "nulo" || input.dominantRiskLevel === "bajo") {
    conclusions.push(
      "Los resultados generales muestran un nivel de riesgo controlado en la evaluacion aplicada."
    );
  } else if (input.dominantRiskLevel === "medio") {
    conclusions.push(
      "Los resultados muestran areas que requieren acciones de prevencion y seguimiento organizacional."
    );
  } else {
    conclusions.push(
      "Los resultados muestran condiciones que requieren atencion prioritaria para disminuir factores de riesgo psicosocial."
    );
  }

  if (input.guiaIFollowUpCases > 0) {
    conclusions.push(
      "Se identificaron trabajadores que requieren seguimiento confidencial conforme a los criterios de la Guia I. La atencion de estos casos debera manejarse con reserva y por personal autorizado."
    );
  }

  return conclusions;
}

export function generateGeneralRecommendations(
  criticalDomains: Array<{ domain: string; recommendation: string }>
): string[] {
  if (criticalDomains.length === 0) {
    return [
      "Mantener el seguimiento periodico de factores psicosociales y reforzar medidas preventivas actuales.",
    ];
  }

  return criticalDomains.slice(0, 5).map((item) => item.recommendation);
}

export function generateInterventionPlan(): Array<{
  level: string;
  focus: string;
  action: string;
  owner: string;
}> {
  return [
    {
      level: "Primer nivel",
      focus: "Organizacional",
      action:
        "Revisar politicas, cargas de trabajo, comunicacion interna y mecanismos de prevencion.",
      owner: "Direccion y RH",
    },
    {
      level: "Segundo nivel",
      focus: "Grupal",
      action:
        "Realizar sesiones de sensibilizacion, talleres de liderazgo, manejo de conflictos y trabajo en equipo.",
      owner: "RH y lideres de area",
    },
    {
      level: "Tercer nivel",
      focus: "Individual confidencial",
      action:
        "Canalizar a seguimiento psicologico, medico o institucional cuando existan senales o criterios de atencion.",
      owner: "RH y personal autorizado",
    },
  ];
}
