"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { generateBasePolicy, getPolicyStatusLabel } from "@/lib/nom035/policy-generator";
import {
  deletePolicyDocument,
  getCompanyConfigLocal,
  getPolicyDocuments,
  savePolicyDocument,
  seedNom035LocalData,
  updatePolicyDocument,
} from "@/lib/nom035/storage-local";
import type { CompanyConfig, PolicyDocument } from "@/types/nom035";

type EditorState = {
  id: string | null;
  title: string;
  content: string;
  version: string;
  status: PolicyDocument["status"];
};

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: "",
  content: "",
  version: "1.0",
  status: "borrador",
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX");
}

export default function AdminPoliticaPage() {
  const [mounted, setMounted] = useState(false);
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [message, setMessage] = useState("");

  function refreshData(): void {
    seedNom035LocalData();
    setCompany(getCompanyConfigLocal());
    setPolicies(getPolicyDocuments());
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      refreshData();
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  const latestPolicy = useMemo(() => policies[0] ?? null, [policies]);
  const publishedPolicy = useMemo(
    () => policies.find((item) => item.status === "publicada") ?? null,
    [policies]
  );
  const currentPrintPolicy = publishedPolicy ?? latestPolicy;

  function setEditorFromPolicy(policy: PolicyDocument): void {
    setEditor({
      id: policy.id,
      title: policy.title,
      content: policy.content,
      version: policy.version,
      status: policy.status,
    });
    setMessage("");
  }

  function clearEditor(): void {
    setEditor(EMPTY_EDITOR);
    setMessage("");
  }

  function ensureRequiredFields(): boolean {
    if (!editor.title.trim() || !editor.content.trim() || !editor.version.trim()) {
      setMessage("Completa titulo, contenido y version antes de guardar.");
      return false;
    }
    return true;
  }

  function createBasePolicy(): void {
    if (!company) return;
    const base = generateBasePolicy(company);
    setEditor({
      id: null,
      title: base.title,
      content: base.content,
      version: base.version,
      status: "borrador",
    });
    setMessage("Politica base generada en el editor. Guardala como borrador o publicala.");
  }

  function saveDraft(): void {
    if (!ensureRequiredFields()) return;
    const payload: Omit<PolicyDocument, "id" | "createdAt" | "updatedAt"> = {
      title: editor.title.trim(),
      content: editor.content.trim(),
      version: editor.version.trim(),
      status: "borrador",
    };

    if (editor.id) {
      updatePolicyDocument(editor.id, payload);
      setMessage("Borrador actualizado.");
    } else {
      const created = savePolicyDocument(payload);
      setEditor((prev) => ({ ...prev, id: created.id, status: "borrador" }));
      setMessage("Borrador guardado.");
    }
    setPolicies(getPolicyDocuments());
  }

  function publishPolicy(fromHistoryId?: string): void {
    const now = new Date().toISOString();
    if (fromHistoryId) {
      updatePolicyDocument(fromHistoryId, { status: "publicada", publishedAt: now });
      setPolicies(getPolicyDocuments());
      setMessage("Politica publicada.");
      return;
    }

    if (!ensureRequiredFields()) return;
    const payload: Omit<PolicyDocument, "id" | "createdAt" | "updatedAt"> = {
      title: editor.title.trim(),
      content: editor.content.trim(),
      version: editor.version.trim(),
      status: "publicada",
      publishedAt: now,
    };

    if (editor.id) {
      updatePolicyDocument(editor.id, payload);
      setMessage("Politica publicada.");
    } else {
      const created = savePolicyDocument(payload);
      setEditor((prev) => ({ ...prev, id: created.id, status: "publicada" }));
      setMessage("Politica creada y publicada.");
    }
    setPolicies(getPolicyDocuments());
  }

  function duplicatePolicy(policy: PolicyDocument): void {
    const duplicate = savePolicyDocument({
      title: `${policy.title} (Copia)`,
      content: policy.content,
      version: policy.version,
      status: "borrador",
    });
    setPolicies(getPolicyDocuments());
    setEditorFromPolicy(duplicate);
    setMessage("Se genero una copia como borrador.");
  }

  function removePolicy(id: string): void {
    deletePolicyDocument(id);
    setPolicies(getPolicyDocuments());
    if (editor.id === id) {
      clearEditor();
    }
    setMessage("Politica eliminada.");
  }

  if (!mounted) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Politica de prevencion NOM-035</h1>
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
        <h1 className="text-2xl font-semibold text-slate-900">Politica de prevencion NOM-035</h1>
        <p className="mt-1 text-slate-700">
          Genera y administra la politica interna para prevenir factores de riesgo psicosocial,
          prevenir violencia laboral y promover un entorno organizacional favorable.
        </p>
      </header>

      <div className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total versiones</p>
          <p className="text-2xl font-semibold text-slate-900">{policies.length}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ultima version</p>
          <p className="text-2xl font-semibold text-slate-900">{latestPolicy?.version ?? "-"}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Estado actual</p>
          <p className="text-2xl font-semibold text-slate-900">
            {currentPrintPolicy ? getPolicyStatusLabel(currentPrintPolicy.status) : "-"}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Fecha de publicacion</p>
          <p className="text-2xl font-semibold text-slate-900">
            {formatDate(currentPrintPolicy?.publishedAt)}
          </p>
        </article>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          onClick={createBasePolicy}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Generar politica base
        </button>
        <button
          type="button"
          onClick={refreshData}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Actualizar datos
        </button>
        <Link
          href="/admin/evidencias"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Ir a evidencias
        </Link>
      </div>

      <p className="no-print rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        Para respaldar cumplimiento documental, registra esta politica publicada en el modulo
        Evidencias con tipo &quot;Politica&quot;.
      </p>

      <form className="no-print space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Editor de politica</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-700 sm:col-span-2">
            Titulo
            <input
              value={editor.title}
              onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Version
            <input
              value={editor.version}
              onChange={(event) => setEditor((prev) => ({ ...prev, version: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700 sm:col-span-3">
            Contenido
            <textarea
              rows={16}
              value={editor.content}
              onChange={(event) => setEditor((prev) => ({ ...prev, content: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Estado
            <select
              value={editor.status}
              onChange={(event) =>
                setEditor((prev) => ({
                  ...prev,
                  status: event.target.value as PolicyDocument["status"],
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="borrador">Borrador</option>
              <option value="publicada">Publicada</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveDraft}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Guardar borrador
          </button>
          <button
            type="button"
            onClick={() => publishPolicy()}
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Publicar politica
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Imprimir politica
          </button>
          <button
            type="button"
            onClick={clearEditor}
            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
          >
            Limpiar editor
          </button>
        </div>
        {message ? (
          <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {message}
          </p>
        ) : null}
      </form>

      <div className="no-print rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Historial de politicas</h2>
        {policies.length === 0 ? (
          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Sin politicas registradas. Genera una politica base para iniciar.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm text-slate-800">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Titulo</th>
                  <th className="px-3 py-2 font-semibold">Version</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Fecha publicacion</th>
                  <th className="px-3 py-2 font-semibold">Actualizado</th>
                  <th className="px-3 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2">{policy.title}</td>
                    <td className="px-3 py-2">{policy.version}</td>
                    <td className="px-3 py-2">{getPolicyStatusLabel(policy.status)}</td>
                    <td className="px-3 py-2">{formatDate(policy.publishedAt)}</td>
                    <td className="px-3 py-2">{formatDate(policy.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditorFromPolicy(policy)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicatePolicy(policy)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => publishPolicy(policy.id)}
                          className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                        >
                          Publicar
                        </button>
                        <button
                          type="button"
                          onClick={() => removePolicy(policy.id)}
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
        )}
      </div>

      <article className="policy-print rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          {currentPrintPolicy?.title ?? "Politica de prevencion NOM-035"}
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Empresa: {company?.legalName ?? "-"} | Version: {currentPrintPolicy?.version ?? "-"} |
          Estado:{" "}
          {currentPrintPolicy ? getPolicyStatusLabel(currentPrintPolicy.status) : "Sin documento"}
        </p>
        <p className="text-sm text-slate-700">
          Fecha de publicacion: {formatDate(currentPrintPolicy?.publishedAt)}
        </p>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">
          {currentPrintPolicy?.content || "Sin contenido disponible para impresion."}
        </div>
      </article>

      <style jsx global>{`
        @media print {
          .admin-nav,
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .policy-print {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}
