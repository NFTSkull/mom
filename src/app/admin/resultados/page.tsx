"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCampaignsLocal,
  getCompanyConfigLocal,
  getEvaluationRecordsLocal,
  getWorkersLocal,
  seedNom035LocalData,
} from "@/lib/nom035/storage-local";
import { getRequiredQuestionnaires } from "@/lib/nom035/get-required-questionnaires";
import {
  getAverageGuiaIIScore,
  getCriticalDomains,
  getDepartmentSummaries,
  getDominantRiskLevel,
  getRiskDistribution,
  getWorkerCriticalDomains,
} from "@/lib/nom035/results-analytics";
import type { Campaign, EvaluationRecord, RiskLevelNom035, Worker } from "@/types/nom035";

interface ResultadosSnapshot {
  workers: Worker[];
  records: EvaluationRecord[];
  activeCampaign: Campaign | null;
  showGuiaIIIPending: boolean;
  cutoffISO: string;
}

interface WorkerDashboardRow {
  workerId: string;
  trabajador: string;
  departamento: string;
  estado: "Pendiente" | "En progreso" | "Completada";
  guiaI: "Sin alerta" | "Requiere seguimiento confidencial" | "-";
  guiaIIRisk: RiskLevelNom035 | null;
  guiaIIScore: number | null;
  dominiosCriticos: string[];
  fechaFinalizacion: string | null;
}

function mapGuiaIIRiskLabel(risk: RiskLevelNom035 | null): string {
  if (!risk) return "-";
  if (risk === "nulo") return "Nulo";
  if (risk === "bajo") return "Bajo";
  if (risk === "medio") return "Medio";
  if (risk === "alto") return "Alto";
  return "Muy alto";
}

function mapDominantRiskLabel(risk: RiskLevelNom035 | null): string {
  if (!risk) return "Sin datos";
  return mapGuiaIIRiskLabel(risk);
}

function mapRiskFilterValue(value: string): RiskLevelNom035 | null {
  if (value === "all" || value === "sin_datos") return null;
  return value as RiskLevelNom035;
}

function statusFromRecord(record: EvaluationRecord | undefined): "Pendiente" | "En progreso" | "Completada" {
  if (!record) return "Pendiente";
  if (record.status === "completed") return "Completada";
  if (record.status === "in_progress") return "En progreso";
  if ((record.responses.length ?? 0) > 0) return "En progreso";
  return "Pendiente";
}

export default function AdminResultadosPage() {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<ResultadosSnapshot | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [reportMessage, setReportMessage] = useState("");

  function loadSnapshot(): void {
    seedNom035LocalData();
    const company = getCompanyConfigLocal();
    const questionnaires = getRequiredQuestionnaires(company.employeeCount);

    setSnapshot({
      workers: getWorkersLocal(),
      records: getEvaluationRecordsLocal(),
      activeCampaign: getCampaignsLocal()[0] ?? null,
      showGuiaIIIPending: questionnaires.includes("GUIA_III"),
      cutoffISO: new Date().toISOString(),
    });
    setMounted(true);
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadSnapshot();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const showSkeleton = !mounted || !snapshot;

  const assignedWorkers = useMemo(() => {
    if (!snapshot) return [];
    if (!snapshot.activeCampaign) return snapshot.workers;
    return snapshot.workers.filter((worker) => snapshot.activeCampaign?.workerIds.includes(worker.id));
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
      if (!map.has(record.workerId)) {
        map.set(record.workerId, record);
      }
    }
    return map;
  }, [snapshot]);

  const completedRecords = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.records.filter((record) => record.status === "completed");
  }, [snapshot]);

  const workerRows = useMemo<WorkerDashboardRow[]>(() => {
    return assignedWorkers.map((worker) => {
      const record = latestRecordByWorker.get(worker.id);
      const isCompleted = record?.status === "completed" ? record : undefined;
      const criticalDomains = getWorkerCriticalDomains(isCompleted);

      return {
        workerId: worker.id,
        trabajador: worker.fullName,
        departamento: worker.department,
        estado: statusFromRecord(record),
        guiaI:
          isCompleted?.guiaIResult?.riskLabel === "sin_alerta"
            ? "Sin alerta"
            : isCompleted?.guiaIResult?.riskLabel === "requiere_seguimiento_confidencial"
              ? "Requiere seguimiento confidencial"
              : "-",
        guiaIIRisk: isCompleted?.guiaIIResult?.finalRiskLevel ?? null,
        guiaIIScore: isCompleted?.guiaIIResult?.finalScore ?? null,
        dominiosCriticos: criticalDomains,
        fechaFinalizacion: isCompleted?.completedAt ?? null,
      };
    });
  }, [assignedWorkers, latestRecordByWorker]);

  const filteredRows = useMemo(() => {
    return workerRows.filter((row) => {
      const departmentOk = departmentFilter === "all" || row.departamento === departmentFilter;
      const statusOk = statusFilter === "all" || row.estado === statusFilter;
      const risk = mapRiskFilterValue(riskFilter);
      const riskOk = riskFilter === "all" || (risk === null ? row.guiaIIRisk === null : row.guiaIIRisk === risk);
      return departmentOk && statusOk && riskOk;
    });
  }, [workerRows, departmentFilter, statusFilter, riskFilter]);

  const totalAssigned = assignedWorkers.length;
  const completedCount = workerRows.filter((row) => row.estado === "Completada").length;
  const pendingCount = workerRows.filter((row) => row.estado === "Pendiente").length;
  const progressPercent = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
  const guiaISinAlerta = workerRows.filter((row) => row.guiaI === "Sin alerta").length;
  const guiaISeguimiento = workerRows.filter(
    (row) => row.guiaI === "Requiere seguimiento confidencial"
  ).length;

  const riskDistribution = getRiskDistribution(completedRecords);
  const dominantRisk = getDominantRiskLevel(completedRecords);
  const averageScore = getAverageGuiaIIScore(completedRecords);
  const departmentSummaries = getDepartmentSummaries(completedRecords, assignedWorkers);
  const criticalDomains = getCriticalDomains(completedRecords);

  const departments = Array.from(new Set(assignedWorkers.map((worker) => worker.department))).sort();

  function clearFilters(): void {
    setDepartmentFilter("all");
    setStatusFilter("all");
    setRiskFilter("all");
  }

  const cutoffDate = snapshot
    ? new Date(snapshot.cutoffISO).toLocaleString("es-MX")
    : "-";

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard ejecutivo NOM-035</h1>
        <p className="mt-1 text-sm text-slate-700">
          Campana activa: {snapshot?.activeCampaign?.name ?? "Sin campana activa"}
        </p>
        <p className="text-sm text-slate-600">Fecha de corte: {cutoffDate}</p>
        <p className="mt-2 text-sm text-slate-700">
          Este panel muestra resultados agregados de la evaluacion NOM-035. No se muestran
          respuestas individuales pregunta por pregunta.
        </p>
      </header>

      {snapshot?.showGuiaIIIPending ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aviso interno: Guia III pendiente de integracion en este MVP.
        </p>
      ) : null}

      {showSkeleton ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="rounded border border-slate-200 p-3">
                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total trabajadores asignados</p>
              <p className="text-2xl font-semibold text-slate-900">{totalAssigned}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Evaluaciones completadas</p>
              <p className="text-2xl font-semibold text-slate-900">{completedCount}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Evaluaciones pendientes</p>
              <p className="text-2xl font-semibold text-slate-900">{pendingCount}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Porcentaje de avance</p>
              <p className="text-2xl font-semibold text-slate-900">{progressPercent}%</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Guia I: sin alerta</p>
              <p className="text-2xl font-semibold text-slate-900">{guiaISinAlerta}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Guia I: seguimiento confidencial
              </p>
              <p className="text-2xl font-semibold text-slate-900">{guiaISeguimiento}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Guia II: riesgo predominante</p>
              <p className="text-2xl font-semibold text-slate-900">{mapDominantRiskLabel(dominantRisk)}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Puntaje promedio Guia II</p>
              <p className="text-2xl font-semibold text-slate-900">{averageScore}</p>
            </article>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Distribucion de riesgo Guia II</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {([
                ["nulo", "Nulo"],
                ["bajo", "Bajo"],
                ["medio", "Medio"],
                ["alto", "Alto"],
                ["muy_alto", "Muy alto"],
              ] as Array<[RiskLevelNom035, string]>).map(([risk, label]) => (
                <div key={risk} className="rounded border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="text-xl font-semibold text-slate-900">{riskDistribution[risk]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Analisis por departamento</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm text-slate-800">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Departamento</th>
                    <th className="px-3 py-2 font-semibold">Trabajadores evaluados</th>
                    <th className="px-3 py-2 font-semibold">Puntaje promedio Guia II</th>
                    <th className="px-3 py-2 font-semibold">Riesgo predominante</th>
                    <th className="px-3 py-2 font-semibold">Dominios criticos</th>
                    <th className="px-3 py-2 font-semibold">Seguimiento confidencial Guia I</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentSummaries.map((row) => (
                    <tr key={row.department} className="border-t border-slate-200">
                      <td className="px-3 py-2">{row.department}</td>
                      <td className="px-3 py-2">{row.evaluatedWorkers}</td>
                      <td className="px-3 py-2">{row.averageGuiaIIScore}</td>
                      <td className="px-3 py-2">{mapDominantRiskLabel(row.predominantRiskLevel)}</td>
                      <td className="px-3 py-2">{row.criticalDomains}</td>
                      <td className="px-3 py-2">{row.guiaIFollowUpCases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Dominios con mayor atencion requerida
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm text-slate-800">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Dominio</th>
                    <th className="px-3 py-2 font-semibold">
                      Trabajadores con riesgo medio/alto/muy alto
                    </th>
                    <th className="px-3 py-2 font-semibold">Nivel mas frecuente</th>
                    <th className="px-3 py-2 font-semibold">Recomendacion breve</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalDomains.map((domain) => (
                    <tr key={domain.domain} className="border-t border-slate-200">
                      <td className="px-3 py-2">{domain.domain}</td>
                      <td className="px-3 py-2">{domain.workers}</td>
                      <td className="px-3 py-2">{mapGuiaIIRiskLabel(domain.mostFrequentLevel)}</td>
                      <td className="px-3 py-2">{domain.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-44">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Departamento
                </label>
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-44">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado de evaluacion
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En progreso">En progreso</option>
                  <option value="Completada">Completada</option>
                </select>
              </div>
              <div className="min-w-44">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nivel de riesgo Guia II
                </label>
                <select
                  value={riskFilter}
                  onChange={(event) => setRiskFilter(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="nulo">Nulo</option>
                  <option value="bajo">Bajo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                  <option value="muy_alto">Muy alto</option>
                  <option value="sin_datos">Sin datos</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => loadSnapshot()}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Actualizar resultados
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Limpiar filtros
              </button>
              <Link
                href="/admin/campanas"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Ir a campanas
              </Link>
              <button
                type="button"
                onClick={() => setReportMessage("Reporte se generara en el siguiente bloque.")}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Preparar reporte
              </button>
            </div>
            {reportMessage ? (
              <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                {reportMessage}
              </p>
            ) : null}
          </div>

          {completedCount === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              Todavia no hay evaluaciones completadas. Comparte los enlaces desde Campanas para comenzar.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] text-left text-sm text-slate-800">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Trabajador</th>
                  <th className="px-3 py-2 font-semibold">Departamento</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Guia I</th>
                  <th className="px-3 py-2 font-semibold">Riesgo Guia II</th>
                  <th className="px-3 py-2 font-semibold">Puntaje Guia II</th>
                  <th className="px-3 py-2 font-semibold">Dominios criticos</th>
                  <th className="px-3 py-2 font-semibold">Fecha de finalizacion</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.workerId} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2">{row.trabajador}</td>
                    <td className="px-3 py-2">{row.departamento}</td>
                    <td className="px-3 py-2">{row.estado}</td>
                    <td className="px-3 py-2">{row.guiaI}</td>
                    <td className="px-3 py-2">{mapGuiaIIRiskLabel(row.guiaIIRisk)}</td>
                    <td className="px-3 py-2">{row.guiaIIScore ?? "-"}</td>
                    <td className="px-3 py-2">
                      {row.dominiosCriticos.length > 0 ? row.dominiosCriticos.join(", ") : "-"}
                    </td>
                    <td className="px-3 py-2">{row.fechaFinalizacion ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
