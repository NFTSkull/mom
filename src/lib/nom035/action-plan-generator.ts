import { getCriticalDomains } from "./results-analytics";
import type { ActionPlanItem, EvaluationRecord, RiskLevelNom035 } from "../../types/nom035";

type SuggestedAction = Omit<ActionPlanItem, "id" | "createdAt" | "updatedAt">;

const DOMAIN_ACTIONS: Record<
  string,
  {
    actionLevel: SuggestedAction["actionLevel"];
    actionType: SuggestedAction["actionType"];
    description: string;
    area: string;
  }
> = {
  "Carga de trabajo": {
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar distribucion de tareas, pausas, cargas y ritmo de trabajo.",
    area: "Operaciones",
  },
  Liderazgo: {
    actionLevel: "segundo_nivel",
    actionType: "grupal",
    description: "Fortalecer comunicacion, claridad de funciones y capacitacion a mandos.",
    area: "Mandos medios",
  },
  Violencia: {
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description:
      "Revisar y difundir mecanismos de prevencion, atencion y denuncia de violencia laboral.",
    area: "RH",
  },
  "Interferencia en la relación trabajo-familia": {
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar horarios, limites de jornada y medidas de conciliacion.",
    area: "RH",
  },
  "Jornada de trabajo": {
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar jornadas, descansos, horas extras y rotacion de turnos.",
    area: "Operaciones",
  },
  "Falta de control sobre el trabajo": {
    actionLevel: "segundo_nivel",
    actionType: "grupal",
    description: "Incrementar claridad, autonomia, capacitacion y participacion del trabajador.",
    area: "Mandos medios",
  },
  "Condiciones en el ambiente de trabajo": {
    actionLevel: "primer_nivel",
    actionType: "organizacional",
    description: "Revisar condiciones fisicas, seguridad y riesgos del entorno.",
    area: "Seguridad e Higiene",
  },
  "Relaciones en el trabajo": {
    actionLevel: "segundo_nivel",
    actionType: "grupal",
    description: "Fortalecer colaboracion, apoyo social y solucion de conflictos.",
    area: "RH",
  },
};

export function isActionOverdue(action: ActionPlanItem, nowISO = new Date().toISOString()): boolean {
  if (action.status === "completada" || action.status === "cancelada") return false;
  return new Date(action.dueDate).getTime() < new Date(nowISO).getTime();
}

export function getActionPlanStats(actions: ActionPlanItem[], nowISO = new Date().toISOString()) {
  const total = actions.length;
  const pendientes = actions.filter((item) => item.status === "pendiente").length;
  const enProceso = actions.filter((item) => item.status === "en_proceso").length;
  const completadas = actions.filter((item) => item.status === "completada").length;
  const vencidas = actions.filter((item) => isActionOverdue(item, nowISO)).length;
  return { total, pendientes, enProceso, completadas, vencidas };
}

function addDaysISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dedupeKey(input: {
  campaignId: string;
  area: string;
  riskFactor: string;
  actionType: SuggestedAction["actionType"];
}): string {
  return `${input.campaignId}::${input.area}::${input.riskFactor}::${input.actionType}`;
}

function normalizeDomainRisk(level: RiskLevelNom035): RiskLevelNom035 {
  if (level === "nulo" || level === "bajo") return "medio";
  return level;
}

export function generateSuggestedActionsFromResults(input: {
  campaignId: string;
  records: EvaluationRecord[];
  existingActions: ActionPlanItem[];
  responsibleDefault?: string;
}): SuggestedAction[] {
  const existingSet = new Set(
    input.existingActions.map((item) =>
      dedupeKey({
        campaignId: item.campaignId,
        area: item.area,
        riskFactor: item.riskFactor,
        actionType: item.actionType,
      })
    )
  );

  const suggested: SuggestedAction[] = [];
  const criticalDomains = getCriticalDomains(input.records);

  for (const domain of criticalDomains) {
    const config = DOMAIN_ACTIONS[domain.domain];
    if (!config) continue;

    const candidate: SuggestedAction = {
      campaignId: input.campaignId,
      area: config.area,
      riskFactor: domain.domain,
      riskLevel: normalizeDomainRisk(domain.mostFrequentLevel),
      actionLevel: config.actionLevel,
      actionType: config.actionType,
      description: config.description,
      responsible: input.responsibleDefault ?? "RH",
      dueDate: addDaysISO(30),
      status: "pendiente",
      followUpNotes: "",
    };

    const key = dedupeKey({
      campaignId: candidate.campaignId,
      area: candidate.area,
      riskFactor: candidate.riskFactor,
      actionType: candidate.actionType,
    });
    if (!existingSet.has(key)) {
      suggested.push(candidate);
      existingSet.add(key);
    }
  }

  const guiaIFollowUp = input.records.some(
    (record) => record.guiaIResult?.riskLabel === "requiere_seguimiento_confidencial"
  );

  if (guiaIFollowUp) {
    const followUpAction: SuggestedAction = {
      campaignId: input.campaignId,
      area: "RH",
      riskFactor: "Seguimiento confidencial Guia I",
      riskLevel: "medio",
      actionLevel: "tercer_nivel",
      actionType: "individual_confidencial",
      description:
        "Canalizar a seguimiento psicologico, medico o institucional por personal autorizado.",
      responsible: input.responsibleDefault ?? "RH",
      dueDate: addDaysISO(15),
      status: "pendiente",
      followUpNotes: "",
    };

    const key = dedupeKey({
      campaignId: followUpAction.campaignId,
      area: followUpAction.area,
      riskFactor: followUpAction.riskFactor,
      actionType: followUpAction.actionType,
    });
    if (!existingSet.has(key)) {
      suggested.push(followUpAction);
      existingSet.add(key);
    }
  }

  return suggested;
}
