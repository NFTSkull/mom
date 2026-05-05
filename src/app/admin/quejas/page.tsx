"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getComplaintStats,
  getComplaintStatusLabel,
  getComplaintTypeLabel,
} from "@/lib/nom035/complaint-analytics";
import {
  deleteComplaint,
  getComplaints,
  seedNom035LocalData,
  updateComplaint,
} from "@/lib/nom035/storage-local";
import type { ConfidentialComplaint } from "@/types/nom035";

type RowDraft = {
  status: ConfidentialComplaint["status"];
  assignedTo: string;
  resolutionNotes: string;
};

function truncate(text: string, size = 80): string {
  if (text.length <= size) return text;
  return `${text.slice(0, size)}...`;
}

export default function AdminQuejasPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<ConfidentialComplaint[]>([]);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  function loadData(): void {
    seedNom035LocalData();
    const loaded = getComplaints();
    setItems(loaded);
    setDrafts(
      Object.fromEntries(
        loaded.map((item) => [
          item.id,
          {
            status: item.status,
            assignedTo: item.assignedTo ?? "",
            resolutionNotes: item.resolutionNotes ?? "",
          },
        ])
      )
    );
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadData();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const stats = getComplaintStats(items);

  const filteredItems = useMemo(() => {
    const search = searchFilter.trim().toLowerCase();
    return items.filter((item) => {
      const typeOk = typeFilter === "all" || item.complaintType === typeFilter;
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const text = `${item.folio} ${item.description}`.toLowerCase();
      const searchOk = search.length === 0 || text.includes(search);
      return typeOk && statusOk && searchOk;
    });
  }, [items, searchFilter, statusFilter, typeFilter]);

  const selectedComplaint = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;

  function updateDraft(id: string, patch: Partial<RowDraft>): void {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        status: prev[id]?.status ?? "recibida",
        assignedTo: prev[id]?.assignedTo ?? "",
        resolutionNotes: prev[id]?.resolutionNotes ?? "",
        ...patch,
      },
    }));
  }

  function saveRowChanges(id: string): void {
    const row = drafts[id];
    if (!row) return;
    updateComplaint(id, {
      status: row.status,
      assignedTo: row.assignedTo,
      resolutionNotes: row.resolutionNotes,
    });
    setMessage("Cambios guardados en la queja seleccionada.");
    setItems(getComplaints());
  }

  function closeComplaint(id: string): void {
    updateComplaint(id, { status: "cerrada" });
    setMessage("Queja cerrada correctamente.");
    setItems(getComplaints());
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { assignedTo: "", resolutionNotes: "" }),
        status: "cerrada",
      },
    }));
  }

  function removeComplaint(id: string): void {
    deleteComplaint(id);
    setMessage("Queja eliminada.");
    setItems(getComplaints());
    if (selectedId === id) {
      setSelectedId(null);
    }
  }

  if (!mounted) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Quejas confidenciales</h1>
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
        <h1 className="text-2xl font-semibold text-slate-900">Quejas confidenciales</h1>
        <p className="mt-1 text-slate-700">
          Administra los reportes recibidos mediante el canal confidencial. La informacion debe
          tratarse con reserva y unicamente por personal autorizado.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total reportes</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Recibidas</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.recibidas}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">En revision</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.enRevision}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Resueltas</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.resueltas}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Cerradas</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.cerradas}</p>
        </article>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-700">
            Tipo de reporte
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="violencia_laboral">{getComplaintTypeLabel("violencia_laboral")}</option>
              <option value="entorno_organizacional">
                {getComplaintTypeLabel("entorno_organizacional")}
              </option>
              <option value="factores_riesgo_psicosocial">
                {getComplaintTypeLabel("factores_riesgo_psicosocial")}
              </option>
              <option value="otro">{getComplaintTypeLabel("otro")}</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Estado
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="recibida">{getComplaintStatusLabel("recibida")}</option>
              <option value="en_revision">{getComplaintStatusLabel("en_revision")}</option>
              <option value="resuelta">{getComplaintStatusLabel("resuelta")}</option>
              <option value="cerrada">{getComplaintStatusLabel("cerrada")}</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Busqueda por folio o descripcion
            <input
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {message ? (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {message}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
          Todavia no hay reportes registrados en el canal confidencial.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1200px] text-left text-sm text-slate-800">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 font-semibold">Folio</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Descripcion resumida</th>
                <th className="px-3 py-2 font-semibold">Identificacion</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Asignado a</th>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const row = drafts[item.id] ?? {
                  status: item.status,
                  assignedTo: item.assignedTo ?? "",
                  resolutionNotes: item.resolutionNotes ?? "",
                };
                return (
                  <tr key={item.id} className="border-t border-slate-200 align-top hover:bg-slate-50">
                    <td className="px-3 py-2">{item.folio}</td>
                    <td className="px-3 py-2">{getComplaintTypeLabel(item.complaintType)}</td>
                    <td className="px-3 py-2">{truncate(item.description)}</td>
                    <td className="px-3 py-2">{item.isAnonymous ? "Anonima" : "Con datos de contacto"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.status}
                        onChange={(event) =>
                          updateDraft(item.id, {
                            status: event.target.value as ConfidentialComplaint["status"],
                          })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="recibida">{getComplaintStatusLabel("recibida")}</option>
                        <option value="en_revision">{getComplaintStatusLabel("en_revision")}</option>
                        <option value="resuelta">{getComplaintStatusLabel("resuelta")}</option>
                        <option value="cerrada">{getComplaintStatusLabel("cerrada")}</option>
                      </select>
                    </td>
                    <td className="space-y-2 px-3 py-2">
                      <input
                        value={row.assignedTo}
                        onChange={(event) => updateDraft(item.id, { assignedTo: event.target.value })}
                        placeholder="Responsable"
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <textarea
                        rows={2}
                        value={row.resolutionNotes}
                        onChange={(event) => updateDraft(item.id, { resolutionNotes: event.target.value })}
                        placeholder="Notas de resolucion"
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">{new Date(item.createdAt).toLocaleDateString("es-MX")}</td>
                    <td className="space-y-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="block rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Ver detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => saveRowChanges(item.id)}
                        className="block rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-50"
                      >
                        Guardar cambios
                      </button>
                      <button
                        type="button"
                        onClick={() => closeComplaint(item.id)}
                        className="block rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeComplaint(item.id)}
                        className="block rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedComplaint ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Detalle de reporte</h2>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
            >
              Cerrar detalle
            </button>
          </div>
          <dl className="mt-3 grid gap-2 text-sm text-slate-800 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Folio</dt>
              <dd>{selectedComplaint.folio}</dd>
            </div>
            <div>
              <dt className="font-semibold">Tipo</dt>
              <dd>{getComplaintTypeLabel(selectedComplaint.complaintType)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold">Descripcion completa</dt>
              <dd>{selectedComplaint.description}</dd>
            </div>
            <div>
              <dt className="font-semibold">Identificacion</dt>
              <dd>{selectedComplaint.isAnonymous ? "Anonima" : "Con datos de contacto"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Estado</dt>
              <dd>{getComplaintStatusLabel(selectedComplaint.status)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Responsable</dt>
              <dd>{selectedComplaint.assignedTo || "Sin asignar"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Fecha de creacion</dt>
              <dd>{new Date(selectedComplaint.createdAt).toLocaleString("es-MX")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold">Notas de resolucion</dt>
              <dd>{selectedComplaint.resolutionNotes || "Sin notas"}</dd>
            </div>
            {!selectedComplaint.isAnonymous ? (
              <div className="sm:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <dt className="font-semibold">Datos de contacto (uso reservado)</dt>
                <dd className="mt-1">
                  {selectedComplaint.reporterName || "-"} / {selectedComplaint.reporterContact || "-"}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </section>
  );
}
