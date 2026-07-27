"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type Evidence = {
  id: string;
  title: string;
  evidenceType: string;
  description: string;
  evidenceSource: "upload" | "external";
  externalUrl: string | null;
  safeFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  version: number;
  deletedAt: string | null;
  storageDeletePending: boolean;
  replacedById: string | null;
  state: string;
  updatedAt: string;
};

type Summary = {
  total: number;
  cleanupPending: number;
  checklist: Record<string, boolean>;
  byType: Record<string, number>;
};

const TYPES = [
  "politica",
  "difusion",
  "resultados",
  "reporte",
  "capacitacion",
  "plan_accion",
  "quejas",
  "canalizacion",
  "otro",
] as const;

const CHECKLIST_LABELS: Record<string, string> = {
  politica: "Política",
  difusion: "Difusión",
  reporte: "Reporte",
  plan_accion: "Plan de acción",
  capacitacion: "Capacitación",
  quejas: "Quejas",
  canalizacion: "Canalizaciones",
};

function stateLabel(s: string) {
  if (s === "active") return "Archivo cargado";
  if (s === "external") return "Referencia externa";
  if (s === "superseded") return "Sustituida";
  if (s === "deleted") return "Eliminada";
  if (s === "cleanup_pending") return "Limpieza pendiente";
  return s;
}

export default function AdminEvidenciasPage() {
  const [items, setItems] = useState<Evidence[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const [title, setTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState<string>("otro");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ page: String(page), pageSize: "20", state: "active" });
    if (typeFilter !== "all") q.set("evidenceType", typeFilter);
    if (search.trim()) q.set("search", search.trim());

    const [listRes, sumRes] = await Promise.all([
      adminApi.listEvidence(q),
      adminApi.evidenceSummary(),
    ]);
    if (!listRes.ok) {
      setError(listRes.message);
      setItems([]);
    } else {
      setItems((listRes.items as Evidence[]) ?? []);
      setTotal(listRes.total ?? 0);
    }
    if (sumRes.ok) setSummary(sumRes.summary as Summary);
    setLoading(false);
  }, [page, typeFilter, search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  function clearForm() {
    setTitle("");
    setEvidenceType("otro");
    setDescription("");
    setExternalUrl("");
    setFile(null);
    setEditingId(null);
  }

  async function saveExternal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    if (editingId) {
      const res = await adminApi.updateEvidence(editingId, {
        title,
        evidenceType,
        description,
      });
      setMessage(res.ok ? "Evidencia actualizada." : res.message);
    } else if (externalUrl) {
      const res = await adminApi.createExternalEvidence({
        title,
        evidenceType,
        description,
        externalUrl,
      });
      setMessage(res.ok ? "Referencia externa registrada." : res.message);
    } else {
      setMessage("Indica una URL HTTPS o sube un archivo.");
      setBusy(false);
      return;
    }
    clearForm();
    setBusy(false);
    await load();
  }

  async function uploadFile(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) {
      setMessage("Título y archivo son obligatorios.");
      return;
    }
    setBusy(true);
    setUploadProgress("Validando y subiendo…");
    const form = new FormData();
    form.set("file", file);
    form.set("title", title);
    form.set("evidenceType", evidenceType);
    form.set("description", description);
    const res = await adminApi.uploadEvidence(form);
    setUploadProgress("");
    setMessage(res.ok ? "Archivo cargado en Storage privado." : res.message);
    if (res.ok) clearForm();
    setBusy(false);
    await load();
  }

  async function replaceFile(id: string, f: File) {
    setBusy(true);
    setUploadProgress("Reemplazando…");
    const form = new FormData();
    form.set("file", f);
    const res = await adminApi.replaceEvidence(id, form);
    setUploadProgress("");
    setMessage(res.ok ? "Versión nueva creada." : res.message);
    setBusy(false);
    await load();
  }

  async function softDelete(id: string) {
    setBusy(true);
    const res = await adminApi.deleteEvidence(id);
    if (!res.ok) setMessage(res.message);
    else
      setMessage(
        res.cleanupPending
          ? "Eliminada. Limpieza de Storage pendiente."
          : "Eliminada y objeto removido."
      );
    setBusy(false);
    await load();
  }

  async function retryCleanup(id: string) {
    setBusy(true);
    const res = await adminApi.retryEvidenceCleanup(id);
    setMessage(
      res.ok
        ? res.cleanupPending
          ? "Limpieza sigue pendiente."
          : "Limpieza completada."
        : res.message
    );
    setBusy(false);
    await load();
  }

  return (
    <section className="space-y-4" data-testid="evidencias-page">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Evidencias NOM-035</h1>
        <p className="mt-1 text-slate-700">
          Archivos en Storage privado (PDF/JPEG/PNG) y referencias HTTPS.
        </p>
        <p className="mt-1 text-xs text-amber-800">Privada · acceso temporal controlado</p>
      </header>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="evidence-summary-cards">
          <Card label="Activas" value={summary.total} />
          <Card label="Limpieza pendiente" value={summary.cleanupPending} />
          <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Checklist documental</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm" data-testid="evidence-checklist">
              {Object.entries(CHECKLIST_LABELS).map(([k, label]) => (
                <li key={k} className={summary.checklist?.[k] ? "text-emerald-700" : "text-slate-500"}>
                  {summary.checklist?.[k] ? "✓" : "○"} {label}
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          Tipo
          <select className="mt-1 block rounded border px-2 py-1.5" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="all">Todos</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Buscar
          <input className="mt-1 block rounded border px-2 py-1.5" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="evidence-search" />
        </label>
        <button type="button" className="self-end rounded border px-3 py-1.5 text-sm" onClick={() => void load()}>Actualizar</button>
      </div>

      {message ? <p className="text-sm" data-testid="evidence-message">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {uploadProgress ? <p className="text-sm text-slate-600" data-testid="evidence-progress">{uploadProgress}</p> : null}

      <form onSubmit={(e) => void saveExternal(e)} className="space-y-3 rounded-lg border bg-white p-4 shadow-sm" data-testid="evidence-external-form">
        <h2 className="font-semibold">{editingId ? "Editar metadata" : "Registrar evidencia"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Título<input required className="mt-1 block w-full rounded border px-2 py-1.5" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="evidence-title" /></label>
          <label className="text-sm">Tipo
            <select className="mt-1 block w-full rounded border px-2 py-1.5" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)} data-testid="evidence-type">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">Descripción<textarea className="mt-1 block w-full rounded border px-2 py-1.5" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        {!editingId ? (
          <label className="block text-sm">URL HTTPS externa<input className="mt-1 block w-full rounded border px-2 py-1.5" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" data-testid="evidence-external-url" /></label>
        ) : null}
        <button type="submit" disabled={busy} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" data-testid="evidence-save-external">
          {editingId ? "Guardar" : "Registrar enlace"}
        </button>
        {editingId ? <button type="button" className="ml-2 rounded border px-3 py-2 text-sm" onClick={clearForm}>Cancelar</button> : null}
      </form>

      <form onSubmit={(e) => void uploadFile(e)} className="space-y-3 rounded-lg border bg-white p-4 shadow-sm" data-testid="evidence-upload-form">
        <h2 className="font-semibold">Subir archivo (PDF / JPEG / PNG · máx. 15 MB)</h2>
        <p className="text-xs text-slate-600">Usa el mismo título/tipo del formulario superior, o complétalos aquí antes de subir.</p>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="evidence-file" />
        <button type="submit" disabled={busy || !file} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" data-testid="evidence-upload">
          Subir a Storage privado
        </button>
      </form>

      {loading ? <div className="h-20 animate-pulse rounded bg-slate-100" /> : null}

      <ul className="space-y-2" data-testid="evidence-list">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border bg-white p-3 shadow-sm" data-testid={`evidence-row-${item.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.evidenceType} · v{item.version} · {stateLabel(item.state)} · Privada
                </p>
                <p className="text-sm text-slate-600">{item.description?.slice(0, 120)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => { setEditingId(item.id); setTitle(item.title); setEvidenceType(item.evidenceType); setDescription(item.description ?? ""); }}>Editar</button>
                {item.evidenceSource === "upload" ? (
                  <a className="rounded border px-2 py-1 text-xs" href={adminApi.evidenceDownloadUrl(item.id)} data-testid={`evidence-download-${item.id}`}>Descargar</a>
                ) : item.externalUrl ? (
                  <a className="rounded border px-2 py-1 text-xs" href={item.externalUrl} target="_blank" rel="noopener noreferrer">Abrir enlace</a>
                ) : null}
                {item.evidenceSource === "upload" ? (
                  <label className="cursor-pointer rounded border px-2 py-1 text-xs">
                    Reemplazar
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) void replaceFile(item.id, f); }} />
                  </label>
                ) : null}
                <button type="button" className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => void softDelete(item.id)} data-testid={`evidence-delete-${item.id}`}>Eliminar</button>
                {item.storageDeletePending ? (
                  <button type="button" className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => void retryCleanup(item.id)}>Reintentar limpieza</button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

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
