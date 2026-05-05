"use client";

import { useEffect, useState } from "react";
import { generateComplaintFolio, getComplaintTypeLabel } from "@/lib/nom035/complaint-analytics";
import { getComplaints, saveComplaint, seedNom035LocalData } from "@/lib/nom035/storage-local";
import type { ConfidentialComplaint } from "@/types/nom035";

type ComplaintType = ConfidentialComplaint["complaintType"];

export default function QuejaConfidencialPage() {
  const [mounted, setMounted] = useState(false);
  const [submittedFolio, setSubmittedFolio] = useState<string | null>(null);
  const [complaintType, setComplaintType] = useState<ComplaintType>("violencia_laboral");
  const [description, setDescription] = useState("");
  const [identify, setIdentify] = useState<"si" | "no">("no");
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      seedNom035LocalData();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!description.trim()) {
      setError("Describe la situacion para enviar el reporte.");
      return;
    }
    if (!confirmed) {
      setError("Debes confirmar la veracidad de la informacion.");
      return;
    }
    if (identify === "si" && (!reporterName.trim() || !reporterContact.trim())) {
      setError("Si deseas identificarte, completa nombre y contacto.");
      return;
    }

    const existing = getComplaints();
    const folio = generateComplaintFolio(existing);
    saveComplaint({
      folio,
      complaintType,
      description: description.trim(),
      isAnonymous: identify === "no",
      reporterName: identify === "si" ? reporterName.trim() : undefined,
      reporterContact: identify === "si" ? reporterContact.trim() : undefined,
      status: "recibida",
      assignedTo: "",
      resolutionNotes: "",
    });

    setSubmittedFolio(folio);
  }

  if (!mounted) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (submittedFolio) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Canal confidencial NOM-035</h1>
          <p className="mt-3 text-slate-700">
            Tu reporte fue recibido. Sera revisado de forma confidencial por personal autorizado.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Folio asignado: <strong>{submittedFolio}</strong>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Canal confidencial NOM-035</h1>
        <p className="mt-2 text-slate-700">
          Este espacio permite reportar situaciones relacionadas con violencia laboral, practicas
          opuestas al entorno organizacional o condiciones que puedan afectar el ambiente de trabajo.
        </p>
      </header>

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          La informacion sera tratada con confidencialidad y revisada unicamente por personal
          autorizado. Puedes enviar el reporte de forma anonima o dejar tus datos de contacto si
          deseas seguimiento.
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm text-slate-700">
          Tipo de reporte
          <select
            value={complaintType}
            onChange={(event) => setComplaintType(event.target.value as ComplaintType)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="violencia_laboral">{getComplaintTypeLabel("violencia_laboral")}</option>
            <option value="entorno_organizacional">
              {getComplaintTypeLabel("entorno_organizacional")}
            </option>
            <option value="factores_riesgo_psicosocial">
              {getComplaintTypeLabel("factores_riesgo_psicosocial")}
            </option>
            <option value="otro">{getComplaintTypeLabel("otro")}</option>
          </select>
        </label>

        <label className="text-sm text-slate-700">
          Descripcion
          <textarea
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-700">Deseas identificarte?</legend>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={identify === "si"}
                onChange={() => setIdentify("si")}
              />
              Si
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={identify === "no"}
                onChange={() => setIdentify("no")}
              />
              No
            </label>
          </div>
        </fieldset>

        {identify === "si" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Nombre
              <input
                value={reporterName}
                onChange={(event) => setReporterName(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Telefono o email
              <input
                value={reporterContact}
                onChange={(event) => setReporterContact(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1"
          />
          Confirmo que la informacion proporcionada es verdadera de acuerdo con mi conocimiento.
        </label>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Enviar reporte confidencial
        </button>
      </form>
    </main>
  );
}
