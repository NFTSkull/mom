"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { adminApi } from "@/lib/nom035/admin-client";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import {
  AdminExecutiveSummaryPanel,
  type ExecutiveAggregateView,
} from "@/components/admin/executive-summary-panel";
import {
  RESULTS_PAGE_SIZE,
  buildResultsListQuery,
  canGoNext,
  canGoPrevious,
  computeTotalPages,
  normalizePage,
} from "@/lib/nom035/results-pagination";

type ResultRow = {
  id: string;
  workerNombre: string;
  departamento: string | null;
  puesto: string | null;
  campaignNombre: string;
  guiaIRequiresClinicalAttention: boolean | null;
  finalScore: number | null;
  finalRiskLevel: string | null;
  scoringVersion: string | null;
  completedAt: string | null;
};

type Detail = {
  id: string;
  username?: string | null;
  worker: { nombre: string; departamento: string | null; puesto: string | null };
  campaign: { nombre: string; status: string };
  status: string;
  completedAt: string | null;
  guiaIAnswers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>;
  guiaIIAnswers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>;
  guiaIIIAnswers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>;
  frpGuideType: "GUIA_II" | "GUIA_III" | null;
  skippedNote: string;
  finalScore: number | null;
  finalRiskLevel: string | null;
  categoryScores: unknown;
  domainScores: unknown;
  dimensionScores: unknown;
  alerts: unknown;
  scoringVersion: string | null;
  questionnaireVersion: string | null;
  validationWarnings: unknown;
  guiaIRequiresClinicalAttention: boolean | null;
  disclaimer: string;
};

function AdminResultadosInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tableRef = useRef<HTMLDivElement | null>(null);

  const pageFromUrl = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const riskLevel = searchParams.get("riskLevel") ?? "";
  const campaignId = searchParams.get("campaignId") ?? "";
  const page = Number.isFinite(pageFromUrl) && pageFromUrl >= 1 ? Math.floor(pageFromUrl) : 1;

  const [items, setItems] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; nombre: string }>>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exportingIndividual, setExportingIndividual] = useState(false);
  const [reportSummary, setReportSummary] = useState<{
    riskLevels: Record<string, number>;
    categoryAverages: Record<string, number>;
    domainAverages: Record<string, number>;
    completion: { completed: number; pending: number; inProgress: number };
  } | null>(null);
  const [executive, setExecutive] = useState<ExecutiveAggregateView | null>(null);

  const replaceParams = useCallback(
    (patch: Record<string, string | null>, opts?: { resetPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (opts?.resetPage) params.set("page", "1");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const q = buildResultsListQuery({
      page,
      pageSize: RESULTS_PAGE_SIZE,
      search: search || undefined,
      riskLevel: riskLevel || undefined,
      campaignId: campaignId || undefined,
    });
    const res = await adminApi.listResults(q);
    if (!res.ok) {
      setError(res.message);
      setLoading(false);
      return;
    }
    const nextTotal = res.total ?? 0;
    const nextTotalPages = res.totalPages ?? computeTotalPages(nextTotal, RESULTS_PAGE_SIZE);
    const safePage = normalizePage(res.page ?? page, nextTotal, RESULTS_PAGE_SIZE);
    setItems((res.items as ResultRow[]) ?? []);
    setTotal(nextTotal);
    setTotalPages(nextTotalPages);
    setLoading(false);
    if (safePage !== page) {
      replaceParams({ page: String(safePage) });
    }
  }, [page, search, riskLevel, campaignId, replaceParams]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void adminApi.listCampaigns(new URLSearchParams({ page: "1", pageSize: "50" })).then((r) => {
        if (r.ok) setCampaigns((r.items as Array<{ id: string; nombre: string }>) ?? []);
      });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void adminApi.reportsSummary(new URLSearchParams()).then((r) => {
        if (!r.ok || !r.report) return;
        const report = r.report as Record<string, unknown>;
        const assignments = Number(report.assignments ?? 0);
        const completed = Number(report.completed ?? 0);
        setReportSummary({
          riskLevels: (report.riskLevels as Record<string, number>) ?? {},
          categoryAverages: (report.categoryAverages as Record<string, number>) ?? {},
          domainAverages: (report.domainAverages as Record<string, number>) ?? {},
          completion: {
            completed,
            pending: Math.max(0, assignments - completed),
            inProgress: 0,
          },
        });
      });
      void adminApi.reportsExecutive().then((r) => {
        if (!r.ok || !r.aggregate) return;
        setExecutive(r.aggregate as unknown as ExecutiveAggregateView);
      });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  function goToPage(next: number) {
    if (loading) return;
    const safe = normalizePage(next, total, RESULTS_PAGE_SIZE);
    if (safe === page) return;
    replaceParams({ page: String(safe) });
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function openDetail(id: string) {
    const res = await adminApi.getResult(id);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDetail(res.detail as Detail);
  }

  async function downloadIndividualReport(id: string) {
    setExportingIndividual(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/nom035/results/${id}/report`, {
        credentials: "same-origin",
        headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(json?.message ?? "No se pudo descargar el reporte individual.");
        return;
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "nom035-reporte-2026.xlsx";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar el reporte individual.");
    } finally {
      setExportingIndividual(false);
    }
  }

  const prevEnabled = canGoPrevious(page) && !loading;
  const nextEnabled = canGoNext(page, total, RESULTS_PAGE_SIZE) && !loading;

  return (
    <section className="space-y-4" data-testid="admin-results-page">
      <h1 className="text-2xl font-semibold text-slate-900">Resultados</h1>
      <p className="text-sm text-slate-600">
        Resultados calculados en servidor. No sustituyen una valoración clínica.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          data-testid="results-search"
          className="rounded border px-2 py-1.5 text-sm"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => {
            replaceParams({ search: e.target.value || null }, { resetPage: true });
          }}
        />
        <select
          data-testid="results-risk-filter"
          className="rounded border px-2 py-1.5 text-sm"
          value={riskLevel}
          onChange={(e) => {
            replaceParams({ riskLevel: e.target.value || null }, { resetPage: true });
          }}
        >
          <option value="">Todos los niveles</option>
          <option value="nulo">Nulo</option>
          <option value="bajo">Bajo</option>
          <option value="medio">Medio</option>
          <option value="alto">Alto</option>
          <option value="muy_alto">Muy alto</option>
        </select>
        <select
          data-testid="results-campaign-filter"
          className="rounded border px-2 py-1.5 text-sm"
          value={campaignId}
          onChange={(e) => {
            replaceParams({ campaignId: e.target.value || null }, { resetPage: true });
          }}
        >
          <option value="">Todas las campañas</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button type="button" className="rounded border px-2 py-1.5 text-sm" onClick={() => void load()}>
          Reintentar
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm" data-testid="results-loading">Cargando…</p> : null}

      {executive ? <AdminExecutiveSummaryPanel aggregate={executive} /> : null}

      {reportSummary ? (
        <AdminReportChartsPanel
          riskLevels={reportSummary.riskLevels}
          categoryAverages={reportSummary.categoryAverages}
          domainAverages={reportSummary.domainAverages}
          completion={reportSummary.completion}
        />
      ) : null}

      <div
        ref={tableRef}
        className="overflow-x-auto rounded border border-slate-200 bg-white"
        data-testid="results-table"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">Depto</th>
              <th className="px-3 py-2">Campaña</th>
              <th className="px-3 py-2">Guía I seg.</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Nivel</th>
              <th className="px-3 py-2">Versión</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-4">
                  Sin resultados
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-t" data-testid={`result-row-${r.id}`}>
                  <td className="px-3 py-2">{r.workerNombre}</td>
                  <td className="px-3 py-2">{r.departamento ?? "—"}</td>
                  <td className="px-3 py-2">{r.campaignNombre}</td>
                  <td className="px-3 py-2">{r.guiaIRequiresClinicalAttention ? "Sí" : "No"}</td>
                  <td className="px-3 py-2">{r.finalScore ?? "—"}</td>
                  <td className="px-3 py-2">{r.finalRiskLevel ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.scoringVersion}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      data-testid={`result-detail-${r.id}`}
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => void openDetail(r.id)}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="results-pagination">
        <button
          type="button"
          data-testid="results-page-prev"
          disabled={!prevEnabled}
          onClick={() => goToPage(page - 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Anterior
        </button>
        <span data-testid="results-page-label">
          Página {page} / {totalPages} · {total} total · {RESULTS_PAGE_SIZE}/página
        </span>
        <button
          type="button"
          data-testid="results-page-next"
          disabled={!nextEnabled}
          onClick={() => goToPage(page + 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>

      {detail ? (
        <article
          data-testid="result-detail-panel"
          className="space-y-3 rounded-lg border border-slate-300 bg-white p-4"
        >
          <h2 className="text-lg font-semibold">Detalle — {detail.worker.nombre}</h2>
          <p className="text-sm text-slate-700">{detail.disclaimer}</p>
          <p className="text-sm text-slate-600">
            Este resultado corresponde al instrumento aplicado y no sustituye una valoración clínica.
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Campaña</dt>
              <dd>{detail.campaign.nombre}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>{detail.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Score final</dt>
              <dd data-testid="detail-final-score">{detail.finalScore}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nivel</dt>
              <dd data-testid="detail-risk-level">{detail.finalRiskLevel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">scoringVersion</dt>
              <dd>{detail.scoringVersion}</dd>
            </div>
            <div>
              <dt className="text-slate-500">questionnaireVersion</dt>
              <dd>{detail.questionnaireVersion}</dd>
            </div>
          </dl>
          <div>
            <h3 className="font-medium">Respuestas Guía I</h3>
            <ul className="mt-1 max-h-40 overflow-auto text-xs" data-testid="detail-guia-i">
              {detail.guiaIAnswers.map((a) => (
                <li key={a.questionId}>
                  {a.questionId}: {a.answerValue ?? a.answerText}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium">
              Respuestas {detail.frpGuideType === "GUIA_III" ? "Guía III" : "Guía II"}
            </h3>
            <ul className="mt-1 max-h-40 overflow-auto text-xs" data-testid="detail-guia-frp">
              {(detail.frpGuideType === "GUIA_III"
                ? detail.guiaIIIAnswers
                : detail.guiaIIAnswers
              ).map((a) => (
                <li key={a.questionId}>
                  {a.questionId}: {a.answerValue ?? a.answerText}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-500">{detail.skippedNote}</p>
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs" data-testid="detail-scores">
            {JSON.stringify(
              {
                categories: detail.categoryScores,
                domains: detail.domainScores,
                dimensions: detail.dimensionScores,
                alerts: detail.alerts,
                warnings: detail.validationWarnings,
              },
              null,
              2
            )}
          </pre>
          <div className="flex flex-wrap gap-2">
            {detail.status === "completed" ? (
              <button
                type="button"
                data-testid="download-individual-report"
                disabled={exportingIndividual}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                onClick={() => void downloadIndividualReport(detail.id)}
              >
                {exportingIndividual ? "Generando reporte…" : "Descargar Excel individual"}
              </button>
            ) : null}
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setDetail(null)}>
              Cerrar
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default function AdminResultadosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Cargando resultados…</p>}>
      <AdminResultadosInner />
    </Suspense>
  );
}
