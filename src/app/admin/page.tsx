"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type Summary = {
  activeWorkers: number;
  inactiveWorkers: number;
  activeCampaign: { nombre: string } | null;
  assignments: {
    noLink: number;
    pending: number;
    inProgress: number;
    completed: number;
    revoked: number;
  };
  totalResults: number;
  predominantRisk: string | null;
  lastUpdatedAt: string | null;
};

type Secondary = {
  actionsPendientes: number;
  actionsVencidas: number;
  evidenciasActivas: number;
  checklistOk: number;
  checklistTotal: number;
  quejasRecibidas: number;
  quejasEnRevision: number;
  politicaVigente: string | null;
  politicaFecha: string | null;
};

const QUICK_LINKS = [
  { href: "/admin/trabajadores", label: "Gestionar trabajadores" },
  { href: "/admin/campanas", label: "Ir a campañas" },
  { href: "/admin/resultados", label: "Ver resultados" },
  { href: "/admin/reportes", label: "Generar reporte" },
  { href: "/admin/plan-accion", label: "Plan de acción" },
  { href: "/admin/evidencias", label: "Evidencias" },
  { href: "/admin/quejas", label: "Quejas" },
  { href: "/admin/politica", label: "Política" },
];

function riskLabel(value: string | null): string {
  if (!value) return "Sin datos";
  if (value === "nulo") return "Nulo";
  if (value === "bajo") return "Bajo";
  if (value === "medio") return "Medio";
  if (value === "alto") return "Alto";
  if (value === "muy_alto") return "Muy alto";
  return value;
}

export default function AdminHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [secondary, setSecondary] = useState<Secondary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [dash, plans, evidence, complaints, policies] = await Promise.all([
      adminApi.dashboard(),
      adminApi.actionPlanSummary(),
      adminApi.evidenceSummary(),
      adminApi.complaintSummary(),
      adminApi.policySummary(),
    ]);

    if (!dash.ok) {
      setError(dash.message);
      setSummary(null);
      setLoading(false);
      return;
    }
    setSummary(dash.summary as Summary);

    const planSum = plans.ok ? (plans.summary as Record<string, number>) : {};
    const evSum = evidence.ok ? (evidence.summary as Record<string, unknown>) : {};
    const qSum = complaints.ok ? (complaints.summary as Record<string, number>) : {};
    const pSum = policies.ok ? (policies.summary as Record<string, unknown>) : {};
    const checklist = (evSum.checklist as Record<string, boolean>) ?? {};
    const checklistEntries = Object.values(checklist);
    const published = pSum.published as { title?: string; publishedAt?: string } | null;

    setSecondary({
      actionsPendientes: Number(planSum.pendientes ?? 0),
      actionsVencidas: Number(planSum.vencidas ?? 0),
      evidenciasActivas: Number(evSum.total ?? 0),
      checklistOk: checklistEntries.filter(Boolean).length,
      checklistTotal: checklistEntries.length || 7,
      quejasRecibidas: Number(qSum.recibidas ?? 0),
      quejasEnRevision: Number(qSum.enRevision ?? 0),
      politicaVigente: published?.title ?? null,
      politicaFecha: published?.publishedAt ?? null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  async function downloadAvanceExcel() {
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch("/api/admin/nom035/campaigns/avance-excel", {
        credentials: "same-origin",
        headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        setExportError(json?.message ?? "No se pudo descargar el Excel.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "avance-nom035-2026.xlsx";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("No se pudo descargar el Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="admin-dashboard-page">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Portal interno NOM-035</h1>
        <p className="mt-1 text-slate-700">
          Panel general de seguimiento de trabajadores, campañas y evaluaciones.
        </p>
        <button
          type="button"
          data-testid="dashboard-refresh"
          onClick={() => void load()}
          className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          Actualizar resumen
        </button>
      </header>

      {loading ? <div className="h-24 animate-pulse rounded bg-slate-100" /> : null}
      {error ? (
        <p className="text-sm text-red-700" data-testid="dashboard-error">
          {error}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="dashboard-cards">
            <Card label="Trabajadores activos" value={summary.activeWorkers} testId="card-active-workers" />
            <Card label="Trabajadores inactivos" value={summary.inactiveWorkers} testId="card-inactive-workers" />
            <Card
              label="Campaña activa"
              value={summary.activeCampaign?.nombre ?? "Sin campaña activa"}
              testId="card-active-campaign"
            />
            <Card label="Sin enlace" value={summary.assignments.noLink} testId="card-no-link" />
            <Card label="Pendientes" value={summary.assignments.pending} testId="card-pending" />
            <Card label="En progreso" value={summary.assignments.inProgress} testId="card-in-progress" />
            <Card label="Completadas" value={summary.assignments.completed} testId="card-completed" />
            <Card label="Revocadas" value={summary.assignments.revoked} testId="card-revoked" />
            <Card label="Total resultados" value={summary.totalResults} testId="card-results" />
            <Card
              label="Riesgo predominante"
              value={riskLabel(summary.predominantRisk)}
              testId="card-risk"
            />
          </div>

          {summary.activeCampaign?.nombre === "Evaluación NOM-035 2026" ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-700">
                Export operativo de avance (quién ya completó / quién no). Sin respuestas ni
                puntuaciones.
              </p>
              <button
                type="button"
                data-testid="download-avance-excel"
                disabled={exporting}
                onClick={() => void downloadAvanceExcel()}
                className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {exporting ? "Generando…" : "Descargar Excel de respuestas"}
              </button>
              {exportError ? (
                <p className="mt-2 text-sm text-red-700" data-testid="avance-excel-error">
                  {exportError}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {secondary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="dashboard-secondary-cards">
          <Card label="Acciones pendientes" value={secondary.actionsPendientes} testId="card-actions-pending" />
          <Card label="Acciones vencidas" value={secondary.actionsVencidas} testId="card-actions-overdue" />
          <Card label="Evidencias activas" value={secondary.evidenciasActivas} testId="card-evidence-active" />
          <Card
            label="Checklist documental"
            value={`${secondary.checklistOk}/${secondary.checklistTotal}`}
            testId="card-checklist"
          />
          <Card label="Quejas recibidas" value={secondary.quejasRecibidas} testId="card-complaints-received" />
          <Card label="Quejas en revisión" value={secondary.quejasEnRevision} testId="card-complaints-review" />
          <Card
            label="Política vigente"
            value={secondary.politicaVigente ?? "Ninguna"}
            testId="card-policy"
          />
          <Card
            label="Fecha de política"
            value={
              secondary.politicaFecha
                ? new Date(secondary.politicaFecha).toLocaleDateString("es-MX")
                : "—"
            }
            testId="card-policy-date"
          />
        </div>
      ) : null}

      <nav className="grid gap-2 sm:grid-cols-2">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function Card({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
