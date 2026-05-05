"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getRequiredQuestionnaires } from "@/lib/nom035/get-required-questionnaires";
import {
  getAverageGuiaIIScore,
  getCriticalDomains,
  getDepartmentSummaries,
  getDominantRiskLevel,
  getRiskDistribution,
} from "@/lib/nom035/results-analytics";
import {
  generateExecutiveConclusion,
  generateGeneralRecommendations,
  generateInterventionPlan,
} from "@/lib/nom035/report-generator";
import {
  getCampaignsLocal,
  getCompanyConfigLocal,
  getEvaluationRecordsLocal,
  getWorkersLocal,
  seedNom035LocalData,
} from "@/lib/nom035/storage-local";
import type { Campaign, CompanyConfig, EvaluationRecord, RiskLevelNom035, Worker } from "@/types/nom035";

interface ReportSnapshot {
  company: CompanyConfig;
  activeCampaign: Campaign | null;
  workers: Worker[];
  records: EvaluationRecord[];
  generatedAtISO: string;
  requiredQuestionnaires: Array<"GUIA_I" | "GUIA_II" | "GUIA_III">;
}

function mapRiskLabel(value: RiskLevelNom035 | null): string {
  if (!value) return "Sin datos";
  if (value === "nulo") return "Nulo";
  if (value === "bajo") return "Bajo";
  if (value === "medio") return "Medio";
  if (value === "alto") return "Alto";
  return "Muy alto";
}

function formatISODate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX");
}

export default function AdminReportesPage() {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [responsableNombre, setResponsableNombre] = useState("Responsable RH");
  const [responsableCargo, setResponsableCargo] = useState("Coordinacion de Recursos Humanos");
  const [responsableCedula, setResponsableCedula] = useState("");
  const [responsableFecha, setResponsableFecha] = useState(
    new Date().toISOString().slice(0, 10)
  );

  function loadData(): void {
    seedNom035LocalData();
    const company = getCompanyConfigLocal();
    const campaigns = getCampaignsLocal();
    const activeCampaign = campaigns[0] ?? null;
    const workers = getWorkersLocal();
    const records = getEvaluationRecordsLocal();
    const requiredQuestionnaires = getRequiredQuestionnaires(company.employeeCount);

    setSnapshot({
      company,
      activeCampaign,
      workers,
      records,
      generatedAtISO: new Date().toISOString(),
      requiredQuestionnaires,
    });
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadData();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const showSkeleton = !mounted || !snapshot;

  const assignedWorkers = useMemo(() => {
    if (!snapshot) return [];
    if (!snapshot.activeCampaign) return snapshot.workers;
    return snapshot.workers.filter((worker) =>
      snapshot.activeCampaign?.workerIds.includes(worker.id)
    );
  }, [snapshot]);

  const latestRecordByWorker = useMemo(() => {
    if (!snapshot) return new Map<string, EvaluationRecord>();
    const sorted = [...snapshot.records].sort((a, b) => {
      const left = new Date(a.completedAt ?? a.submittedAtISO ?? 0).getTime();
      const right = new Date(b.completedAt ?? b.submittedAtISO ?? 0).getTime();
      return right - left;
    });
    const map = new Map<string, EvaluationRecord>();
    for (const record of sorted) {
      if (!map.has(record.workerId)) map.set(record.workerId, record);
    }
    return map;
  }, [snapshot]);

  const completedRecords = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.records.filter((record) => record.status === "completed");
  }, [snapshot]);

  const totalAssigned = assignedWorkers.length;
  const completedCount = assignedWorkers.filter(
    (worker) => latestRecordByWorker.get(worker.id)?.status === "completed"
  ).length;
  const pendingCount = totalAssigned - completedCount;
  const participationPct = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
  const guiaISinAlerta = completedRecords.filter(
    (record) => record.guiaIResult?.riskLabel === "sin_alerta"
  ).length;
  const guiaISeguimiento = completedRecords.filter(
    (record) => record.guiaIResult?.riskLabel === "requiere_seguimiento_confidencial"
  ).length;

  const dominantRisk = getDominantRiskLevel(completedRecords);
  const avgScore = getAverageGuiaIIScore(completedRecords);
  const riskDistribution = getRiskDistribution(completedRecords);
  const departmentSummaries = getDepartmentSummaries(completedRecords, assignedWorkers);
  const criticalDomains = getCriticalDomains(completedRecords);
  const conclusions = generateExecutiveConclusion({
    completedCount,
    dominantRiskLevel: dominantRisk,
    guiaIFollowUpCases: guiaISeguimiento,
  });
  const recommendations = generateGeneralRecommendations(criticalDomains);
  const interventionPlan = generateInterventionPlan();

  return (
    <section className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Imprimir / Guardar como PDF
        </button>
        <button
          type="button"
          onClick={loadData}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Actualizar datos
        </button>
        <Link
          href="/admin/resultados"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Volver a resultados
        </Link>
      </div>

      {showSkeleton ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      ) : (
        <article className="report-doc space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <header className="page-break-after space-y-2 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Informe de Evaluacion NOM-035-STPS-2018
            </h1>
            <p className="text-slate-700">Factores de riesgo psicosocial en el trabajo</p>
            <p className="text-sm text-slate-700">
              Empresa: {snapshot?.company.legalName}
            </p>
            <p className="text-sm text-slate-700">
              Campana evaluada: {snapshot?.activeCampaign?.name ?? "Sin campana activa"}
            </p>
            <p className="text-sm text-slate-700">
              Fecha de generacion: {formatISODate(snapshot?.generatedAtISO)}
            </p>
            <p className="text-sm text-slate-700">
              Periodo de evaluacion: {formatISODate(snapshot?.activeCampaign?.startsAtISO)} al{" "}
              {formatISODate(snapshot?.activeCampaign?.endsAtISO)}
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Datos del centro de trabajo</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-sm text-slate-700">
                <strong>Razon social:</strong> {snapshot?.company.legalName}
              </p>
              <p className="text-sm text-slate-700">
                <strong>RFC:</strong> {snapshot?.company.rfc || "-"}
              </p>
              <p className="text-sm text-slate-700">
                <strong>Domicilio:</strong> {snapshot?.company.address || "-"}
              </p>
              <p className="text-sm text-slate-700">
                <strong>Telefono:</strong> {snapshot?.company.phone || "-"}
              </p>
              <p className="text-sm text-slate-700">
                <strong>Actividad principal:</strong> {snapshot?.company.mainActivity || "-"}
              </p>
              <p className="text-sm text-slate-700">
                <strong>Total de trabajadores:</strong> {snapshot?.company.employeeCount ?? 0}
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Objetivo</h2>
            <p className="text-sm text-slate-700">
              Identificar y analizar los factores de riesgo psicosocial en el trabajo, asi como
              determinar el nivel de riesgo resultante de la evaluacion aplicada, con el fin de
              establecer recomendaciones y acciones de prevencion, control e intervencion.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Alcance</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Numero de trabajadores asignados: {totalAssigned}</li>
              <li>Numero de evaluaciones completadas: {completedCount}</li>
              <li>Porcentaje de participacion: {participationPct}%</li>
              <li>
                Guias aplicadas: Guia I
                {snapshot?.requiredQuestionnaires.includes("GUIA_II") ? " y Guia II" : ""}
              </li>
              <li>
                Forma de aplicacion: Aplicacion digital mediante enlace individual por trabajador.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Metodo utilizado</h2>
            <p className="text-sm text-slate-700">
              El metodo utilizado corresponde a las Guias de Referencia de la NOM-035-STPS-2018
              implementadas en formato digital. Las respuestas fueron registradas de forma
              individual y los resultados se presentan de manera agregada para fines de analisis
              organizacional.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>La Guia I identifica posibles acontecimientos traumaticos severos.</li>
              <li>La Guia II identifica y analiza factores de riesgo psicosocial.</li>
              <li>No se muestran respuestas individuales pregunta por pregunta.</li>
            </ul>
          </section>

          <section className="page-break-before space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Resultados generales</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Completadas</p>
                <p className="text-xl font-semibold">{completedCount}</p>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Pendientes</p>
                <p className="text-xl font-semibold">{pendingCount}</p>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Avance</p>
                <p className="text-xl font-semibold">{participationPct}%</p>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Puntaje promedio Guia II
                </p>
                <p className="text-xl font-semibold">{avgScore}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              Guia I - Sin alerta: {guiaISinAlerta} | Requieren seguimiento confidencial:{" "}
              {guiaISeguimiento}
            </p>
            <p className="text-sm text-slate-700">
              Guia II - Riesgo predominante: {mapRiskLabel(dominantRisk)}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm text-slate-800">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nivel</th>
                    <th className="px-3 py-2 font-semibold">Conteo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2">Nulo</td>
                    <td className="px-3 py-2">{riskDistribution.nulo}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2">Bajo</td>
                    <td className="px-3 py-2">{riskDistribution.bajo}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2">Medio</td>
                    <td className="px-3 py-2">{riskDistribution.medio}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2">Alto</td>
                    <td className="px-3 py-2">{riskDistribution.alto}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2">Muy alto</td>
                    <td className="px-3 py-2">{riskDistribution.muy_alto}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Resultados por departamento</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm text-slate-800">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Departamento</th>
                    <th className="px-3 py-2 font-semibold">Trabajadores evaluados</th>
                    <th className="px-3 py-2 font-semibold">Puntaje promedio Guia II</th>
                    <th className="px-3 py-2 font-semibold">Riesgo predominante</th>
                    <th className="px-3 py-2 font-semibold">Dominios criticos</th>
                    <th className="px-3 py-2 font-semibold">
                      Seguimiento confidencial Guia I
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departmentSummaries.map((row) => (
                    <tr key={row.department} className="border-t border-slate-200">
                      <td className="px-3 py-2">{row.department}</td>
                      <td className="px-3 py-2">{row.evaluatedWorkers}</td>
                      <td className="px-3 py-2">{row.averageGuiaIIScore}</td>
                      <td className="px-3 py-2">{mapRiskLabel(row.predominantRiskLevel)}</td>
                      <td className="px-3 py-2">{row.criticalDomains}</td>
                      <td className="px-3 py-2">{row.guiaIFollowUpCases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Dominios con mayor atencion requerida
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm text-slate-800">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Dominio</th>
                    <th className="px-3 py-2 font-semibold">
                      Trabajadores en riesgo medio/alto/muy alto
                    </th>
                    <th className="px-3 py-2 font-semibold">Nivel mas frecuente</th>
                    <th className="px-3 py-2 font-semibold">Recomendacion</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalDomains.map((domain) => (
                    <tr key={domain.domain} className="border-t border-slate-200">
                      <td className="px-3 py-2">{domain.domain}</td>
                      <td className="px-3 py-2">{domain.workers}</td>
                      <td className="px-3 py-2">{mapRiskLabel(domain.mostFrequentLevel)}</td>
                      <td className="px-3 py-2">{domain.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Conclusiones</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {conclusions.map((line, index) => (
                <li key={`conclusion-${index}`}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Recomendaciones generales</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {recommendations.map((line, index) => (
                <li key={`recommendation-${index}`}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Plan de intervencion sugerido</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm text-slate-800">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nivel de accion</th>
                    <th className="px-3 py-2 font-semibold">Enfoque</th>
                    <th className="px-3 py-2 font-semibold">Accion sugerida</th>
                    <th className="px-3 py-2 font-semibold">Responsable sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {interventionPlan.map((row) => (
                    <tr key={row.level} className="border-t border-slate-200">
                      <td className="px-3 py-2">{row.level}</td>
                      <td className="px-3 py-2">{row.focus}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td className="px-3 py-2">{row.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-4">
            <h2 className="text-lg font-semibold text-slate-900">Datos del responsable de la evaluacion</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Nombre del responsable
                <input
                  value={responsableNombre}
                  onChange={(event) => setResponsableNombre(event.target.value)}
                  className="no-print mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="print-only block text-slate-900">{responsableNombre}</span>
              </label>
              <label className="text-sm text-slate-700">
                Cargo
                <input
                  value={responsableCargo}
                  onChange={(event) => setResponsableCargo(event.target.value)}
                  className="no-print mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="print-only block text-slate-900">{responsableCargo}</span>
              </label>
              <label className="text-sm text-slate-700">
                Cedula profesional (opcional)
                <input
                  value={responsableCedula}
                  onChange={(event) => setResponsableCedula(event.target.value)}
                  className="no-print mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="print-only block text-slate-900">{responsableCedula || "-"}</span>
              </label>
              <label className="text-sm text-slate-700">
                Fecha
                <input
                  type="date"
                  value={responsableFecha}
                  onChange={(event) => setResponsableFecha(event.target.value)}
                  className="no-print mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="print-only block text-slate-900">{responsableFecha}</span>
              </label>
            </div>
          </section>
        </article>
      )}

      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          .admin-nav,
          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          body {
            background: #fff !important;
            color: #000 !important;
          }

          .report-doc {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }

          table,
          tr,
          td,
          th {
            page-break-inside: avoid;
          }

          .page-break-before {
            page-break-before: always;
          }

          .page-break-after {
            page-break-after: avoid;
          }
        }
      `}</style>
    </section>
  );
}
