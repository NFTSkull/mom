"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { exchangeToken } from "@/lib/nom035/client/public-evaluation-api";

type ExchangeState =
  | "verifying"
  | "ready"
  | "invalid"
  | "expired"
  | "revoked"
  | "completed"
  | "unavailable"
  | "error";

const MESSAGES: Record<ExchangeState, { title: string; body: string }> = {
  verifying: {
    title: "Verificando enlace…",
    body: "Estamos validando tu acceso. Un momento, por favor.",
  },
  ready: {
    title: "Continuar evaluación",
    body: "Tu enlace es válido. Continuarás a la evaluación.",
  },
  invalid: {
    title: "Enlace no válido",
    body: "Este enlace no es válido o ya no está disponible. Solicita uno nuevo a tu organización.",
  },
  expired: {
    title: "Enlace vencido",
    body: "Este enlace ha vencido. Solicita uno nuevo a tu organización.",
  },
  revoked: {
    title: "Enlace revocado",
    body: "Este enlace ya no está disponible. Solicita uno nuevo a tu organización.",
  },
  completed: {
    title: "Evaluación ya completada",
    body: "Esta evaluación ya fue enviada. Gracias por tu participación.",
  },
  unavailable: {
    title: "Evaluación no disponible",
    body: "La evaluación no está disponible en este momento. Intenta más tarde o solicita apoyo a tu organización.",
  },
  error: {
    title: "Error temporal",
    body: "No pudimos verificar el enlace. Intenta de nuevo en unos minutos.",
  },
};

function mapCode(code: string): ExchangeState {
  if (code === "expired") return "expired";
  if (code === "revoked") return "revoked";
  if (code === "completed" || code === "conflict") return "completed";
  if (code === "campaign_unavailable" || code === "worker_inactive") return "unavailable";
  if (code === "not_found" || code === "invalid_token" || code === "version_mismatch") {
    return "invalid";
  }
  return "error";
}

export default function EvaluacionTokenExchangePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<ExchangeState>("verifying");

  useEffect(() => {
    let cancelled = false;
    const token = typeof params.token === "string" ? params.token : "";

    async function run() {
      if (!token) {
        setState("invalid");
        return;
      }
      const result = await exchangeToken(token);
      if (cancelled) return;
      if (!result.ok) {
        setState(mapCode(result.code));
        return;
      }
      setState("ready");
      // El token desaparece de la URL: se redirige a /evaluacion/contestar.
      router.replace("/evaluacion/contestar");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [params.token, router]);

  const msg = MESSAGES[state];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <main className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">{msg.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">{msg.body}</p>
        {state === "verifying" ? (
          <p className="mt-4 text-xs text-slate-500" role="status" aria-live="polite">
            Verificando…
          </p>
        ) : null}
      </main>
    </div>
  );
}
