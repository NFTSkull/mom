"use client";

import { useEffect, useMemo, useState } from "react";
import { getActionPlanStats, generateSuggestedActionsFromResults, isActionOverdue } from "@/lib/nom035/action-plan-generator";
import {
  deleteActionPlan,
  getActionPlans,
  getCampaignsLocal,
  getEvaluationRecordsLocal,
  saveActionPlan,
  seedNom035LocalData,
  updateActionPlan,
} from "@/lib/nom035/storage-local";
import type { ActionPlanItem, RiskLevelNom035 } from "@/types/nom035";

type ActionFormState = {
  area: string;
  riskFactor: string;
  riskLevel: RiskLevelNom035;
  actionLevel: ActionPlanItem["actionLevel"];
  actionType: ActionPlanItem["actionType"];
  description: string;
  responsible: string;
  dueDate: string;
  followUpNotes: string;
  status: ActionPlanItem["status"];
};

const INITIAL_FORM: ActionFormState = {
  area: "",
  riskFactor: "",
  riskLevel: "medio",
  actionLevel: "primer_nivel",
  actionType: "organizacional",
  description: "",
  responsible: "",
  dueDate: "",
  followUpNotes: "",
  status: "pendiente",
};

function formatActionLevel(level: ActionPlanItem["actionLevel"]): string {
  if (level === "primer_nivel") return "Primer nivel";
  if (level === "segundo_nivel") return "Segundo nivel";
  return "Tercer nivel";
}

function formatActionType(type: ActionPlanItem["actionType"]): string {
  if (type === "organizacional") return "Organizacional";
  if (type === "grupal") return "Grupal";
  return "Individual confidencial";
}

function formatRiskLevel(level: RiskLevelNom035): string {
  if (level === "nulo") return "Nulo";
  if (level === "bajo") return "Bajo";
  if (level === "medio") return "Medio";
  if (level === "alto") return "Alto";
  return "Muy alto";
}

function formatStatus(status: ActionPlanItem["status"]): string {
  if (status === "pendiente") return "Pendiente";
  if (status === "en_proceso") return "En proceso";
  if (status === "completada") return "Completada";
  return "Cancelada";
}

export default function AdminPlanAccionPage() {
  const [mounted, setMounted] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("");
  const [recordsCount, setRecordsCount] = useState<number>(0);
  const [actions, setActions] = useState<ActionPlanItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActionFormState>(INITIAL_FORM);
  const [message, setMessage] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  function loadLocalData(): void {
    seedNom035LocalData();
    const activeCampaign = getCampaignsLocal()[0] ?? null;
    const allRecords = getEvaluationRecordsLocal();
    setRecordsCount(allRecords.length);
    setCampaignId(activeCampaign?.id ?? "");
    setActions(getActionPlans());
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadLocalData();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const stats = getActionPlanStats(actions);
  const areas = Array.from(new Set(actions.map((item) => item.area))).sort();
  const filteredActions = useMemo(() => {
    return actions.filter((item) => {
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const areaOk = areaFilter === "all" || item.area === areaFilter;
      const riskOk = riskFilter === "all" || item.riskLevel === riskFilter;
      const typeOk = typeFilter === "all" || item.actionType === typeFilter;
      return statusOk && areaOk && riskOk && typeOk;
    });
  }, [actions, statusFilter, areaFilter, riskFilter, typeFilter]);

  function clearForm(): void {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function clearFilters(): void {
    setStatusFilter("all");
    setAreaFilter("all");
    setRiskFilter("all");
    setTypeFilter("all");
  }

  function onSubmitForm(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!campaignId) {
      setMessage("No hay campana activa para asociar la accion.");
      return;
    }

    if (!form.area || !form.riskFactor || !form.description || !form.responsible || !form.dueDate) {
      setMessage("Completa los campos obligatorios para guardar la accion.");
      return;
    }

    if (editingId) {
      updateActionPlan(editingId, {
        area: form.area,
        riskFactor: form.riskFactor,
        riskLevel: form.riskLevel,
        actionLevel: form.actionLevel,
        actionType: form.actionType,
        description: form.description,
        responsible: form.responsible,
        dueDate: form.dueDate,
        followUpNotes: form.followUpNotes,
        status: form.status,
      });
      setMessage("Accion actualizada correctamente.");
    } else {
      saveActionPlan({
        campaignId,
        area: form.area,
        riskFactor: form.riskFactor,
        riskLevel: form.riskLevel,
        actionLevel: form.actionLevel,
        actionType: form.actionType,
        description: form.description,
        responsible: form.responsible,
        dueDate: form.dueDate,
        status: form.status,
        followUpNotes: form.followUpNotes,
      });
      setMessage("Accion creada correctamente.");
    }

    clearForm();
    setActions(getActionPlans());
  }

  function startEdit(action: ActionPlanItem): void {
    setEditingId(action.id);
    setForm({
      area: action.area,
      riskFactor: action.riskFactor,
      riskLevel: action.riskLevel,
      actionLevel: action.actionLevel,
      actionType: action.actionType,
      description: action.description,
      responsible: action.responsible,
      dueDate: action.dueDate,
      followUpNotes: action.followUpNotes,
      status: action.status,
    });
    setMessage("");
  }

  function markStatus(id: string, status: ActionPlanItem["status"]): void {
    updateActionPlan(id, { status });
    setActions(getActionPlans());
  }

  function removeAction(id: string): void {
    deleteActionPlan(id);
    setActions(getActionPlans());
  }

  function generateSuggested(): void {
    if (!campaignId) {
      setMessage("No hay campana activa para generar acciones sugeridas.");
      return;
    }
    const records = getEvaluationRecordsLocal().filter((record) => record.status === "completed");
    const suggested = generateSuggestedActionsFromResults({
      campaignId,
      records,
      existingActions: getActionPlans(),
      responsibleDefault: "RH",
    });

    if (suggested.length === 0) {
      setMessage("No se generaron nuevas acciones sugeridas (ya existen o no hay datos suficientes).");
      return;
    }

    for (const action of suggested) {
      saveActionPlan(action);
    }

    setActions(getActionPlans());
    setMessage(`Se generaron ${suggested.length} acciones sugeridas.`);
  }

  if (!mounted) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Plan de accion NOM-035</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Plan de accion NOM-035</h1>
        <p className="text-slate-700">
          Da seguimiento a las acciones preventivas, correctivas y de intervencion derivadas de los
          resultados de la evaluacion.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total acciones</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pendientes</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.pendientes}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">En proceso</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.enProceso}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Completadas</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.completadas}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Vencidas</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.vencidas}</p>
        </article>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateSuggested}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Generar acciones sugeridas desde resultados
          </button>
          <button
            type="button"
            onClick={() => {
              loadLocalData();
              setMessage("Datos actualizados.");
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Actualizar datos
          </button>
          <span className="text-sm text-slate-600">
            Registros de evaluacion detectados: {recordsCount}
          </span>
        </div>
        {message ? (
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {message}
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmitForm} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingId ? "Editar accion" : "Crear accion manual"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-slate-700">
            Area
            <input
              value={form.area}
              onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Factor de riesgo
            <input
              value={form.riskFactor}
              onChange={(e) => setForm((prev) => ({ ...prev, riskFactor: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Nivel de riesgo
            <select
              value={form.riskLevel}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, riskLevel: e.target.value as RiskLevelNom035 }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="nulo">Nulo</option>
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
              <option value="muy_alto">Muy alto</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Nivel de accion
            <select
              value={form.actionLevel}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  actionLevel: e.target.value as ActionPlanItem["actionLevel"],
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="primer_nivel">Primer nivel</option>
              <option value="segundo_nivel">Segundo nivel</option>
              <option value="tercer_nivel">Tercer nivel</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Tipo de accion
            <select
              value={form.actionType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  actionType: e.target.value as ActionPlanItem["actionType"],
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="organizacional">Organizacional</option>
              <option value="grupal">Grupal</option>
              <option value="individual_confidencial">Individual confidencial</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Responsable
            <input
              value={form.responsible}
              onChange={(e) => setForm((prev) => ({ ...prev, responsible: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700 lg:col-span-2">
            Descripcion
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              rows={3}
            />
          </label>
          <label className="text-sm text-slate-700">
            Fecha compromiso
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Estado
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as ActionPlanItem["status"],
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label className="text-sm text-slate-700 lg:col-span-3">
            Notas de seguimiento
            <textarea
              value={form.followUpNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, followUpNotes: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              rows={2}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editingId ? "Guardar cambios" : "Crear accion"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={clearForm}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-slate-700">
            Estado
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Area
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Nivel de riesgo
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="nulo">Nulo</option>
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
              <option value="muy_alto">Muy alto</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Tipo de accion
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="organizacional">Organizacional</option>
              <option value="grupal">Grupal</option>
              <option value="individual_confidencial">Individual confidencial</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Limpiar filtros
        </button>
      </div>

      {actions.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
          Sin acciones registradas. Puedes generar acciones sugeridas desde los resultados o crear una
          accion manual.
        </p>
      ) : null}

      {actions.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1300px] text-left text-sm text-slate-800">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 font-semibold">Area</th>
                <th className="px-3 py-2 font-semibold">Factor</th>
                <th className="px-3 py-2 font-semibold">Riesgo</th>
                <th className="px-3 py-2 font-semibold">Nivel de accion</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Accion</th>
                <th className="px-3 py-2 font-semibold">Responsable</th>
                <th className="px-3 py-2 font-semibold">Fecha compromiso</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Notas</th>
                <th className="px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredActions.map((action) => (
                <tr key={action.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-2">{action.area}</td>
                  <td className="px-3 py-2">{action.riskFactor}</td>
                  <td className="px-3 py-2">{formatRiskLevel(action.riskLevel)}</td>
                  <td className="px-3 py-2">{formatActionLevel(action.actionLevel)}</td>
                  <td className="px-3 py-2">{formatActionType(action.actionType)}</td>
                  <td className="px-3 py-2">{action.description}</td>
                  <td className="px-3 py-2">{action.responsible}</td>
                  <td className="px-3 py-2">
                    {action.dueDate}
                    {isActionOverdue(action) ? (
                      <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Vencida
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{formatStatus(action.status)}</td>
                  <td className="px-3 py-2">{action.followUpNotes || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(action)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => markStatus(action.id, "completada")}
                        className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                      >
                        Completar
                      </button>
                      <button
                        type="button"
                        onClick={() => markStatus(action.id, "cancelada")}
                        className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAction(action.id)}
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
