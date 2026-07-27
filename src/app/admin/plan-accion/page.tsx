"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type ActionPlan = {
  id: string;
  campaignId: string;
  area: string;
  riskFactor: string;
  riskLevel: string;
  actionLevel: string;
  actionType: string;
  description: string;
  responsible: string;
  dueDate: string | null;
  status: "pendiente" | "en_proceso" | "completada" | "cancelada";
  followUpNotes: string;
  source: "manual" | "suggested";
  sourceKey: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

type Summary = {
  total: number;
  pendientes: number;
  enProceso: number;
  completadas: number;
  canceladas: number;
  vencidas: number;
  sugeridas: number;
  manuales: number;
};

type Campaign = { id: string; nombre: string; status: string };

type FormState = {
  area: string;
  riskFactor: string;
  riskLevel: string;
  actionLevel: string;
  actionType: string;
  description: string;
  responsible: string;
  dueDate: string;
  followUpNotes: string;
};

const INITIAL: FormState = {
  area: "",
  riskFactor: "",
  riskLevel: "medio",
  actionLevel: "primer_nivel",
  actionType: "organizacional",
  description: "",
  responsible: "",
  dueDate: "",
  followUpNotes: "",
};

function labelStatus(s: string) {
  if (s === "pendiente") return "Pendiente";
  if (s === "en_proceso") return "En proceso";
  if (s === "completada") return "Completada";
  return "Cancelada";
}

function labelRisk(s: string) {
  if (s === "nulo") return "Nulo";
  if (s === "bajo") return "Bajo";
  if (s === "medio") return "Medio";
  if (s === "alto") return "Alto";
  return "Muy alto";
}

export default function AdminPlanAccionPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [items, setItems] = useState<ActionPlan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (campaignId) q.set("campaignId", campaignId);
    if (statusFilter !== "all") q.set("status", statusFilter);
    if (sourceFilter !== "all") q.set("source", sourceFilter);

    const sumQ = new URLSearchParams();
    if (campaignId) sumQ.set("campaignId", campaignId);

    const [listRes, sumRes] = await Promise.all([
      adminApi.listActionPlans(q),
      adminApi.actionPlanSummary(sumQ),
    ]);

    if (!listRes.ok) {
      setError(listRes.message);
      setItems([]);
    } else {
      setItems((listRes.items as ActionPlan[]) ?? []);
      setTotal(listRes.total ?? 0);
    }
    if (sumRes.ok) setSummary(sumRes.summary as Summary);
    setLoading(false);
  }, [campaignId, statusFilter, sourceFilter, page]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void adminApi.listCampaigns(new URLSearchParams({ page: "1", pageSize: "50" })).then((r) => {
        if (r.ok) {
          const list = (r.items as Campaign[]) ?? [];
          setCampaigns(list);
          const active = list.find((c) => c.status === "active");
          if (active) setCampaignId((prev) => prev || active.id);
        }
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  function clearForm() {
    setForm(INITIAL);
    setEditingId(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignId) {
      setMessage("Selecciona una campaña.");
      return;
    }
    if (!form.area || !form.riskFactor || !form.description || !form.responsible) {
      setMessage("Completa los campos obligatorios.");
      return;
    }
    setBusy(true);
    setMessage("");
    if (editingId) {
      const res = await adminApi.updateActionPlan(editingId, {
        area: form.area,
        riskFactor: form.riskFactor,
        riskLevel: form.riskLevel,
        actionLevel: form.actionLevel,
        actionType: form.actionType,
        description: form.description,
        responsible: form.responsible,
        dueDate: form.dueDate || null,
        followUpNotes: form.followUpNotes,
        clearDueDate: !form.dueDate,
      });
      setMessage(res.ok ? "Acción actualizada." : res.message);
    } else {
      const res = await adminApi.createActionPlan({
        campaignId,
        area: form.area,
        riskFactor: form.riskFactor,
        riskLevel: form.riskLevel,
        actionLevel: form.actionLevel,
        actionType: form.actionType,
        description: form.description,
        responsible: form.responsible,
        dueDate: form.dueDate || null,
        followUpNotes: form.followUpNotes,
      });
      setMessage(res.ok ? "Acción creada." : res.message);
    }
    clearForm();
    setBusy(false);
    await load();
  }

  function startEdit(a: ActionPlan) {
    setEditingId(a.id);
    setForm({
      area: a.area,
      riskFactor: a.riskFactor,
      riskLevel: a.riskLevel,
      actionLevel: a.actionLevel,
      actionType: a.actionType,
      description: a.description,
      responsible: a.responsible,
      dueDate: a.dueDate ?? "",
      followUpNotes: a.followUpNotes ?? "",
    });
    setMessage("");
  }

  async function changeStatus(id: string, status: string) {
    setBusy(true);
    const res = await adminApi.changeActionPlanStatus(id, status);
    setMessage(res.ok ? `Estado: ${labelStatus(status)}.` : res.message);
    setBusy(false);
    await load();
  }

  async function archive(id: string) {
    setBusy(true);
    const res = await adminApi.archiveActionPlan(id);
    setMessage(res.ok ? "Acción archivada." : res.message);
    setBusy(false);
    await load();
  }

  async function generateSuggested() {
    if (!campaignId) {
      setMessage("Selecciona una campaña con resultados centrales.");
      return;
    }
    setBusy(true);
    const res = await adminApi.generateActionPlans({ campaignId });
    if (!res.ok) {
      setMessage(res.message);
    } else {
      setMessage(
        `Generación: ${res.created} creadas, ${res.existing} ya existían, ${res.skipped} omitidas.`
      );
    }
    setBusy(false);
    await load();
  }

  return (
    <section className="space-y-4" data-testid="plan-accion-page">
      <header className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Plan de acción NOM-035</h1>
        <p className="text-slate-700">
          Acciones preventivas y correctivas desde resultados centrales.
        </p>
      </header>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="plan-summary-cards">
          <Card label="Total" value={summary.total} />
          <Card label="Pendientes" value={summary.pendientes} />
          <Card label="En proceso" value={summary.enProceso} />
          <Card label="Completadas" value={summary.completadas} />
          <Card label="Vencidas" value={summary.vencidas} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          Campaña
          <select
            data-testid="plan-campaign-select"
            className="mt-1 block rounded border border-slate-300 px-2 py-1.5"
            value={campaignId}
            onChange={(e) => {
              setCampaignId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.status})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Estado
          <select
            className="mt-1 block rounded border border-slate-300 px-2 py-1.5"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        <label className="text-sm">
          Fuente
          <select
            className="mt-1 block rounded border border-slate-300 px-2 py-1.5"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todas</option>
            <option value="manual">Manual</option>
            <option value="suggested">Sugerida</option>
          </select>
        </label>
        <button
          type="button"
          data-testid="plan-generate"
          disabled={busy || !campaignId}
          onClick={() => void generateSuggested()}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          Generar sugeridas
        </button>
        <button
          type="button"
          data-testid="plan-refresh"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
        >
          Actualizar
        </button>
      </div>

      {message ? (
        <p className="text-sm text-slate-800" data-testid="plan-message">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" data-testid="plan-error">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="plan-form"
      >
        <h2 className="font-semibold text-slate-900">
          {editingId ? "Editar acción" : "Nueva acción manual"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Área" value={form.area} onChange={(v) => setForm({ ...form, area: v })} required testId="plan-area" />
          <Field label="Factor de riesgo" value={form.riskFactor} onChange={(v) => setForm({ ...form, riskFactor: v })} required testId="plan-risk-factor" />
          <label className="text-sm">
            Nivel de riesgo
            <select className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5" value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}>
              {["nulo", "bajo", "medio", "alto", "muy_alto"].map((r) => (
                <option key={r} value={r}>{labelRisk(r)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Nivel de acción
            <select className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5" value={form.actionLevel} onChange={(e) => setForm({ ...form, actionLevel: e.target.value })}>
              <option value="primer_nivel">Primer nivel</option>
              <option value="segundo_nivel">Segundo nivel</option>
              <option value="tercer_nivel">Tercer nivel</option>
            </select>
          </label>
          <label className="text-sm">
            Tipo
            <select className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5" value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}>
              <option value="organizacional">Organizacional</option>
              <option value="grupal">Grupal</option>
              <option value="individual">Individual</option>
              <option value="individual_confidencial">Individual confidencial</option>
            </select>
          </label>
          <Field label="Responsable" value={form.responsible} onChange={(v) => setForm({ ...form, responsible: v })} required testId="plan-responsible" />
          <label className="text-sm">
            Fecha límite
            <input type="date" className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} data-testid="plan-due-date" />
          </label>
        </div>
        <label className="block text-sm">
          Descripción
          <textarea className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5" rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="plan-description" />
        </label>
        <label className="block text-sm">
          Notas de seguimiento
          <textarea className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5" rows={2} value={form.followUpNotes} onChange={(e) => setForm({ ...form, followUpNotes: e.target.value })} />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} data-testid="plan-save" className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">
            {editingId ? "Guardar cambios" : "Crear acción"}
          </button>
          {editingId ? (
            <button type="button" onClick={clearForm} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>

      {loading ? <div className="h-24 animate-pulse rounded bg-slate-100" /> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm" data-testid="plan-table">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Área / Factor</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Fuente</th>
              <th className="px-3 py-2">Vence</th>
              <th className="px-3 py-2">Actualizado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b" data-testid={`plan-row-${a.id}`}>
                <td className="px-3 py-2">
                  <p className="font-medium">{a.area}</p>
                  <p className="text-slate-600">{a.riskFactor}</p>
                  <p className="text-xs text-slate-500">{a.description.slice(0, 80)}</p>
                </td>
                <td className="px-3 py-2">{labelStatus(a.status)}</td>
                <td className="px-3 py-2">{a.source === "suggested" ? "Sugerida" : "Manual"}</td>
                <td className="px-3 py-2">{a.dueDate ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{new Date(a.updatedAt).toLocaleString("es-MX")}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => startEdit(a)}>Editar</button>
                    {a.status === "pendiente" ? (
                      <button type="button" className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => void changeStatus(a.id, "en_proceso")}>En proceso</button>
                    ) : null}
                    {a.status === "pendiente" || a.status === "en_proceso" ? (
                      <button type="button" className="rounded border px-2 py-1 text-xs" disabled={busy} data-testid={`plan-complete-${a.id}`} onClick={() => void changeStatus(a.id, "completada")}>Completar</button>
                    ) : null}
                    {a.status === "pendiente" || a.status === "en_proceso" ? (
                      <button type="button" className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => void changeStatus(a.id, "cancelada")}>Cancelar</button>
                    ) : null}
                    <button type="button" className="rounded border px-2 py-1 text-xs" disabled={busy} onClick={() => void archive(a.id)}>Archivar</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Sin acciones para los filtros actuales.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button type="button" disabled={page <= 1} className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
        <span>Página {page} · {total} total</span>
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

function Field({
  label,
  value,
  onChange,
  required,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  testId?: string;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      />
    </label>
  );
}
