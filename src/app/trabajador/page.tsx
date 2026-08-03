"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PortalState = {
  ok: boolean;
  mustChangePassword?: boolean;
  evaluationStatus?: string;
  assignment?: { status: string; campaignName?: string } | null;
  worker?: { nombre?: string };
  message?: string;
  code?: string;
};

export default function TrabajadorHubPage() {
  const router = useRouter();
  const [state, setState] = useState<PortalState | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/trabajador/me");
    const data = (await res.json()) as PortalState;
    if (res.status === 401) {
      router.replace("/trabajador/login");
      return;
    }
    if (!res.ok || !data.ok) {
      setError(data.message || "No se pudo cargar el portal.");
      setState(null);
      return;
    }
    if (data.mustChangePassword) {
      router.replace("/trabajador/cambiar-contrasena");
      return;
    }
    setState(data);
  }, [router]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [load]);

  async function logout() {
    await fetch("/api/trabajador/logout", { method: "POST" });
    router.replace("/trabajador/login");
  }

  if (error) {
    return (
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={() => void logout()} className="text-sm underline">
          Cerrar sesión
        </button>
      </section>
    );
  }

  if (!state) {
    return <div className="h-24 animate-pulse rounded bg-slate-100" />;
  }

  const status = state.evaluationStatus ?? "none";

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Hola{state.worker?.nombre ? `, ${state.worker.nombre}` : ""}</h1>

      {status === "none" ? (
        <p className="text-sm text-slate-700">
          No tienes una evaluación activa. Comunícate con el responsable de Recursos Humanos.
        </p>
      ) : null}

      {status === "awaiting_campaign" ? (
        <div className="space-y-2" data-testid="worker-awaiting-campaign">
          <h2 className="text-lg font-medium text-slate-900">Evaluación asignada</h2>
          <p className="text-sm text-slate-700">
            Tu evaluación ya fue asignada. Podrás comenzar cuando la campaña sea iniciada.
          </p>
        </div>
      ) : null}

      {status === "pending" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Tienes una evaluación pendiente
            {state.assignment?.campaignName ? `: ${state.assignment.campaignName}` : ""}.
          </p>
          <Link
            href="/trabajador/evaluacion"
            className="inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Comenzar evaluación
          </Link>
        </div>
      ) : null}

      {status === "in_progress" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">Puedes continuar tu evaluación donde la dejaste.</p>
          <Link
            href="/trabajador/evaluacion"
            className="inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Continuar evaluación
          </Link>
        </div>
      ) : null}

      {status === "completed" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">Tu evaluación fue enviada correctamente.</p>
          <Link href="/trabajador/completado" className="text-sm underline">
            Ver confirmación
          </Link>
        </div>
      ) : null}

      <button type="button" onClick={() => void logout()} className="text-sm text-slate-600 underline">
        Cerrar sesión
      </button>
    </section>
  );
}
