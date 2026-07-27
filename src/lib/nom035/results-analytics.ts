import type { EvaluationRecord, RiskLevelNom035, Worker } from "@/types/nom035";

const RISK_ORDER: Record<RiskLevelNom035, number> = {
  nulo: 0,
  bajo: 1,
  medio: 2,
  alto: 3,
  muy_alto: 4,
};

const DOMAIN_RECOMMENDATIONS: Record<string, string> = {
  "Condiciones en el ambiente de trabajo":
    "Revisar condiciones fisicas, seguridad y riesgos del entorno.",
  "Carga de trabajo": "Revisar distribucion de tareas, pausas, cargas y ritmo de trabajo.",
  "Falta de control sobre el trabajo":
    "Incrementar claridad, autonomia, capacitacion y participacion del trabajador.",
  "Jornada de trabajo": "Revisar jornadas, descansos, horas extras y rotacion.",
  "Interferencia en la relación trabajo-familia":
    "Revisar horarios, limites y medidas de conciliacion.",
  Liderazgo: "Fortalecer comunicacion, claridad de funciones y capacitacion a mandos.",
  "Relaciones en el trabajo":
    "Fortalecer colaboracion, apoyo social y solucion de conflictos.",
  Violencia: "Revisar mecanismos de prevencion, atencion y denuncia de violencia laboral.",
};

function isMediumOrHigher(level: RiskLevelNom035): boolean {
  return level === "medio" || level === "alto" || level === "muy_alto";
}

function getLatestCompletedByWorker(records: EvaluationRecord[]): Map<string, EvaluationRecord> {
  const sorted = [...records]
    .filter((record) => record.status === "completed")
    .sort((a, b) => {
      const left = new Date(a.completedAt ?? a.submittedAtISO ?? 0).getTime();
      const right = new Date(b.completedAt ?? b.submittedAtISO ?? 0).getTime();
      return right - left;
    });

  const map = new Map<string, EvaluationRecord>();
  for (const record of sorted) {
    if (!map.has(record.workerId)) {
      map.set(record.workerId, record);
    }
  }
  return map;
}

export function getRiskDistribution(
  records: EvaluationRecord[]
): Record<RiskLevelNom035, number> {
  const distribution: Record<RiskLevelNom035, number> = {
    nulo: 0,
    bajo: 0,
    medio: 0,
    alto: 0,
    muy_alto: 0,
  };

  const latestCompleted = getLatestCompletedByWorker(records);
  for (const record of latestCompleted.values()) {
    const risk = record.guiaIIResult?.finalRiskLevel;
    if (!risk) continue;
    distribution[risk] += 1;
  }

  return distribution;
}

export function getDominantRiskLevel(records: EvaluationRecord[]): RiskLevelNom035 | null {
  const distribution = getRiskDistribution(records);
  const sorted = (Object.entries(distribution) as Array<[RiskLevelNom035, number]>).sort(
    (a, b) => b[1] - a[1]
  );
  if (sorted[0]?.[1] === 0) return null;
  return sorted[0][0];
}

export function getAverageGuiaIIScore(records: EvaluationRecord[]): number {
  const latestCompleted = getLatestCompletedByWorker(records);
  const values = Array.from(latestCompleted.values())
    .map((record) => record.guiaIIResult?.finalScore)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) return 0;
  const avg = values.reduce((acc, curr) => acc + curr, 0) / values.length;
  return Number(avg.toFixed(1));
}

export function getWorkerCriticalDomains(record: EvaluationRecord | undefined): string[] {
  if (!record?.guiaIIResult) return [];

  return Object.entries(record.guiaIIResult.domainScores)
    .filter(([, info]) => isMediumOrHigher(info.riskLevel))
    .sort((a, b) => {
      const riskDiff = RISK_ORDER[b[1].riskLevel] - RISK_ORDER[a[1].riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return b[1].score - a[1].score;
    })
    .slice(0, 3)
    .map(([domainName]) => domainName);
}

export function getCriticalDomains(records: EvaluationRecord[]): Array<{
  domain: string;
  workers: number;
  mostFrequentLevel: RiskLevelNom035;
  recommendation: string;
}> {
  const latestCompleted = getLatestCompletedByWorker(records);
  const counters = new Map<
    string,
    {
      workers: number;
      levels: Record<RiskLevelNom035, number>;
    }
  >();

  for (const record of latestCompleted.values()) {
    const domains = record.guiaIIResult?.domainScores ?? {};
    for (const [domainName, info] of Object.entries(domains)) {
      if (!isMediumOrHigher(info.riskLevel)) continue;
      const current = counters.get(domainName) ?? {
        workers: 0,
        levels: { nulo: 0, bajo: 0, medio: 0, alto: 0, muy_alto: 0 },
      };
      current.workers += 1;
      current.levels[info.riskLevel] += 1;
      counters.set(domainName, current);
    }
  }

  return Array.from(counters.entries())
    .map(([domain, info]) => {
      const mostFrequentLevel = (
        Object.entries(info.levels) as Array<[RiskLevelNom035, number]>
      ).sort((a, b) => b[1] - a[1])[0][0];

      return {
        domain,
        workers: info.workers,
        mostFrequentLevel,
        recommendation: DOMAIN_RECOMMENDATIONS[domain] ?? "Revisar factores asociados al dominio.",
      };
    })
    .sort((a, b) => b.workers - a.workers);
}

export function getDepartmentSummaries(
  records: EvaluationRecord[],
  workers: Worker[]
): Array<{
  department: string;
  evaluatedWorkers: number;
  averageGuiaIIScore: number;
  predominantRiskLevel: RiskLevelNom035 | null;
  criticalDomains: string;
  guiaIFollowUpCases: number;
}> {
  const latestCompleted = getLatestCompletedByWorker(records);
  const byDepartment = new Map<
    string,
    {
      records: EvaluationRecord[];
      guiaISeguimiento: number;
      riskCount: Record<RiskLevelNom035, number>;
      domainCount: Record<string, number>;
      totalScore: number;
      scoreCount: number;
    }
  >();

  for (const worker of workers) {
    const record = latestCompleted.get(worker.id);
    if (!record) continue;

    const bucket = byDepartment.get(worker.department) ?? {
      records: [],
      guiaISeguimiento: 0,
      riskCount: { nulo: 0, bajo: 0, medio: 0, alto: 0, muy_alto: 0 },
      domainCount: {},
      totalScore: 0,
      scoreCount: 0,
    };

    bucket.records.push(record);
    if (record.guiaIResult?.riskLabel === "requiere_seguimiento_confidencial") {
      bucket.guiaISeguimiento += 1;
    }

    const risk = record.guiaIIResult?.finalRiskLevel;
    if (risk) bucket.riskCount[risk] += 1;

    const score = record.guiaIIResult?.finalScore;
    if (typeof score === "number") {
      bucket.totalScore += score;
      bucket.scoreCount += 1;
    }

    const critical = getWorkerCriticalDomains(record);
    for (const domain of critical) {
      bucket.domainCount[domain] = (bucket.domainCount[domain] ?? 0) + 1;
    }

    byDepartment.set(worker.department, bucket);
  }

  return Array.from(byDepartment.entries())
    .map(([department, bucket]) => {
      const predominantRiskLevel = (
        Object.entries(bucket.riskCount) as Array<[RiskLevelNom035, number]>
      ).sort((a, b) => b[1] - a[1])[0];

      const criticalDomains = Object.entries(bucket.domainCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name]) => name)
        .join(", ");

      return {
        department,
        evaluatedWorkers: bucket.records.length,
        averageGuiaIIScore:
          bucket.scoreCount > 0 ? Number((bucket.totalScore / bucket.scoreCount).toFixed(1)) : 0,
        predominantRiskLevel:
          predominantRiskLevel && predominantRiskLevel[1] > 0 ? predominantRiskLevel[0] : null,
        criticalDomains: criticalDomains || "Sin dominios criticos",
        guiaIFollowUpCases: bucket.guiaISeguimiento,
      };
    })
    .sort((a, b) => b.evaluatedWorkers - a.evaluatedWorkers);
}
