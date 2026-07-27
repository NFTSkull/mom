"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type CompanyForm = {
  razonSocial: string;
  rfc: string;
  domicilio: string;
  telefono: string;
  actividadPrincipal: string;
  totalTrabajadores: number;
  responsableNombre: string;
  responsableEmail: string;
  responsableTelefono: string;
};

const EMPTY: CompanyForm = {
  razonSocial: "",
  rfc: "",
  domicilio: "",
  telefono: "",
  actividadPrincipal: "",
  totalTrabajadores: 0,
  responsableNombre: "",
  responsableEmail: "",
  responsableTelefono: "",
};

export default function AdminConfiguracionPage() {
  const [form, setForm] = useState<CompanyForm>(EMPTY);
  const [activeWorkersCount, setActiveWorkersCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    const res = await adminApi.getCompany();
    if (!res.ok) {
      setStatus("error");
      setError(res.message);
      setConnected(false);
      return;
    }
    setConnected(true);
    setActiveWorkersCount(res.activeWorkersCount ?? 0);
    const c = res.company;
    if (c) {
      setForm({
        razonSocial: String(c.razonSocial ?? ""),
        rfc: String(c.rfc ?? ""),
        domicilio: String(c.domicilio ?? ""),
        telefono: String(c.telefono ?? ""),
        actividadPrincipal: String(c.actividadPrincipal ?? ""),
        totalTrabajadores: Number(c.totalTrabajadores ?? 0),
        responsableNombre: String(c.responsableNombre ?? ""),
        responsableEmail: String(c.responsableEmail ?? ""),
        responsableTelefono: String(c.responsableTelefono ?? ""),
      });
      setUpdatedAt(c.updatedAt ? String(c.updatedAt) : null);
    }
    setStatus("idle");
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");
    const res = await adminApi.putCompany({
      razonSocial: form.razonSocial,
      rfc: form.rfc || null,
      domicilio: form.domicilio || null,
      telefono: form.telefono || null,
      actividadPrincipal: form.actividadPrincipal || null,
      totalTrabajadores: form.totalTrabajadores,
      responsableNombre: form.responsableNombre || null,
      responsableEmail: form.responsableEmail || null,
      responsableTelefono: form.responsableTelefono || null,
    });
    if (!res.ok) {
      setStatus("error");
      setError(res.message);
      return;
    }
    setError("");
    setStatus("saved");
    const reloaded = await adminApi.getCompany();
    if (reloaded.ok) {
      setConnected(true);
      setActiveWorkersCount(reloaded.activeWorkersCount ?? 0);
      const c = reloaded.company;
      if (c) {
        setForm({
          razonSocial: String(c.razonSocial ?? ""),
          rfc: String(c.rfc ?? ""),
          domicilio: String(c.domicilio ?? ""),
          telefono: String(c.telefono ?? ""),
          actividadPrincipal: String(c.actividadPrincipal ?? ""),
          totalTrabajadores: Number(c.totalTrabajadores ?? 0),
          responsableNombre: String(c.responsableNombre ?? ""),
          responsableEmail: String(c.responsableEmail ?? ""),
          responsableTelefono: String(c.responsableTelefono ?? ""),
        });
        setUpdatedAt(c.updatedAt ? String(c.updatedAt) : null);
      }
    }
  }

  const mismatch = form.totalTrabajadores !== activeWorkersCount;

  return (
    <section className="space-y-4" data-testid="admin-config-page">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Configuración de empresa</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fuente de datos: Supabase local · Conexión:{" "}
          <span data-testid="admin-config-connection">{connected ? "conectada" : "sin conexión"}</span>
          {updatedAt ? ` · Actualizado: ${new Date(updatedAt).toLocaleString("es-MX")}` : null}
        </p>
      </header>

      {status === "loading" ? (
        <div className="h-32 animate-pulse rounded bg-slate-100" />
      ) : (
        <form onSubmit={onSave} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            Razón social *
            <input
              data-testid="config-razon-social"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.razonSocial}
              onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              RFC
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.rfc}
                onChange={(e) => setForm({ ...form, rfc: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Total declarado por empresa
              <input
                data-testid="config-total-trabajadores"
                type="number"
                min={0}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.totalTrabajadores}
                onChange={(e) =>
                  setForm({ ...form, totalTrabajadores: Number(e.target.value) || 0 })
                }
              />
            </label>
          </div>
          <p className="text-sm text-slate-700" data-testid="config-active-workers">
            Trabajadores registrados activos: {activeWorkersCount}
          </p>
          {mismatch ? (
            <p
              role="status"
              className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              data-testid="config-mismatch-warning"
            >
              El total declarado ({form.totalTrabajadores}) difiere de los trabajadores activos
              registrados ({activeWorkersCount}). No se corrige automáticamente.
            </p>
          ) : null}
          <label className="block text-sm">
            Domicilio
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={form.domicilio}
              onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Teléfono
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Actividad principal
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.actividadPrincipal}
                onChange={(e) => setForm({ ...form, actividadPrincipal: e.target.value })}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              Responsable
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.responsableNombre}
                onChange={(e) => setForm({ ...form, responsableNombre: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Email responsable
              <input
                type="email"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.responsableEmail}
                onChange={(e) => setForm({ ...form, responsableEmail: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Teléfono responsable
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.responsableTelefono}
                onChange={(e) => setForm({ ...form, responsableTelefono: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              data-testid="config-save"
              disabled={status === "saving"}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {status === "saving" ? "Guardando…" : "Guardar"}
            </button>
            <span data-testid="config-feedback" className="text-sm text-slate-700">
              {status === "saved" ? "Guardado" : status === "error" ? error : null}
            </span>
          </div>
        </form>
      )}
    </section>
  );
}
