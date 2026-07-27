"use client";

import { useEffect, useRef, useState } from "react";

type ComplaintType =
  | "violencia_laboral"
  | "entorno_organizacional"
  | "factores_riesgo_psicosocial"
  | "otro";

type Receipt = {
  folio: string;
  confirmationCode: string;
  receivedAt: string;
};

export default function QuejaConfidencialPage() {
  const [mounted, setMounted] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [complaintType, setComplaintType] = useState<ComplaintType>("violencia_laboral");
  const [description, setDescription] = useState("");
  const [identify, setIdentify] = useState<"si" | "no">("no");
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  function resetSensitive() {
    setDescription("");
    setReporterName("");
    setReporterContact("");
    setConfirmed(false);
    setHoneypot("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || sending) return;
    inFlightRef.current = true;
    setError("");
    setRateLimited(false);

    if (description.trim().length < 20) {
      setError("Describe la situación con al menos 20 caracteres.");
      inFlightRef.current = false;
      return;
    }
    if (!confirmed) {
      setError("Debes confirmar la veracidad de la información.");
      inFlightRef.current = false;
      return;
    }
    if (identify === "si" && !reporterName.trim() && !reporterContact.trim()) {
      setError("Si deseas identificarte, indica nombre o contacto.");
      inFlightRef.current = false;
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/public/complaints", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          complaintType,
          description: description.trim(),
          isAnonymous: identify === "no",
          reporterName: identify === "si" ? reporterName.trim() || null : null,
          reporterContact: identify === "si" ? reporterContact.trim() || null : null,
          confirm: true,
          website: honeypot,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        folio?: string;
        confirmationCode?: string;
        receivedAt?: string;
        code?: string;
        message?: string;
      };

      if (res.status === 429) {
        setRateLimited(true);
        setError(json.message ?? "Demasiadas solicitudes. Intenta más tarde.");
        setSending(false);
        inFlightRef.current = false;
        return;
      }
      if (!res.ok || !json.ok || !json.folio || !json.confirmationCode) {
        setError(json.message ?? "No se pudo enviar el reporte. Intenta de nuevo.");
        setSending(false);
        inFlightRef.current = false;
        return;
      }

      setReceipt({
        folio: json.folio,
        confirmationCode: json.confirmationCode,
        receivedAt: json.receivedAt ?? new Date().toISOString(),
      });
      resetSensitive();
    } catch {
      setError("Ocurrió un error. Intenta de nuevo.");
      inFlightRef.current = false;
    }
    setSending(false);
  }

  function copyReceipt() {
    if (!receipt) return;
    void navigator.clipboard.writeText(
      `Folio: ${receipt.folio}\nCódigo: ${receipt.confirmationCode}\nRecibido: ${receipt.receivedAt}`
    );
  }

  if (!mounted) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      </main>
    );
  }

  if (receipt) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8" data-testid="queja-receipt">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Canal confidencial NOM-035</h1>
          <p className="mt-3 text-slate-700">
            Tu reporte fue recibido y será revisado de forma confidencial por personal autorizado.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Folio</dt>
              <dd className="font-mono text-lg" data-testid="queja-folio">{receipt.folio}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Código de confirmación</dt>
              <dd className="font-mono" data-testid="queja-confirmation">{receipt.confirmationCode}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Recibido</dt>
              <dd>{new Date(receipt.receivedAt).toLocaleString("es-MX")}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Guarda este comprobante. No incluye la descripción ni datos de contacto.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={copyReceipt} data-testid="queja-copy">
              Copiar comprobante
            </button>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid="queja-public-page">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Canal confidencial NOM-035</h1>
        <p className="mt-2 text-slate-700">
          Puedes enviar un reporte de forma anónima o identificarte. El personal autorizado revisará
          la información con reserva.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" data-testid="queja-form">
          {/* Honeypot: invisible para humanos, accesible para AT/bots */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input
                tabIndex={-1}
                autoComplete="off"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                data-testid="queja-honeypot"
              />
            </label>
          </div>

          <label className="block text-sm">
            Tipo de reporte
            <select
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5"
              value={complaintType}
              onChange={(e) => setComplaintType(e.target.value as ComplaintType)}
              data-testid="queja-type"
            >
              <option value="violencia_laboral">Violencia laboral</option>
              <option value="entorno_organizacional">Entorno organizacional</option>
              <option value="factores_riesgo_psicosocial">Factores de riesgo psicosocial</option>
              <option value="otro">Otro</option>
            </select>
          </label>

          <fieldset className="text-sm">
            <legend className="font-medium">¿Deseas identificarte?</legend>
            <label className="mt-1 mr-4 inline-flex items-center gap-1">
              <input type="radio" name="identify" checked={identify === "no"} onChange={() => setIdentify("no")} data-testid="queja-anon" />
              Anónima
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="identify" checked={identify === "si"} onChange={() => setIdentify("si")} data-testid="queja-identified" />
              Identificada
            </label>
          </fieldset>

          {identify === "si" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Nombre
                <input className="mt-1 block w-full rounded border px-2 py-1.5" value={reporterName} onChange={(e) => setReporterName(e.target.value)} data-testid="queja-name" />
              </label>
              <label className="text-sm">
                Contacto
                <input className="mt-1 block w-full rounded border px-2 py-1.5" value={reporterContact} onChange={(e) => setReporterContact(e.target.value)} data-testid="queja-contact" />
              </label>
            </div>
          ) : null}

          <label className="block text-sm">
            Descripción
            <textarea
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="queja-description"
              required
              minLength={20}
              maxLength={5000}
            />
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="queja-confirm" />
            Confirmo que la información es veraz y comprendo el carácter confidencial del canal.
          </label>

          {error ? (
            <p className={`text-sm ${rateLimited ? "text-amber-800" : "text-red-700"}`} data-testid="queja-error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={sending}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            data-testid="queja-submit"
          >
            {sending ? "Enviando…" : "Enviar reporte"}
          </button>
        </form>
      </section>
    </main>
  );
}
