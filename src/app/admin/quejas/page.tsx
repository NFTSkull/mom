"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type ComplaintListItem = {
  id: string;
  folio: string;
  complaintType: string;
  descriptionPreview: string;
  isAnonymous: boolean;
  status: string;
  assignedLabel: string | null;
  createdAt: string;
};

type ComplaintDetail = ComplaintListItem & {
  description: string;
  reporterName: string | null;
  reporterContact: string | null;
  resolutionNotes: string | null;
  resolutionCategory: string | null;
  closedAt: string | null;
};

type Summary = {
  total: number;
  recibidas: number;
  enRevision: number;
  resueltas: number;
  cerradas: number;
};

function typeLabel(t: string) {
  if (t === "violencia_laboral") return "Violencia laboral";
  if (t === "entorno_organizacional") return "Entorno organizacional";
  if (t === "factores_riesgo_psicosocial") return "Factores de riesgo";
  return "Otro";
}

function statusLabel(s: string) {
  if (s === "recibida") return "Recibida";
  if (s === "en_revision") return "En revisión";
  if (s === "resuelta") return "Resuelta";
  return "Cerrada";
}

export default function AdminQuejasPage() {
  const [items, setItems] = useState<ComplaintListItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [folio, setFolio] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [assignLabel, setAssignLabel] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [closeJustification, setCloseJustification] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (statusFilter !== "all") q.set("status", statusFilter);
    if (folio.trim()) q.set("folio", folio.trim());
    const [listRes, sumRes] = await Promise.all([
      adminApi.listComplaints(q),
      adminApi.complaintSummary(),
    ]);
    if (!listRes.ok) {
      setError(listRes.message);
      setItems([]);
    } else {
      setItems((listRes.items as ComplaintListItem[]) ?? []);
      setTotal(listRes.total ?? 0);
    }
    if (sumRes.ok) setSummary(sumRes.summary as Summary);
    setLoading(false);
  }, [page, statusFilter, folio]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    const res = await adminApi.getComplaint(id);
    if (res.ok) setDetail(res.complaint as ComplaintDetail);
    else setMessage(res.message);
  }

  async function assign() {
    if (!selectedId || !assignLabel.trim()) return;
    setBusy(true);
    const res = await adminApi.assignComplaint(selectedId, assignLabel.trim());
    setMessage(res.ok ? "Asignada." : res.message);
    setBusy(false);
    await openDetail(selectedId);
    await load();
  }

  async function toReview() {
    if (!selectedId) return;
    setBusy(true);
    const res = await adminApi.changeComplaintStatus(selectedId, "en_revision");
    setMessage(res.ok ? "En revisión." : res.message);
    setBusy(false);
    await openDetail(selectedId);
    await load();
  }

  async function resolve() {
    if (!selectedId) return;
    setBusy(true);
    const res = await adminApi.resolveComplaint(selectedId, { notes: resolveNotes || null });
    setMessage(res.ok ? "Resuelta." : res.message);
    setBusy(false);
    await openDetail(selectedId);
    await load();
  }

  async function close() {
    if (!selectedId) return;
    setBusy(true);
    const res = await adminApi.closeComplaint(selectedId, {
      justification: closeJustification || null,
    });
    setMessage(res.ok ? "Cerrada." : res.message);
    setBusy(false);
    await openDetail(selectedId);
    await load();
  }

  return (
    <section className="space-y-4" data-testid="quejas-admin-page">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Quejas confidenciales</h1>
        <p className="mt-1 text-slate-700">
          Datos centrales. El contacto solo aparece al abrir el detalle.
        </p>
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Confidencialidad: no divulgue datos personales fuera del personal autorizado.
        </p>
      </header>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="complaint-summary-cards">
          <Card label="Total" value={summary.total} />
          <Card label="Recibidas" value={summary.recibidas} />
          <Card label="En revisión" value={summary.enRevision} />
          <Card label="Resueltas" value={summary.resueltas} />
          <Card label="Cerradas" value={summary.cerradas} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4 shadow-sm">
        <label className="text-sm">
          Estado
          <select className="mt-1 block rounded border px-2 py-1.5" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} data-testid="complaint-status-filter">
            <option value="all">Todos</option>
            <option value="recibida">Recibida</option>
            <option value="en_revision">En revisión</option>
            <option value="resuelta">Resuelta</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </label>
        <label className="text-sm">
          Folio
          <input className="mt-1 block rounded border px-2 py-1.5" value={folio} onChange={(e) => setFolio(e.target.value)} data-testid="complaint-folio-search" />
        </label>
        <button type="button" className="self-end rounded border px-3 py-1.5 text-sm" onClick={() => void load()}>Buscar</button>
      </div>

      {message ? <p className="text-sm" data-testid="complaint-message">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="h-16 animate-pulse rounded bg-slate-100" /> : null}

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-left text-sm" data-testid="complaint-table">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Folio</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Vista previa</th>
              <th className="px-3 py-2">Anonimato</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b" data-testid={`complaint-row-${c.folio}`}>
                <td className="px-3 py-2 font-mono text-xs">{c.folio}</td>
                <td className="px-3 py-2">{typeLabel(c.complaintType)}</td>
                <td className="px-3 py-2">{c.descriptionPreview}</td>
                <td className="px-3 py-2">{c.isAnonymous ? "Anónima" : "Con datos"}</td>
                <td className="px-3 py-2">{statusLabel(c.status)}</td>
                <td className="px-3 py-2">{c.assignedLabel ?? "—"}</td>
                <td className="px-3 py-2">
                  <button type="button" className="rounded border px-2 py-1 text-xs" data-testid={`complaint-open-${c.id}`} onClick={() => void openDetail(c.id)}>
                    Detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail ? (
        <aside className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4" data-testid="complaint-detail">
          <h2 className="font-semibold text-slate-900">Detalle · {detail.folio}</h2>
          <p className="text-sm whitespace-pre-wrap">{detail.description}</p>
          <p className="text-sm">
            <span className="font-medium">Anonimato:</span>{" "}
            {detail.isAnonymous ? "Anónima" : "Identificada"}
          </p>
          {!detail.isAnonymous ? (
            <div className="rounded border border-amber-300 bg-white p-3 text-sm" data-testid="complaint-contact">
              <p>
                <span className="font-medium">Nombre:</span> {detail.reporterName ?? "—"}
              </p>
              <p>
                <span className="font-medium">Contacto:</span> {detail.reporterContact ?? "—"}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <input className="rounded border px-2 py-1 text-sm" placeholder="Asignar a…" value={assignLabel} onChange={(e) => setAssignLabel(e.target.value)} data-testid="complaint-assign-input" />
            <button type="button" disabled={busy} className="rounded border px-2 py-1 text-sm" onClick={() => void assign()}>Asignar</button>
            {detail.status === "recibida" ? (
              <button type="button" disabled={busy} className="rounded border px-2 py-1 text-sm" data-testid="complaint-to-review" onClick={() => void toReview()}>Pasar a revisión</button>
            ) : null}
          </div>
          {(detail.status === "en_revision") ? (
            <div className="flex flex-wrap gap-2">
              <input className="rounded border px-2 py-1 text-sm" placeholder="Notas de resolución" value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} />
              <button type="button" disabled={busy} className="rounded border px-2 py-1 text-sm" data-testid="complaint-resolve" onClick={() => void resolve()}>Resolver</button>
            </div>
          ) : null}
          {detail.status !== "cerrada" ? (
            <div className="flex flex-wrap gap-2">
              <input className="rounded border px-2 py-1 text-sm" placeholder="Justificación de cierre" value={closeJustification} onChange={(e) => setCloseJustification(e.target.value)} />
              <button type="button" disabled={busy} className="rounded border px-2 py-1 text-sm" data-testid="complaint-close" onClick={() => void close()}>Cerrar</button>
            </div>
          ) : null}
          <button type="button" className="text-sm underline" onClick={() => { setSelectedId(null); setDetail(null); }}>Cerrar panel</button>
        </aside>
      ) : null}

      <div className="flex gap-2 text-sm">
        <button type="button" disabled={page <= 1} className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>Anterior</button>
        <span>Página {page} · {total}</span>
        <button type="button" disabled={page * 20 >= total} className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => setPage((p) => p + 1)}>Siguiente</button>
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
