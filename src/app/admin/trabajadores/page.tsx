"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deactivateWorker,
  deleteWorker,
  getWorkers,
  saveWorker,
  seedNom035LocalData,
  updateWorker,
} from "@/lib/nom035/storage-local";
import type { Worker } from "@/types/nom035";

type WorkerForm = {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  shift: string;
  branch: string;
  directManager: string;
  seniority: string;
  status: Worker["status"];
};

const INITIAL_FORM: WorkerForm = {
  fullName: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  shift: "",
  branch: "",
  directManager: "",
  seniority: "",
  status: "ACTIVE",
};

export default function AdminTrabajadoresPage() {
  const [mounted, setMounted] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState<WorkerForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Worker["status"]>("ALL");

  function loadWorkers(): void {
    seedNom035LocalData();
    setWorkers(getWorkers());
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadWorkers();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const filteredWorkers = useMemo(() => {
    if (statusFilter === "ALL") return workers;
    return workers.filter((worker) => worker.status === statusFilter);
  }, [workers, statusFilter]);

  function clearForm(): void {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.department.trim() || !form.position.trim()) {
      setMessage("Completa nombre, email, departamento y puesto.");
      return;
    }

    if (editingId) {
      updateWorker(editingId, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        department: form.department.trim(),
        position: form.position.trim(),
        shift: form.shift.trim() || undefined,
        branch: form.branch.trim() || undefined,
        directManager: form.directManager.trim() || undefined,
        seniority: form.seniority.trim() || undefined,
        status: form.status,
      });
      setMessage("Trabajador actualizado.");
    } else {
      saveWorker({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        department: form.department.trim(),
        position: form.position.trim(),
        shift: form.shift.trim() || undefined,
        branch: form.branch.trim() || undefined,
        directManager: form.directManager.trim() || undefined,
        seniority: form.seniority.trim() || undefined,
        status: form.status,
      });
      setMessage("Trabajador agregado.");
    }
    clearForm();
    setWorkers(getWorkers());
  }

  function startEdit(worker: Worker): void {
    setEditingId(worker.id);
    setForm({
      fullName: worker.fullName,
      email: worker.email,
      phone: worker.phone ?? "",
      department: worker.department,
      position: worker.position,
      shift: worker.shift ?? "",
      branch: worker.branch ?? "",
      directManager: worker.directManager ?? "",
      seniority: worker.seniority ?? "",
      status: worker.status,
    });
    setMessage("");
  }

  function onDeactivate(id: string): void {
    deactivateWorker(id);
    setWorkers(getWorkers());
    setMessage("Trabajador desactivado.");
  }

  function onDelete(id: string): void {
    deleteWorker(id);
    setWorkers(getWorkers());
    if (editingId === id) clearForm();
    setMessage("Trabajador eliminado.");
  }

  function onCsvUpload(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        setMessage("CSV sin filas de datos.");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const idx = (key: string): number => headers.indexOf(key);
      let imported = 0;
      for (const line of lines.slice(1)) {
        const cols = line.split(",").map((col) => col.trim());
        const fullName = cols[idx("nombre")] ?? "";
        const email = cols[idx("email")] ?? "";
        if (!fullName || !email) continue;
        saveWorker({
          fullName,
          email,
          phone: cols[idx("telefono")] || undefined,
          department: cols[idx("departamento")] || "Sin departamento",
          position: cols[idx("puesto")] || "Sin puesto",
          shift: cols[idx("turno")] || undefined,
          branch: cols[idx("sucursal")] || undefined,
          directManager: cols[idx("jefe_directo")] || undefined,
          seniority: cols[idx("antiguedad")] || undefined,
          status: (cols[idx("activo")] ?? "si").toLowerCase() === "no" ? "INACTIVE" : "ACTIVE",
        });
        imported += 1;
      }
      setWorkers(getWorkers());
      setMessage(`Importación CSV completada. Registros agregados: ${imported}.`);
    };
    reader.readAsText(file);
  }

  if (!mounted) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Trabajadores</h1>
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
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Trabajadores</h1>
        <p className="mt-1 text-slate-700">
          Registra trabajadores manualmente o por CSV para habilitar su enlace individual de evaluación.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingId ? "Editar trabajador" : "Agregar trabajador"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-slate-700">
            Nombre
            <input
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Departamento
            <input
              value={form.department}
              onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Puesto
            <input
              value={form.position}
              onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Turno
            <input
              value={form.shift}
              onChange={(event) => setForm((prev) => ({ ...prev, shift: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Sucursal
            <input
              value={form.branch}
              onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Jefe directo
            <input
              value={form.directManager}
              onChange={(event) => setForm((prev) => ({ ...prev, directManager: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Antigüedad
            <input
              value={form.seniority}
              onChange={(event) => setForm((prev) => ({ ...prev, seniority: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Activo
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Worker["status"] }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Si</option>
              <option value="INACTIVE">No</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editingId ? "Guardar cambios" : "Agregar trabajador"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={clearForm}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Carga por CSV</h2>
        <p className="mt-1 text-sm text-slate-700">
          Encabezados esperados: nombre,email,telefono,departamento,puesto,turno,sucursal,jefe_directo,antiguedad,activo
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onCsvUpload(file);
            event.currentTarget.value = "";
          }}
          className="mt-2 block text-sm text-slate-700"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm text-slate-700">
          Filtro de estado
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | Worker["status"])}
            className="mt-1 w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </label>
      </div>

      {message ? (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1400px] text-left text-sm text-slate-800">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className="px-3 py-2 font-semibold">No. empleado</th>
              <th className="px-3 py-2 font-semibold">Nombre</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">Teléfono</th>
              <th className="px-3 py-2 font-semibold">Departamento</th>
              <th className="px-3 py-2 font-semibold">Puesto</th>
              <th className="px-3 py-2 font-semibold">Turno</th>
              <th className="px-3 py-2 font-semibold">Sucursal</th>
              <th className="px-3 py-2 font-semibold">Jefe directo</th>
              <th className="px-3 py-2 font-semibold">Antigüedad</th>
              <th className="px-3 py-2 font-semibold">Activo</th>
              <th className="px-3 py-2 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {filteredWorkers.map((worker) => (
              <tr key={worker.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-2">{worker.employeeNumber}</td>
                <td className="px-3 py-2">{worker.fullName}</td>
                <td className="px-3 py-2">{worker.email}</td>
                <td className="px-3 py-2">{worker.phone ?? "-"}</td>
                <td className="px-3 py-2">{worker.department}</td>
                <td className="px-3 py-2">{worker.position}</td>
                <td className="px-3 py-2">{worker.shift ?? "-"}</td>
                <td className="px-3 py-2">{worker.branch ?? "-"}</td>
                <td className="px-3 py-2">{worker.directManager ?? "-"}</td>
                <td className="px-3 py-2">{worker.seniority ?? "-"}</td>
                <td className="px-3 py-2">{worker.status === "ACTIVE" ? "Si" : "No"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(worker)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeactivate(worker.id)}
                      className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                    >
                      Desactivar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(worker.id)}
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
    </section>
  );
}
