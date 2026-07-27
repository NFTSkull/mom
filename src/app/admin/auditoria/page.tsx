"use client";

import { useCallback, useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
};

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (action) qs.set("action", action);
    const res = await fetch(`/api/admin/nom035/audit?${qs.toString()}`);
    const data = await res.json();
    if (!data.ok) {
      setError(data.message ?? "No se pudo cargar la auditoría.");
      return;
    }
    setError(null);
    setEvents(data.events ?? []);
  }, [action]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Auditoría</h1>
      <div className="flex gap-2">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filtrar acción"
          className="rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
        >
          Filtrar
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Entidad</th>
            <th>Metadata</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b align-top">
              <td className="py-2">{new Date(e.createdAt).toLocaleString()}</td>
              <td className="font-mono text-xs">{e.actorUserId ?? "—"}</td>
              <td>{e.action}</td>
              <td>
                {e.entityType}
                {e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}
              </td>
              <td className="max-w-xs truncate font-mono text-xs">
                {JSON.stringify(e.metadata)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
