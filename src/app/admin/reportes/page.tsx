"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";
import { downloadFullReportExcelFromBrowser } from "@/lib/nom035/download-full-report";
import {
  generateExecutiveConclusion,
  generateGeneralRecommendations,
  generateInterventionPlan,
} from "@/lib/nom035/report-generator";
import type { RiskLevelNom035 } from "@/types/nom035";

type Report = {
  company: {
    razonSocial?: string;
    responsableNombre?: string;
    totalTrabajadores?: number;
  } | null;
  campaign: { id: string; nombre: string; status: string; questionnaireVersion?: string } | null;
  departamento: string | null;
  registeredWorkers: number;
  assignments: number;
  completed: number;
  participationRate: number;
  riskLevels: Record<string, number>;
  categoryAverages: Record<string, number>;
  domainAverages: Record<string, number>;
  dimensionAverages: Record<string, number>;
  guiaIAggregate: { clinicalAttentionCount?: number; totalWithGuiaI?: number };
  scoringVersion: string | null;
  questionnaireVersion: string | null;
  generatedAt: string;
};

function mapRiskLabel(value: string | null | undefined): string {
  if (!value) return "Sin datos";
  if (value === "nulo") return "Nulo";
  if (value === "bajo") return "Bajo";
  if (value === "medio") return "Medio";
  if (value === "alto") return "Alto";
  if (value === "muy_alto") return "Muy alto";
  return value;
}

export default function AdminReportesPage() {
  const [campaigns, setCampaigns] = useState<Array<{ id: string; nombre: string; status: string }>>(
    []
  );
  const [campaignId, setCampaignId] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [exportingFull, setExportingFull] = useState(false);
  const [responsableNombre, setResponsableNombre] = useState("");
  const [responsableCargo, setResponsableCargo] = useState("Coordinación de Recursos Humanos");

  const load = useCallback(async () => {
    setError("");
    const q = new URLSearchParams();
    if (campaignId) q.set("campaignId", campaignId);
    if (departamento) q.set("departamento", departamento);
    const res = await adminApi.reportsSummary(q);
    if (!res.ok) {
      setError(res.message);
      setReport(null);
      return;
    }
    const r = res.report as Report;
    setReport(r);
    if (r.company?.responsableNombre) setResponsableNombre(String(r.company.responsableNombre));
  }, [campaignId, departamento]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void adminApi.listCampaigns(new URLSearchParams({ page: "1", pageSize: "50" })).then((r) => {
        if (r.ok) {
          const items = (r.items as Array<{ id: string; nombre: string; status: string }>) ?? [];
          setCampaigns(items);
          const active = items.find((c) => c.status === "active");
          if (active && !campaignId) setCampaignId(active.id);
        }
      });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [campaignId]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  const dominantRisk = useMemo(() => {
    if (!report) return null;
    const entries = Object.entries(report.riskLevels ?? {});
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0]![0] as RiskLevelNom035;
  }, [report]);

  const conclusions = useMemo(() => {
    if (!report) return [];
    return generateExecutiveConclusion({
      completedCount: report.completed,
      dominantRiskLevel: dominantRisk,
      guiaIFollowUpCases: report.guiaIAggregate?.clinicalAttentionCount ?? 0,
    });
  }, [report, dominantRisk]);

  const recommendations = useMemo(() => {
    const domains = Object.entries(report?.domainAverages ?? {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([domain]) => ({
        domain,
        recommendation: `Atender el dominio "${domain}" con acciones preventivas documentadas.`,
      }));
    return generateGeneralRecommendations(domains);
  }, [report]);

  const intervention = useMemo(() => generateInterventionPlan(), []);

  async function downloadFullReportExcel() {
    setExportingFull(true);
    setError("");
    const result = await downloadFullReportExcelFromBrowser();
    if (!result.ok) setError(result.message);
    setExportingFull(false);
  }

  return (
    <section className="space-y-4" data-testid="admin-reports-page">
      <div className="print:hidden space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Reportes</h1>

        <div
          className="rounded-lg border-2 border-slate-900 bg-white p-4 shadow-sm"
          data-testid="nom035-reportes-excel-export"
        >
          <h2 className="text-base font-semibold text-slate-900">Descargar reporte en Excel</h2>
          <p className="mt-1 text-sm text-slate-700">
            Excel consolidado NOM-035 (Resumen Ejecutivo, tablas y gráficas). No modifica datos ni
            la campaña.
          </p>
          <button
            type="button"
            data-testid="download-full-report-excel"
            className="mt-3 rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            disabled={exportingFull}
            onClick={() => void downloadFullReportExcel()}
          >
            {exportingFull ? "Generando reporte…" : "Descargar Excel completo"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            data-testid="report-campaign-select"
            className="rounded border px-2 py-1.5 text-sm"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Campaña activa / todas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.status})
              </option>
            ))}
          </select>
          <input
            data-testid="report-departamento"
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Departamento (opcional)"
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
          />
          <button
            type="button"
            data-testid="report-refresh"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={() => void load()}
          >
            Actualizar
          </button>
          <button
            type="button"
            data-testid="report-print"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            onClick={() => window.print()}
          >
            Imprimir
          </button>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>

      {report ? (
        <article
          data-testid="report-document"
          className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-slate-800 shadow-sm print:border-0 print:shadow-none"
        >
          <header>
            <h2 className="text-xl font-semibold">Informe NOM-035</h2>
            <p className="text-sm text-slate-600">
              Empresa: {report.company?.razonSocial ?? "—"} · Campaña:{" "}
              {report.campaign?.nombre ?? "—"} · Fecha:{" "}
              {new Date(report.generatedAt).toLocaleString("es-MX")}
            </p>
          </header>

          <section>
            <h3 className="font-semibold">1. Objetivo</h3>
            <p className="text-sm">
              Identificar factores de riesgo psicosocial y evaluar el entorno organizacional conforme
              al instrumento oficial NOM-035-STPS-2018 (Guías I y II).
            </p>
          </section>

          <section>
            <h3 className="font-semibold">2. Alcance</h3>
            <p className="text-sm">
              {departamento
                ? `Departamento: ${departamento}.`
                : "Toda la empresa (trabajadores con asignación en la campaña seleccionada)."}
            </p>
          </section>

          <section>
            <h3 className="font-semibold">3. Metodología</h3>
            <p className="text-sm">
              Aplicación de cuestionarios oficiales vía enlace individual criptográfico. Scoring
              calculado únicamente en servidor (
              <code>{report.scoringVersion ?? "—"}</code> /{" "}
              <code>{report.questionnaireVersion ?? "—"}</code>).
            </p>
          </section>

          <section data-testid="report-results-section">
            <h3 className="font-semibold">4. Resultados</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              <li>Trabajadores registrados activos: {report.registeredWorkers}</li>
              <li>Asignaciones: {report.assignments}</li>
              <li>Completados: {report.completed}</li>
              <li>Tasa de participación: {report.participationRate}%</li>
              <li>Distribución de niveles: {JSON.stringify(report.riskLevels)}</li>
              <li>
                Seguimiento Guía I (agregado/confidencial):{" "}
                {report.guiaIAggregate?.clinicalAttentionCount ?? 0} de{" "}
                {report.guiaIAggregate?.totalWithGuiaI ?? 0}
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              El reporte general no incluye respuestas individuales completas.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
              <pre className="overflow-auto rounded bg-slate-50 p-2">
                Categorías: {JSON.stringify(report.categoryAverages, null, 2)}
              </pre>
              <pre className="overflow-auto rounded bg-slate-50 p-2">
                Dominios: {JSON.stringify(report.domainAverages, null, 2)}
              </pre>
              <pre className="overflow-auto rounded bg-slate-50 p-2">
                Dimensiones: {JSON.stringify(report.dimensionAverages, null, 2)}
              </pre>
            </div>
          </section>

          <section>
            <h3 className="font-semibold">5. Conclusiones</h3>
            <ul className="list-disc pl-5 text-sm">
              {conclusions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">6. Recomendaciones</h3>
            <ul className="list-disc pl-5 text-sm">
              {recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">7. Intervención</h3>
            <ul className="list-disc pl-5 text-sm">
              {intervention.map((i) => (
                <li key={i.level}>
                  {i.level} ({i.focus}): {i.action} — {i.owner}
                </li>
              ))}
            </ul>
          </section>

          <SecondaryModulesSection />

          <section className="print:break-inside-avoid">
            <h3 className="font-semibold">9. Responsable</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 print:hidden">
              <input
                className="rounded border px-2 py-1.5 text-sm"
                value={responsableNombre}
                onChange={(e) => setResponsableNombre(e.target.value)}
                placeholder="Nombre"
              />
              <input
                className="rounded border px-2 py-1.5 text-sm"
                value={responsableCargo}
                onChange={(e) => setResponsableCargo(e.target.value)}
                placeholder="Cargo"
              />
            </div>
            <p className="mt-2 text-sm">
              {responsableNombre || "—"} · {responsableCargo}
            </p>
            <p className="text-xs text-slate-500">Nivel predominante: {mapRiskLabel(dominantRisk)}</p>
          </section>
        </article>
      ) : (
        <p className="text-sm text-slate-600">Sin datos de reporte.</p>
      )}

      <style jsx global>{`
        @media print {
          .print\\:hidden,
          [data-testid="admin-local-banner"],
          nav {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function SecondaryModulesSection() {
  const [block, setBlock] = useState<{
    plan: string;
    evidence: string;
    complaints: string;
    policy: string;
  } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        const [p, e, c, pol] = await Promise.all([
          adminApi.actionPlanSummary(),
          adminApi.evidenceSummary(),
          adminApi.complaintSummary(),
          adminApi.policySummary(),
        ]);
        const ps = p.ok ? (p.summary as Record<string, number>) : {};
        const es = e.ok ? (e.summary as Record<string, unknown>) : {};
        const cs = c.ok ? (c.summary as Record<string, number>) : {};
        const pols = pol.ok ? (pol.summary as Record<string, unknown>) : {};
        const published = pols.published as { title?: string; versionLabel?: string } | null;
        setBlock({
          plan: `Pendientes ${ps.pendientes ?? 0}, en proceso ${ps.enProceso ?? 0}, completadas ${ps.completadas ?? 0}, vencidas ${ps.vencidas ?? 0}`,
          evidence: `Activas ${es.total ?? 0}`,
          complaints: `Recibidas ${cs.recibidas ?? 0}, en revisión ${cs.enRevision ?? 0}, resueltas ${cs.resueltas ?? 0}, cerradas ${cs.cerradas ?? 0}`,
          policy: published
            ? `${published.title} (${published.versionLabel})`
            : "Sin política publicada",
        });
      })();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  if (!block) return null;
  return (
    <section data-testid="report-secondary-modules">
      <h3 className="font-semibold">8. Módulos secundarios (agregado)</h3>
      <ul className="mt-2 list-disc pl-5 text-sm">
        <li>Plan de acción: {block.plan}</li>
        <li>Estado documental: {block.evidence}</li>
        <li>Quejas por estado: {block.complaints}</li>
        <li>Política vigente: {block.policy}</li>
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Sin descripciones de quejas, contactos ni respuestas individuales.
      </p>
    </section>
  );
}
