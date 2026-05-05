import type { CompanyConfig, PolicyDocument } from "@/types/nom035";

export function generateBasePolicy(companySettings: CompanyConfig): {
  title: string;
  content: string;
  version: string;
} {
  const companyName = companySettings.legalName || companySettings.commercialName || "La empresa";
  return {
    title: `Politica de Prevencion de Riesgos Psicosociales - ${companyName}`,
    version: "1.0",
    content: `${companyName} establece la presente Politica de Prevencion de Riesgos Psicosociales con el compromiso de promover un entorno organizacional favorable, prevenir factores de riesgo psicosocial y prevenir actos de violencia laboral dentro del centro de trabajo.

La empresa se compromete a identificar, analizar y atender los factores que puedan afectar el bienestar psicosocial de las personas trabajadoras, asi como a promover condiciones de trabajo basadas en el respeto, la comunicacion, la participacion, la claridad de funciones y la mejora continua.

Queda prohibida cualquier forma de violencia laboral, incluyendo malos tratos, hostigamiento, acoso psicologico, humillaciones, exclusion, intimidacion o conductas que afecten la dignidad de las personas trabajadoras.

La empresa mantendra mecanismos confidenciales para recibir reportes o quejas relacionadas con practicas opuestas al entorno organizacional favorable o posibles actos de violencia laboral. Toda informacion recibida sera tratada con reserva por personal autorizado.

No se permitiran represalias contra ninguna persona trabajadora que participe en evaluaciones, presente reportes de buena fe o colabore en acciones de mejora.

La empresa promovera la participacion de las personas trabajadoras, la difusion de informacion, la capacitacion y sensibilizacion de mandos y equipos, asi como la revision periodica de acciones preventivas y correctivas.

Esta politica debera difundirse al personal y mantenerse disponible para consulta.

Responsabilidades generales:
- Personas trabajadoras: participar en acciones preventivas, mantener trato respetuoso y reportar situaciones de riesgo de buena fe.
- Mandos y lideres: promover un entorno de respeto, prevenir practicas de violencia laboral y dar seguimiento oportuno a reportes y acciones de mejora.
`,
  };
}

export function getPolicyStatusLabel(status: PolicyDocument["status"]): string {
  if (status === "publicada") return "Publicada";
  return "Borrador";
}
