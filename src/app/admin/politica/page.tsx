"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type Policy = {
  id: string;
  title: string;
  content: string;
  versionNumber: number;
  versionLabel: string;
  status: "borrador" | "publicada" | "archivada";
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

type Summary = {
  total: number;
  drafts: number;
  archived: number;
  published: Policy | null;
};

function statusLabel(s: string) {
  if (s === "publicada") return "Publicada";
  if (s === "archivada") return "Archivada";
  return "Borrador";
}

/** Vista previa en texto plano (sin HTML inyectado). */
function PlainText({ text }: { text: string }) {
  return <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{text}</pre>;
}

export default function AdminPoliticaPage() {
  const [items, setItems] = useState<Policy[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const selected = items.find((p) => p.id === selectedId) ?? null;
  const editable = selected?.status === "borrador";

  const load = useCallback(async (preferId?: string | null) => {
    setLoading(true);
    setError("");
    const [listRes, sumRes] = await Promise.all([
      adminApi.listPolicies(new URLSearchParams({ page: "1", pageSize: "50" })),
      adminApi.policySummary(),
    ]);
    if (!listRes.ok) {
      setError(listRes.message);
      setItems([]);
    } else {
      const list = (listRes.items as Policy[]) ?? [];
      setItems(list);
      const nextId = preferId ?? selectedId ?? list[0]?.id ?? null;
      if (nextId) {
        const p = list.find((x) => x.id === nextId) ?? list[0];
        if (p) {
          setSelectedId(p.id);
          setTitle(p.title);
          setContent(p.content);
          setVersionLabel(p.versionLabel);
        }
      }
    }
    if (sumRes.ok) setSummary(sumRes.summary as Summary);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(null);
    }, 0);
    return () => window.clearTimeout(t);
    // Carga inicial única.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectPolicy(p: Policy) {
    setSelectedId(p.id);
    setTitle(p.title);
    setContent(p.content);
    setVersionLabel(p.versionLabel);
    setMessage("");
  }

  async function generateBase() {
    setBusy(true);
    const res = await adminApi.generatePolicyBase();
    if (!res.ok) {
      setMessage(res.message);
      setBusy(false);
      return;
    }
    setTitle(res.base.title);
    setContent(res.base.content);
    setSelectedId(null);
    setMessage("Base generada desde company_settings central. Guarda como borrador.");
    setBusy(false);
  }

  async function saveDraft() {
    setBusy(true);
    if (editable && selectedId) {
      const res = await adminApi.updatePolicyDraft(selectedId, { title, content, versionLabel });
      setMessage(res.ok ? "Borrador actualizado." : res.message);
      await load(selectedId);
    } else {
      const res = await adminApi.createPolicyDraft({
        title,
        content,
        versionLabel: versionLabel || null,
      });
      if (res.ok) {
        setMessage("Borrador creado.");
        const p = res.policy as Policy;
        await load(p.id);
      } else {
        setMessage(res.message);
        await load(selectedId);
      }
    }
    setBusy(false);
  }

  async function duplicate() {
    if (!selectedId) return;
    setBusy(true);
    const res = await adminApi.duplicatePolicy(selectedId, {});
    if (res.ok) {
      setMessage("Nueva versión (borrador) creada.");
      const p = res.policy as Policy;
      setSelectedId(p.id);
      setTitle(p.title);
      setContent(p.content);
      setVersionLabel(p.versionLabel);
    } else setMessage(res.message);
    setBusy(false);
    await load(res.ok ? (res.policy as Policy).id : selectedId);
  }

  async function publish() {
    if (!selectedId) return;
    const published = summary?.published;
    const ok = window.confirm(
      published
        ? `¿Publicar esta versión? La vigente «${published.title}» (${published.versionLabel}) será archivada.`
        : "¿Publicar esta política como vigente?"
    );
    if (!ok) return;
    setBusy(true);
    const res = await adminApi.publishPolicy(selectedId);
    setMessage(res.ok ? "Política publicada." : res.message);
    setBusy(false);
    await load(selectedId);
  }

  async function archive() {
    if (!selectedId) return;
    setBusy(true);
    const res = await adminApi.archivePolicy(selectedId);
    setMessage(res.ok ? "Política archivada." : res.message);
    setBusy(false);
    await load(selectedId);
  }

  function printPolicy() {
    setPrintMode(true);
    window.setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 50);
  }

  if (printMode && selected) {
    return (
      <main className="mx-auto max-w-3xl p-8 print:p-0" data-testid="policy-print">
        <h1 className="text-xl font-semibold">{selected.title}</h1>
        <p className="text-sm text-slate-600">
          Versión {selected.versionLabel} · {statusLabel(selected.status)}
        </p>
        <PlainText text={selected.content} />
      </main>
    );
  }

  return (
    <section className="space-y-4 print:hidden" data-testid="politica-page">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Política NOM-035</h1>
        <p className="mt-1 text-slate-700">
          Versionado central. Solo una publicada. Texto plano (sin HTML).
        </p>
        {summary?.published ? (
          <p className="mt-2 text-sm text-emerald-800" data-testid="policy-published-banner">
            Vigente: {summary.published.title} ({summary.published.versionLabel})
            {summary.published.publishedAt
              ? ` · ${new Date(summary.published.publishedAt).toLocaleDateString("es-MX")}`
              : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-800">No hay política publicada.</p>
        )}
      </header>

      {message ? <p className="text-sm" data-testid="policy-message">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="h-16 animate-pulse rounded bg-slate-100" /> : null}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2 rounded-lg border bg-white p-3 shadow-sm" data-testid="policy-history">
          <h2 className="text-sm font-semibold">Historial</h2>
          <ul className="space-y-1 text-sm">
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left ${selectedId === p.id ? "bg-slate-100" : "hover:bg-slate-50"}`}
                  onClick={() => selectPolicy(p)}
                  data-testid={`policy-item-${p.id}`}
                >
                  <span className="font-medium">{p.versionLabel}</span>
                  <span className="ml-1 text-xs text-slate-500">{statusLabel(p.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="rounded border px-3 py-1.5 text-sm" data-testid="policy-generate-base" onClick={() => void generateBase()}>
              Generar base
            </button>
            <button type="button" disabled={busy} className="rounded border px-3 py-1.5 text-sm" data-testid="policy-save" onClick={() => void saveDraft()}>
              {editable ? "Guardar borrador" : "Crear borrador"}
            </button>
            {selected ? (
              <button type="button" disabled={busy} className="rounded border px-3 py-1.5 text-sm" data-testid="policy-duplicate" onClick={() => void duplicate()}>
                Crear nueva versión
              </button>
            ) : null}
            {editable ? (
              <button type="button" disabled={busy} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" data-testid="policy-publish" onClick={() => void publish()}>
                Publicar
              </button>
            ) : null}
            {selected?.status === "publicada" ? (
              <button type="button" disabled={busy} className="rounded border px-3 py-1.5 text-sm" onClick={() => void archive()}>
                Archivar
              </button>
            ) : null}
            {selected ? (
              <button type="button" className="rounded border px-3 py-1.5 text-sm" data-testid="policy-print" onClick={printPolicy}>
                Imprimir
              </button>
            ) : null}
          </div>

          {selected && !editable ? (
            <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Esta política está {statusLabel(selected.status).toLowerCase()} y no se edita directamente.
              Usa «Crear nueva versión».
            </p>
          ) : null}

          <label className="block text-sm">
            Etiqueta de versión
            <input
              className="mt-1 block w-full rounded border px-2 py-1.5"
              value={versionLabel}
              disabled={Boolean(selected && !editable)}
              onChange={(e) => setVersionLabel(e.target.value)}
              data-testid="policy-version-label"
            />
          </label>
          <label className="block text-sm">
            Título
            <input
              className="mt-1 block w-full rounded border px-2 py-1.5"
              value={title}
              disabled={Boolean(selected && !editable)}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="policy-title"
            />
          </label>
          <label className="block text-sm">
            Contenido (texto plano)
            <textarea
              className="mt-1 block w-full rounded border px-2 py-1.5 font-mono text-sm"
              rows={16}
              value={content}
              disabled={Boolean(selected && !editable)}
              onChange={(e) => setContent(e.target.value)}
              data-testid="policy-content"
            />
          </label>

          {selected ? (
            <div className="rounded border border-slate-100 bg-slate-50 p-3" data-testid="policy-preview">
              <p className="mb-2 text-xs uppercase text-slate-500">Vista previa (escapada)</p>
              <PlainText text={selected.content} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
