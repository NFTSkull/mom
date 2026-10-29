"use client";

import { useMemo, useRef, useState } from "react";
import {
  ANONYMOUS_QUESTIONNAIRE_ITEMS,
  buildAnonymousQuestionnaireDescription,
  questionnaireIsComplete,
} from "@/lib/nom035/anonymous-questionnaire";

type Receipt = {
  folio: string;
  receivedAt: string;
};

type Ratings = Record<string, number>;

const SCALE = [
  { value: 1, label: "Muy en desacuerdo" },
  { value: 2, label: "En desacuerdo" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "De acuerdo" },
  { value: 5, label: "Muy de acuerdo" },
] as const;

export default function CuestionarioAnonimoPage() {
  const [ratings, setRatings] = useState<Ratings>({});
  const [concern, setConcern] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const inFlight = useRef(false);

  const complete = useMemo(
    () => questionnaireIsComplete(ratings),
    [ratings]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || inFlight.current) return;
    setError("");

    if (!complete) {
      setError("Responde las cinco preguntas antes de enviar.");
      return;
    }
    if (!confirmed) {
      setError("Confirma que deseas enviar la respuesta de forma anónima.");
      return;
    }

    inFlight.current = true;
    setSending(true);
    try {
      const description = buildAnonymousQuestionnaireDescription({
        ratings,
        concern,
        suggestion,
      });
      const res = await fetch("/api/public/complaints", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          complaintType: "factores_riesgo_psicosocial",
          description,
          isAnonymous: true,
          reporterName: null,
          reporterContact: null,
          confirm: true,
          website: honeypot,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; folio?: string; receivedAt?: string; message?: string }
        | null;

      if (!res.ok || !json?.ok || !json.folio) {
        setError(json?.message ?? "No se pudo enviar. Intenta nuevamente.");
        return;
      }

      setReceipt({
        folio: json.folio,
        receivedAt: json.receivedAt ?? new Date().toISOString(),
      });
      setRatings({});
      setConcern("");
      setSuggestion("");
      setConfirmed(false);
    } catch {
      setError("Ocurrió un error. Intenta nuevamente.");
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }

  if (receipt) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">NOM-035</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Respuesta recibida</h1>
          <p className="mt-3 text-slate-700">
            Gracias por compartir tu percepción. La respuesta fue enviada de forma anónima al personal autorizado.
          </p>
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="text-slate-500">Folio</p>
            <p className="font-mono text-lg font-semibold text-slate-900">{receipt.folio}</p>
            <p className="mt-2 text-xs text-slate-500">
              Recibido: {new Date(receipt.receivedAt).toLocaleString("es-MX")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReceipt(null)}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Enviar otra respuesta
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="anonymous-questionnaire-page">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">NOM-035</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Cuestionario anónimo</h1>
        <p className="mt-3 text-slate-700">
          Comparte cómo percibes tu ambiente de trabajo. No se solicita nombre, correo, número de empleado, NSS ni datos de contacto.
        </p>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          Esta respuesta se recibe como anónima. Evita escribir nombres u otros datos que puedan identificarte en los campos abiertos.
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Este cuestionario es un canal interno de percepción y no sustituye las Guías de Referencia oficiales de la NOM-035.
        </p>

        <form className="mt-7 space-y-7" onSubmit={(e) => void onSubmit(e)}>
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          {ANONYMOUS_QUESTIONNAIRE_ITEMS.map((item, index) => (
            <fieldset key={item.id} className="rounded-xl border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">
                {index + 1}. {item.label}
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {SCALE.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name={item.id}
                      value={option.value}
                      checked={ratings[item.id] === option.value}
                      onChange={() =>
                        setRatings((prev) => ({ ...prev, [item.id]: option.value }))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <label className="block text-sm font-medium text-slate-900">
            ¿Hay algo que te preocupe y que consideres importante atender?
            <textarea
              className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
              rows={4}
              maxLength={2000}
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="Opcional. No escribas nombres ni datos que puedan identificarte."
            />
          </label>

          <label className="block text-sm font-medium text-slate-900">
            ¿Qué sugerencia harías para mejorar el ambiente de trabajo?
            <textarea
              className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
              rows={4}
              maxLength={2000}
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Opcional."
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            Confirmo que deseo enviar esta respuesta de forma anónima.
          </label>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar respuesta anónima"}
          </button>
        </form>
      </section>
    </main>
  );
}
