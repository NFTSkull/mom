"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearNom035LocalData,
  getNom035LocalDataStatus,
  seedDemoData,
  type Nom035LocalDataStatus,
} from "@/lib/nom035/demo-data";

function riskLabel(value: string): string {
  if (value === "nulo") return "Nulo";
  if (value === "bajo") return "Bajo";
  if (value === "medio") return "Medio";
  if (value === "alto") return "Alto";
  if (value === "muy_alto") return "Muy alto";
  return "Sin datos";
}

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

export default function AdminHomePage() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Nom035LocalDataStatus | null>(null);
  const [feedback, setFeedback] = useState("");

  function refresh(): void {
    setStatus(getNom035LocalDataStatus());
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      refresh();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  function onSeedDemo(): void {
    const seededStatus = seedDemoData();
    setStatus(seededStatus);
    setFeedback("Datos demo cargados correctamente.");
  }

  function onClearData(): void {
    const confirmed = window.confirm(
      "¿Seguro que deseas limpiar los datos locales NOM-035? Esta acción solo afecta este navegador."
    );
    if (!confirmed) return;
    clearNom035LocalData();
    setStatus(getNom035LocalDataStatus());
    setFeedback("Datos locales NOM-035 limpiados.");
  }

  if (!mounted || !status) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Portal interno NOM-035 (MVP local)</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Portal interno NOM-035 (MVP local)</h1>
        <p className="mt-1 text-slate-700">
          Panel de resumen para demo con cliente. Muestra estado global del sistema local/mock.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Trabajadores activos</p>
          <p className="text-2xl font-semibold text-slate-900">{status.activeWorkers}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Campaña activa</p>
          <p className="text-sm font-semibold text-slate-900">{status.activeCampaignName}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Evaluaciones completadas</p>
          <p className="text-2xl font-semibold text-slate-900">{status.completedEvaluations}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pendientes</p>
          <p className="text-2xl font-semibold text-slate-900">{status.pendingEvaluations}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Riesgo predominante Guía II</p>
          <p className="text-2xl font-semibold text-slate-900">{riskLabel(status.dominantGuiaIIRisk)}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Acciones del plan pendientes</p>
          <p className="text-2xl font-semibold text-slate-900">{status.pendingActionPlans}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Quejas recibidas</p>
          <p className="text-2xl font-semibold text-slate-900">{status.complaintsCount}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Evidencias registradas</p>
          <p className="text-2xl font-semibold text-slate-900">{status.evidencesCount}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Política</p>
          <p className="text-2xl font-semibold text-slate-900">
            {status.publishedPolicy ? "Publicada" : "Pendiente"}
          </p>
        </article>
      </div>

      {!status.hasData ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No se detectaron datos locales NOM-035. Usa &quot;Cargar datos demo&quot; para iniciar la
          demostración.
        </p>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Herramientas demo (local)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSeedDemo}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Cargar datos demo
          </button>
          <button
            type="button"
            onClick={onClearData}
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
          >
            Limpiar datos locales
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Actualizar resumen
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Accesos rápidos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {feedback ? (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
