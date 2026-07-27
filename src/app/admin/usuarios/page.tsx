"use client";

import { useCallback, useEffect, useState } from "react";

type AdminUser = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  active: boolean;
  canViewSensitiveCases: boolean;
  mfaRequired: boolean;
  lastLoginAt: string | null;
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("rh");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/nom035/users");
    const data = await res.json();
    if (!data.ok) {
      setError(data.message ?? "No se pudo cargar.");
      return;
    }
    setError(null);
    setUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  async function createUser() {
    setError(null);
    const res = await fetch("/api/admin/nom035/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        email,
        role,
        localTemporaryPassword: true,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.message ?? "No se pudo crear.");
      return;
    }
    setNombre("");
    setEmail("");
    await load();
  }

  async function deactivate(id: string) {
    if (!confirm("¿Desactivar este usuario?")) return;
    await fetch(`/api/admin/nom035/users/${id}/deactivate`, { method: "POST" });
    await load();
  }

  async function reactivate(id: string) {
    await fetch(`/api/admin/nom035/users/${id}/reactivate`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuarios administrativos</h1>
      <p className="text-sm text-slate-600">
        No hay registro público. Las invitaciones se gestionan solo desde aquí.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="rounded-md border bg-white p-4">
        <h2 className="font-medium">Invitar / crear (local)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-md border px-3 py-2"
          />
          <input
            placeholder="correo@nom035.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border px-3 py-2"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="admin">admin</option>
            <option value="rh">rh</option>
            <option value="psicologo">psicologo</option>
            <option value="direccion">direccion</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void createUser()}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Crear usuario de prueba
        </button>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Activo</th>
            <th>Sensible</th>
            <th>MFA</th>
            <th>Último acceso</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2">{u.nombre}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.active ? "sí" : "no"}</td>
              <td>{u.canViewSensitiveCases ? "sí" : "no"}</td>
              <td>{u.mfaRequired ? "requerido" : "opcional"}</td>
              <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
              <td className="space-x-2">
                {u.active ? (
                  <button type="button" className="underline" onClick={() => void deactivate(u.id)}>
                    Desactivar
                  </button>
                ) : (
                  <button type="button" className="underline" onClick={() => void reactivate(u.id)}>
                    Reactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
