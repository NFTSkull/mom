"use client";

import { useRef, useState } from "react";

type Receipt = {
  folio: string;
  receivedAt: string;
};

const REPORT_MARKER = "REPORTE ANÓNIMO DEL PERSONAL";

export default function ReporteAnonimoPage() {
  const [description, setDescription] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const inFlight = useRef(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || inFlight.current) return;

    const text = description.trim();
    setError("");

    if (text.length < 20) {
      setError("Describe la situación con al menos 20 caracteres.");
      return;
    }

    inFlight.current = true;
    setSending(true);

    try {
      const res = await fetch("/api/public/complaints", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          complaintType: "otro",
          description: `${REPORT_MARKER}\n\n${text}`,
          isAnonymous: true,
          reporterName: null,
          reporterContact: null,
          confirm: true,
          website: honeypot,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            folio?: string;
            receivedAt?: string;
            message?: string;
          }
        | null;

      if (!res.ok || !json?.ok || !json.folio) {
        setError(json?.message ?? "No se pudo enviar el reporte. Intenta nuevamente.");
        return;
      }

      setReceipt({
        folio: json.folio,
        receivedAt: json.receivedAt ?? new Date().toISOString(),
      });
      setDescription("");
      setHoneypot("");
    } catch {
      setError("Ocurrió un error. Intenta nuevamente.");
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }

  if (receipt) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10" data-testid="anonymous-report-receipt">
        <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">NOM-035</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Reporte recibido</h1>
          <p className="mt-3 text-slate-700">
            Tu reporte fue enviado de forma anónima y será revisado por personal autorizado.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Folio</p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-900">{receipt.folio}</p>
          </div>

          <button
            type="button"
            onClick={() => setReceipt(null)}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Enviar otro reporte
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="anonymous-report-page">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">NOM-035</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Reporte anónimo</h1>

        <p className="mt-4 text-slate-700">
          Este es un espacio confidencial para que puedas compartir cualquier situación laboral que
          hayas vivido, presenciado o consideres importante reportar.
        </p>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          Tu reporte es anónimo. No necesitas iniciar sesión y no solicitamos tu nombre, correo,
          número de empleado, NSS ni datos de contacto.
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Si deseas mantener tu anonimato, evita escribir nombres o datos personales que puedan
          identificarte dentro del reporte.
        </p>

        <form className="mt-7 space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-900">
            Cuéntanos qué pasó
            <textarea
              className="mt-2 block min-h-56 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 font-normal text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              rows={9}
              minLength={20}
              maxLength={5000}
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe la situación con tus propias palabras. Puedes explicar qué ocurrió, cuándo sucedió y cualquier información que consideres importante."
              data-testid="anonymous-report-description"
            />
          </label>

          <p className="text-right text-xs text-slate-500">{description.length}/5000</p>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="anonymous-report-error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="anonymous-report-submit"
          >
            {sending ? "Enviando…" : "Enviar reporte anónimo"}
          </button>
        </form>
      </section>
    </main>
  );
}
