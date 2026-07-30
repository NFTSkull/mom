"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type WorkerRow = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  departamento: string | null;
  puesto: string | null;
  turno: string | null;
  sucursal: string | null;
  jefeDirecto: string | null;
  antiguedad: string | null;
  externalReference: string | null;
  activo: boolean;
  accountStatus?: string;
  evaluationStatus?: string;
  evaluationStartedAt?: string | null;
  evaluationCompletedAt?: string | null;
};

const ACCOUNT_LABEL: Record<string, string> = {
  sin_cuenta: "Sin cuenta",
  invitado: "Invitado",
  activo: "Activo",
  bloqueado: "Bloqueado",
};

const EVAL_LABEL: Record<string, string> = {
  sin_asignar: "Sin asignar",
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
};

type FormState = {
  nombre: string;
  email: string;
  telefono: string;
  departamento: string;
  puesto: string;
  turno: string;
  sucursal: string;
  jefeDirecto: string;
  antiguedad: string;
  externalReference: string;
};

const EMPTY: FormState = {
  nombre: "",
  email: "",
  telefono: "",
  departamento: "",
  puesto: "",
  turno: "",
  sucursal: "",
  jefeDirecto: "",
  antiguedad: "",
  externalReference: "",
};

export default function AdminTrabajadoresPage() {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activoFilter, setActivoFilter] = useState<"all" | "true" | "false">("all");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [csvPreview, setCsvPreview] = useState<{
    rows: unknown[];
    errors: unknown[];
    ok: boolean;
  } | null>(null);
  const [csvText, setCsvText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) q.set("search", search);
    if (activoFilter !== "all") q.set("activo", activoFilter);
    const res = await adminApi.listWorkers(q);
    if (res.ok) {
      setWorkers((res.items as WorkerRow[]) ?? []);
      setTotal(res.total ?? 0);
    } else {
      setMessage(res.message);
    }
    setLoading(false);
  }, [page, search, activoFilter]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      nombre: form.nombre,
      email: form.email || null,
      telefono: form.telefono || null,
      departamento: form.departamento || null,
      puesto: form.puesto || null,
      turno: form.turno || null,
      sucursal: form.sucursal || null,
      jefeDirecto: form.jefeDirecto || null,
      antiguedad: form.antiguedad || null,
      externalReference: form.externalReference || null,
    };
    const res = editingId
      ? await adminApi.updateWorker(editingId, body)
      : await adminApi.createWorker(body);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setMessage(editingId ? "Trabajador actualizado." : "Trabajador creado.");
    setForm(EMPTY);
    setEditingId(null);
    await load();
  }

  async function onCsvFile(file: File) {
    if (file.size > 1_500_000) {
      setMessage("Archivo demasiado grande.");
      return;
    }
    const text = await file.text();
    setCsvText(text);
    const res = await adminApi.validateImport(text);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    const preview = res.preview as { rows: unknown[]; errors: unknown[]; ok: boolean };
    setCsvPreview(preview);
    setMessage(preview.ok ? "Vista previa lista. Confirma la importación." : "Hay errores en el CSV.");
  }

  async function onCommitCsv() {
    if (!csvPreview?.ok) return;
    const rows = (csvPreview.rows as Array<Record<string, unknown>>).map((r) => ({
      nombre: r.nombre,
      email: r.email ?? null,
      telefono: r.telefono ?? null,
      departamento: r.departamento ?? null,
      puesto: r.puesto ?? null,
      turno: r.turno ?? null,
      sucursal: r.sucursal ?? null,
      jefe_directo: r.jefe_directo ?? null,
      antiguedad: r.antiguedad ?? null,
      referencia_externa: r.referencia_externa ?? null,
      activo: r.activo ?? true,
    }));
    const res = await adminApi.commitImport(rows);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setMessage(`Importación completada: ${res.inserted ?? 0} insertados.`);
    setCsvPreview(null);
    setCsvText("");
    await load();
  }

  return (
    <section className="space-y-4" data-testid="admin-workers-page">
      <h1 className="text-2xl font-semibold text-slate-900">Trabajadores</h1>
      <p className="text-sm text-slate-600">
        Datos centrales en Supabase (sin almacenamiento del navegador como fuente primaria).
      </p>

      <form onSubmit={onSubmit} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">{editingId ? "Editar" : "Alta"}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["nombre", "Nombre *"],
              ["email", "Email"],
              ["telefono", "Teléfono"],
              ["departamento", "Departamento"],
              ["puesto", "Puesto"],
              ["turno", "Turno"],
              ["sucursal", "Sucursal"],
              ["jefeDirecto", "Jefe directo"],
              ["antiguedad", "Antigüedad"],
              ["externalReference", "Referencia externa"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <input
                data-testid={`worker-field-${key}`}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key === "nombre"}
              />
            </label>
          ))}
        </div>
        <button
          type="submit"
          data-testid="worker-save"
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Guardar
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Importar CSV</h2>
        <input
          data-testid="worker-csv-input"
          type="file"
          accept=".csv,text/csv"
          className="mt-2 block text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onCsvFile(f);
          }}
        />
        {csvPreview ? (
          <div className="mt-3 space-y-2" data-testid="worker-csv-preview">
            <p className="text-sm">
              Filas: {csvPreview.rows.length} · Errores:{" "}
              {(csvPreview.errors as unknown[]).length}
            </p>
            {csvPreview.ok ? (
              <button
                type="button"
                data-testid="worker-csv-commit"
                onClick={() => void onCommitCsv()}
                className="rounded bg-emerald-700 px-3 py-2 text-sm text-white"
              >
                Confirmar importación atómica
              </button>
            ) : (
              <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
                {JSON.stringify(csvPreview.errors, null, 2)}
              </pre>
            )}
            {!csvText ? null : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          data-testid="worker-search"
          placeholder="Buscar…"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          data-testid="worker-activo-filter"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={activoFilter}
          onChange={(e) => {
            setPage(1);
            setActivoFilter(e.target.value as typeof activoFilter);
          }}
        >
          <option value="all">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {message ? (
        <p data-testid="worker-message" className="text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Número</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Puesto</th>
              <th className="px-3 py-2">Depto</th>
              <th className="px-3 py-2">Cuenta</th>
              <th className="px-3 py-2">Evaluación</th>
              <th className="px-3 py-2">Inicio</th>
              <th className="px-3 py-2">Envío</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-4">
                  Cargando…
                </td>
              </tr>
            ) : workers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4">
                  Sin trabajadores
                </td>
              </tr>
            ) : (
              workers.map((w) => (
                <tr key={w.id} className="border-t border-slate-100" data-testid={`worker-row-${w.id}`}>
                  <td className="px-3 py-2">{w.externalReference ?? "—"}</td>
                  <td className="px-3 py-2">{w.nombre}</td>
                  <td className="px-3 py-2">{w.puesto ?? "—"}</td>
                  <td className="px-3 py-2">{w.departamento ?? "—"}</td>
                  <td
                    className="px-3 py-2"
                    data-testid={`worker-account-status-${w.id}`}
                  >
                    {ACCOUNT_LABEL[w.accountStatus ?? "sin_cuenta"] ??
                      w.accountStatus ??
                      "—"}
                  </td>
                  <td
                    className="px-3 py-2"
                    data-testid={`worker-eval-status-${w.id}`}
                  >
                    {EVAL_LABEL[w.evaluationStatus ?? "sin_asignar"] ??
                      w.evaluationStatus ??
                      "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {w.evaluationStartedAt
                      ? new Date(w.evaluationStartedAt).toLocaleString("es-MX")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {w.evaluationCompletedAt
                      ? new Date(w.evaluationCompletedAt).toLocaleString("es-MX")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => {
                          setEditingId(w.id);
                          setForm({
                            nombre: w.nombre,
                            email: w.email ?? "",
                            telefono: w.telefono ?? "",
                            departamento: w.departamento ?? "",
                            puesto: w.puesto ?? "",
                            turno: w.turno ?? "",
                            sucursal: w.sucursal ?? "",
                            jefeDirecto: w.jefeDirecto ?? "",
                            antiguedad: w.antiguedad ?? "",
                            externalReference: w.externalReference ?? "",
                          });
                        }}
                      >
                        Editar
                      </button>
                      {w.accountStatus && w.accountStatus !== "sin_cuenta" ? (
                        <button
                          type="button"
                          data-testid={`worker-account-toggle-${w.id}`}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={async () => {
                            const active = w.accountStatus === "bloqueado";
                            await adminApi.setWorkerAccountActive(w.id, active);
                            await load();
                          }}
                        >
                          {w.accountStatus === "bloqueado"
                            ? "Desbloquear cuenta"
                            : "Bloquear cuenta"}
                        </button>
                      ) : null}
                      {w.accountStatus && w.accountStatus !== "sin_cuenta" ? (
                        <button
                          type="button"
                          data-testid={`worker-account-reset-${w.id}`}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={async () => {
                            const res = await adminApi.resetWorkerAccess(w.id);
                            if (res.ok && "temporaryPassword" in res && res.temporaryPassword) {
                              // Entrega única al admin; no se guarda en estado de lista.
                              window.prompt(
                                "Contraseña temporal (cópiela ahora; no se volverá a mostrar):",
                                res.temporaryPassword
                              );
                              setMessage("Acceso regenerado. Entregue la contraseña por canal seguro.");
                            } else if (!res.ok) {
                              setMessage(res.message);
                            } else {
                              setMessage("Acceso regenerado.");
                            }
                            await load();
                          }}
                        >
                          Regenerar acceso
                        </button>
                      ) : null}
                      {w.activo ? (
                        <button
                          type="button"
                          data-testid={`worker-deactivate-${w.id}`}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={async () => {
                            await adminApi.deactivateWorker(w.id);
                            await load();
                          }}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid={`worker-reactivate-${w.id}`}
                          className="rounded border px-2 py-1 text-xs"
                          onClick={async () => {
                            await adminApi.reactivateWorker(w.id);
                            await load();
                          }}
                        >
                          Reactivar
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`worker-delete-${w.id}`}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                        onClick={async () => {
                          const res = await adminApi.deleteWorker(w.id);
                          setMessage(res.ok ? "Eliminado." : res.message);
                          await load();
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          Página {page} · {total} total
        </span>
        <button
          type="button"
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
