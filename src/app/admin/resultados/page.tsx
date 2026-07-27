"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

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
  worker: { nombre: string; departamento: string | null; puesto: string | null };
  campaign: { nombre: string; status: string };
  status: string;
  completedAt: string | null;
  guiaIAnswers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>;
  guiaIIAnswers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>;
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

export default function AdminResultadosPage() {
  const [items, setItems] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<Array<{ id: string; nombre: string }>>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) q.set("search", search);
    if (riskLevel) q.set("riskLevel", riskLevel);
    if (campaignId) q.set("campaignId", campaignId);
    const res = await adminApi.listResults(q);
    if (!res.ok) {
      setError(res.message);
      setLoading(false);
      return;
    }
    setItems((res.items as ResultRow[]) ?? []);
    setTotal(res.total ?? 0);
    setLoading(false);
  }, [page, search, riskLevel, campaignId]);

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
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  async function openDetail(id: string) {
    const res = await adminApi.getResult(id);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDetail(res.detail as Detail);
  }

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
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          data-testid="results-risk-filter"
          className="rounded border px-2 py-1.5 text-sm"
          value={riskLevel}
          onChange={(e) => {
            setPage(1);
            setRiskLevel(e.target.value);
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
            setPage(1);
            setCampaignId(e.target.value);
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
      {loading ? <p className="text-sm">Cargando…</p> : null}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
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
      <p className="text-sm text-slate-600">
        Página {page} · {total} total
      </p>

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
            <h3 className="font-medium">Respuestas Guía II</h3>
            <ul className="mt-1 max-h-40 overflow-auto text-xs" data-testid="detail-guia-ii">
              {detail.guiaIIAnswers.map((a) => (
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
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setDetail(null)}>
            Cerrar
          </button>
        </article>
      ) : null}
    </section>
  );
}
