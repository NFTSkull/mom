"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TrabajadorEvaluacionGatePage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/trabajador/evaluacion/open", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        redirectTo?: string;
        message?: string;
        code?: string;
      };
      if (cancelled) return;
      if (data.code === "must_change_password") {
        router.replace("/trabajador/cambiar-contrasena");
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.message || "No hay evaluación activa.");
        return;
      }
      router.replace(data.redirectTo || "/evaluacion/contestar");
    })().catch(() => {
      if (!cancelled) setError("No se pudo abrir la evaluación.");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          className="mt-3 text-sm underline"
          onClick={() => router.replace("/trabajador")}
        >
          Volver
        </button>
      </section>
    );
  }

  return <div className="h-24 animate-pulse rounded bg-slate-100" />;
}
