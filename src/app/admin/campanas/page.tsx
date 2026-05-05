"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCampaignAssignments,
  getEvaluationRecordsLocal,
  getCampaignsLocal,
  getWorkers,
  saveCampaignAssignment,
  seedNom035LocalData,
} from "@/lib/nom035/storage-local";
import type { Campaign, CampaignAssignment, Worker } from "@/types/nom035";

interface CampanasSnapshot {
  activeCampaign: Campaign | null;
  rows: Array<{
    worker: Worker;
    assignment: CampaignAssignment | null;
    linkUrl: string | null;
    status: string;
  }>;
  totalWorkers: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  progressPercent: number;
}

export default function AdminCampanasPage() {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<CampanasSnapshot | null>(null);
  const [feedback, setFeedback] = useState<string>("");

  function loadSnapshot(): void {
    seedNom035LocalData();
    const campaigns = getCampaignsLocal();
    const workers = getWorkers();
    const assignments = getCampaignAssignments();
    const records = getEvaluationRecordsLocal();
    const activeCampaign = campaigns[0] ?? null;
    const activeWorkers = workers.filter((worker) => worker.status === "ACTIVE");
    const rows = activeWorkers.map((worker) => {
      const assignment = activeCampaign
        ? assignments.find(
            (item) => item.campaignId === activeCampaign.id && item.workerId === worker.id
          ) ?? null
        : null;
      const linkUrl = assignment ? `/evaluacion/${assignment.token}` : null;
      const record = assignment
        ? records.find((item) => item.token === assignment.token) ??
          records.find(
            (item) =>
              item.campaignId === assignment.campaignId &&
              item.workerId === assignment.workerId
          )
        : null;
      const status =
        !assignment
          ? "Sin link"
          : record?.status === "completed"
            ? "Completado"
            : record?.status === "in_progress"
              ? "En progreso"
              : "Pendiente";
      return {
        worker,
        assignment,
        linkUrl,
        status,
      };
    });

    const totalWorkers = rows.length;
    const completedCount = rows.filter((row) => row.status === "Completado").length;
    const inProgressCount = rows.filter((row) => row.status === "En progreso").length;
    const pendingCount = rows.filter((row) => row.status === "Pendiente").length;
    const progressPercent = totalWorkers > 0 ? Math.round((completedCount / totalWorkers) * 100) : 0;

    setSnapshot({
      activeCampaign,
      rows,
      totalWorkers,
      completedCount,
      inProgressCount,
      pendingCount,
      progressPercent,
    });
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadSnapshot();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  function resolveAbsoluteUrl(relativeUrl: string): string {
    if (typeof window === "undefined") return relativeUrl;
    return `${window.location.origin}${relativeUrl}`;
  }

  async function copyLink(relativeUrl: string): Promise<void> {
    const absoluteUrl = resolveAbsoluteUrl(relativeUrl);
    await navigator.clipboard.writeText(absoluteUrl);
      setFeedback("Enlace copiado al portapapeles.");
  }

  async function copyMessage(workerName: string, relativeUrl: string): Promise<void> {
    const absoluteUrl = resolveAbsoluteUrl(relativeUrl);
    const message = `Hola ${workerName}, como parte de la evaluación NOM-035 de la empresa, te compartimos tu enlace individual.

Tus respuestas serán tratadas de forma confidencial y se utilizarán únicamente para identificar áreas de mejora en el entorno laboral.

Por favor responde desde tu celular en el siguiente enlace:

${absoluteUrl}`;
    await navigator.clipboard.writeText(message);
      setFeedback("Mensaje listo para WhatsApp/correo copiado al portapapeles.");
  }

  function statusBadge(status: string): string {
    if (status === "Completado") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (status === "En progreso") return "bg-amber-100 text-amber-800 border-amber-200";
    if (status === "Sin link") return "bg-rose-100 text-rose-800 border-rose-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  function generateLinksForActiveWorkers(): void {
    if (!snapshot?.activeCampaign) {
      setFeedback("No hay campana activa para generar enlaces.");
      return;
    }
    const campaignId = snapshot.activeCampaign.id;
    let created = 0;
    for (const row of snapshot.rows) {
      if (row.assignment) continue;
      saveCampaignAssignment({
        campaignId,
        workerId: row.worker.id,
        token: `${campaignId}__${row.worker.id}`,
      });
      created += 1;
    }
    loadSnapshot();
    setFeedback(
      created > 0
        ? `Se generaron ${created} enlaces para trabajadores activos sin link.`
        : "No habia trabajadores activos pendientes de enlace."
    );
  }

  const showSkeleton = !mounted || !snapshot;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Distribución de evaluaciones</h1>
        <p className="text-slate-700">
            Desde aquí puedes compartir el enlace individual de evaluación NOM-035 con cada trabajador.
            Cada enlace es único y permite registrar sus respuestas de forma confidencial.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Cómo funciona</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Copia el enlace individual del trabajador.</li>
          <li>Envialo por WhatsApp, correo o QR.</li>
          <li>El trabajador responde desde su celular.</li>
          <li>El sistema calcula resultados y los muestra en el panel de resultados.</li>
        </ol>
      </div>

      {showSkeleton ? (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
              </div>
              <span className="inline-flex h-10 w-52 animate-pulse rounded-md bg-slate-100" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <article
                key={`sk-card-${index}`}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-8 w-12 animate-pulse rounded bg-slate-200" />
              </article>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] text-left text-sm text-slate-800">
              <thead className="bg-slate-100 text-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">Trabajador</th>
                  <th className="px-3 py-2 font-semibold">Departamento</th>
                  <th className="px-3 py-2 font-semibold">Puesto</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Link individual</th>
                  <th className="px-3 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`sk-row-${index}`} className="border-t border-slate-200">
                    {Array.from({ length: 6 }).map((__, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-3">
                        <div className="h-4 w-full max-w-[140px] animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500">Cargando estado de campaña desde datos locales...</p>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Campaña activa: {snapshot.activeCampaign?.name ?? "Sin campaña"}
                </h2>
                <p className="text-sm text-slate-600">
                  Guía habilitada:{" "}
                  {snapshot.activeCampaign?.questionnaireTypes.join(", ") ?? "-"}
                </p>
              </div>
              <Link
                href="/admin/resultados"
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Ver resultados de la campaña
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generateLinksForActiveWorkers}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Generar links para trabajadores activos
              </button>
              <button
                type="button"
                onClick={loadSnapshot}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Actualizar estado
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Total trabajadores asignados
              </p>
              <p className="text-2xl font-semibold text-slate-900">{snapshot.totalWorkers}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pendientes</p>
              <p className="text-2xl font-semibold text-slate-900">{snapshot.pendingCount}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">En progreso</p>
              <p className="text-2xl font-semibold text-slate-900">{snapshot.inProgressCount}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completados</p>
              <p className="text-2xl font-semibold text-slate-900">{snapshot.completedCount}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Porcentaje de avance</p>
              <p className="text-2xl font-semibold text-slate-900">{snapshot.progressPercent}%</p>
            </article>
          </div>

          {feedback ? (
            <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {feedback}
            </p>
          ) : null}
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Nota: si estás trabajando en localhost, estos enlaces solo funcionarán en esta computadora.
            Para enviarlos a trabajadores reales, el sistema debe publicarse en un dominio.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] text-left text-sm text-slate-800">
              <thead className="bg-slate-100 text-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">Trabajador</th>
                  <th className="px-3 py-2 font-semibold">Departamento</th>
                  <th className="px-3 py-2 font-semibold">Puesto</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Link individual</th>
                  <th className="px-3 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {snapshot.rows.map((row) => {
                  const workerName = row.worker.fullName;
                  return (
                    <tr key={row.worker.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">{workerName}</td>
                      <td className="px-3 py-2">{row.worker.department}</td>
                      <td className="px-3 py-2">{row.worker.position}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-blue-700">
                        {row.linkUrl ? resolveAbsoluteUrl(row.linkUrl) : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {row.linkUrl ? (
                            <Link
                              href={row.linkUrl}
                              target="_blank"
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                            >
                              Abrir evaluación
                            </Link>
                          ) : (
                            <span className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">
                              Sin link
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => row.linkUrl && copyLink(row.linkUrl)}
                            disabled={!row.linkUrl}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                          >
                            Copiar link
                          </button>
                          <button
                            type="button"
                            onClick={() => row.linkUrl && copyMessage(workerName, row.linkUrl)}
                            disabled={!row.linkUrl}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                          >
                            Copiar mensaje
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
