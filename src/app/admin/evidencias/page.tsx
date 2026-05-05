"use client";

import { useEffect, useMemo, useState } from "react";
import { getEvidenceChecklist, getEvidenceStats, getEvidenceTypeLabel } from "@/lib/nom035/evidence-analytics";
import {
  deleteEvidenceItem,
  getCampaignsLocal,
  getEvidenceItems,
  saveEvidenceItem,
  seedNom035LocalData,
  updateEvidenceItem,
} from "@/lib/nom035/storage-local";
import type { EvidenceItem } from "@/types/nom035";

type EvidenceForm = {
  title: string;
  evidenceType: EvidenceItem["evidenceType"];
  description: string;
  fileName: string;
  fileUrl: string;
  notes: string;
};

const INITIAL_FORM: EvidenceForm = {
  title: "",
  evidenceType: "otro",
  description: "",
  fileName: "",
  fileUrl: "",
  notes: "",
};

export default function AdminEvidenciasPage() {
  const [mounted, setMounted] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("");
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [form, setForm] = useState<EvidenceForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  function loadData(): void {
    seedNom035LocalData();
    setCampaignId(getCampaignsLocal()[0]?.id ?? "");
    setItems(getEvidenceItems());
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadData();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const stats = getEvidenceStats(items);
  const checklist = getEvidenceChecklist(items);

  const filteredItems = useMemo(() => {
    const search = searchFilter.trim().toLowerCase();
    return items.filter((item) => {
      const typeOk = typeFilter === "all" || item.evidenceType === typeFilter;
      const text = `${item.title} ${item.description}`.toLowerCase();
      const searchOk = search.length === 0 || text.includes(search);
      return typeOk && searchOk;
    });
  }, [items, typeFilter, searchFilter]);

  function clearForm(): void {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!form.title || !form.description) {
      setMessage("Completa titulo y descripcion para registrar la evidencia.");
      return;
    }

    if (editingId) {
      updateEvidenceItem(editingId, {
        title: form.title,
        evidenceType: form.evidenceType,
        description: form.description,
        fileName: form.fileName,
        fileUrl: form.fileUrl,
        notes: form.notes,
      });
      setMessage("Evidencia actualizada correctamente.");
    } else {
      saveEvidenceItem({
        campaignId: campaignId || undefined,
        title: form.title,
        evidenceType: form.evidenceType,
        description: form.description,
        fileName: form.fileName || undefined,
        fileUrl: form.fileUrl || undefined,
        notes: form.notes || undefined,
      });
      setMessage("Evidencia registrada correctamente.");
    }

    clearForm();
    setItems(getEvidenceItems());
  }

  function startEdit(item: EvidenceItem): void {
    setEditingId(item.id);
    setForm({
      title: item.title,
      evidenceType: item.evidenceType,
      description: item.description,
      fileName: item.fileName ?? "",
      fileUrl: item.fileUrl ?? "",
      notes: item.notes ?? "",
    });
    setMessage("");
  }

  function removeItem(id: string): void {
    deleteEvidenceItem(id);
    setItems(getEvidenceItems());
  }

  if (!mounted) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Evidencias NOM-035</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-4 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Evidencias NOM-035</h1>
        <p className="mt-1 text-slate-700">
          Organiza la documentacion relacionada con la evaluacion, difusion, resultados, acciones y
          seguimiento de la NOM-035.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total evidencias</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Politica</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.politica}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Resultados / reportes</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.resultadosReportes}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Plan de accion</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.planAccion}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Capacitacion / difusion</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.capacitacionDifusion}</p>
        </article>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Checklist de cumplimiento documental</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  item.completed ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <span className={item.completed ? "text-slate-800" : "text-slate-600"}>
                {item.label}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  item.completed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.completed ? "Completo" : "Incompleto"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingId ? "Editar evidencia" : "Registrar evidencia"}
        </h2>
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          En esta version local se registra la referencia del archivo. La carga real de documentos se
          conectara cuando se active Supabase Storage.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            Titulo
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Tipo de evidencia
            <select
              value={form.evidenceType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, evidenceType: e.target.value as EvidenceItem["evidenceType"] }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="politica">Politica</option>
              <option value="difusion">Difusion</option>
              <option value="resultados">Resultados</option>
              <option value="reporte">Reporte</option>
              <option value="capacitacion">Capacitacion</option>
              <option value="plan_accion">Plan de accion</option>
              <option value="quejas">Quejas</option>
              <option value="canalizacion">Canalizacion</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="text-sm text-slate-700 sm:col-span-2">
            Descripcion
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Nombre del archivo o documento
            <input
              value={form.fileName}
              onChange={(e) => setForm((prev) => ({ ...prev, fileName: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            URL del archivo (opcional)
            <input
              value={form.fileUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, fileUrl: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700 sm:col-span-2">
            Notas
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editingId ? "Guardar cambios" : "Registrar evidencia"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(INITIAL_FORM);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>
        {message ? (
          <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {message}
          </p>
        ) : null}
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            Filtro por tipo
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="politica">Politica</option>
              <option value="difusion">Difusion</option>
              <option value="resultados">Resultados</option>
              <option value="reporte">Reporte</option>
              <option value="capacitacion">Capacitacion</option>
              <option value="plan_accion">Plan de accion</option>
              <option value="quejas">Quejas</option>
              <option value="canalizacion">Canalizacion</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Busqueda por titulo o descripcion
            <input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
          Sin evidencias registradas. Agrega documentos o referencias para respaldar el proceso
          NOM-035.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm text-slate-800">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 font-semibold">Titulo</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Descripcion</th>
                <th className="px-3 py-2 font-semibold">Archivo/URL</th>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Notas</th>
                <th className="px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2">{getEvidenceTypeLabel(item.evidenceType)}</td>
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2">
                    <p>{item.fileName || "-"}</p>
                    {item.fileUrl ? (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline"
                      >
                        {item.fileUrl}
                      </a>
                    ) : (
                      <span className="text-slate-500">Sin URL</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{new Date(item.createdAt).toLocaleDateString("es-MX")}</td>
                  <td className="px-3 py-2">{item.notes || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
