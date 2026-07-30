"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/nom035/admin-client";

type Campaign = {
  id: string;
  nombre: string;
  descripcion: string | null;
  status: "draft" | "active" | "closed";
  fechaInicio: string | null;
  fechaCierre: string | null;
};

type Assignment = {
  id: string;
  workerId: string;
  workerNombre: string;
  workerNumero?: string | null;
  workerPuesto?: string | null;
  workerDepartamento?: string | null;
  workerActivo: boolean;
  accountStatus?: string | null;
  status: string;
  tokenLast4: string;
  guiaIStatus?: string | null;
  guiaIIStatus?: string | null;
  guiaIIIStatus?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastActivityAt?: string | null;
  questionnaireVersion?: string | null;
};

type OneTimeLink = {
  assignmentId: string;
  workerId: string;
  workerNombre?: string;
  token: string;
  link: string;
  tokenLast4: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completado",
  revoked: "Revocado",
};

export default function AdminCampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [message, setMessage] = useState("");
  const [companyName, setCompanyName] = useState("la empresa");
  const [oneTimeLinks, setOneTimeLinks] = useState<OneTimeLink[]>([]);
  const [memoryTokens, setMemoryTokens] = useState<Record<string, OneTimeLink>>({});

  const loadCampaigns = useCallback(async () => {
    const res = await adminApi.listCampaigns(new URLSearchParams({ page: "1", pageSize: "50" }));
    if (res.ok) {
      const items = (res.items as Campaign[]) ?? [];
      setCampaigns(items);
      if (!selectedId && items[0]) setSelectedId(items[0].id);
    }
  }, [selectedId]);

  const loadAssignments = useCallback(async (campaignId: string) => {
    const res = await adminApi.listAssignments(
      campaignId,
      new URLSearchParams({ page: "1", pageSize: "100" })
    );
    if (res.ok) setAssignments((res.items as Assignment[]) ?? []);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadCampaigns();
      void adminApi.getCompany().then((r) => {
        if (r.ok && r.company?.razonSocial) setCompanyName(String(r.company.razonSocial));
      });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [loadCampaigns]);

  useEffect(() => {
    if (!selectedId) return;
    const timerId = window.setTimeout(() => {
      void loadAssignments(selectedId);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [selectedId, loadAssignments]);

  const active = campaigns.find((c) => c.status === "active") ?? null;
  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  function rememberLink(link: OneTimeLink) {
    setMemoryTokens((prev) => ({ ...prev, [link.assignmentId]: link }));
  }

  async function createDraft() {
    const res = await adminApi.createCampaign({ nombre, descripcion: descripcion || null });
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setNombre("");
    setDescripcion("");
    setMessage("Campaña draft creada.");
    await loadCampaigns();
  }

  async function activate(id: string) {
    const res = await adminApi.activateCampaign(id);
    setMessage(res.ok ? "Campaña activada." : res.message);
    await loadCampaigns();
  }

  async function close(id: string) {
    const res = await adminApi.closeCampaign(id);
    setMessage(res.ok ? "Campaña cerrada." : res.message);
    await loadCampaigns();
  }

  async function issueMissing() {
    if (!selectedId) return;
    const res = await adminApi.issueMissing(selectedId);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    const links = (res.links as OneTimeLink[]) ?? [];
    setOneTimeLinks(links);
    for (const l of links) rememberLink(l);
    setMessage(res.warning ?? "Enlaces emitidos.");
    await loadAssignments(selectedId);
  }

  async function issueOne(workerId: string, workerNombre: string) {
    if (!selectedId) return;
    const res = await adminApi.issueOne(selectedId, workerId);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    const link: OneTimeLink = {
      assignmentId: String(res.assignmentId),
      workerId,
      workerNombre,
      token: String(res.token ?? ""),
      link: String(res.link ?? ""),
      tokenLast4: String((res as { tokenLast4?: string }).tokenLast4 ?? ""),
    };
    rememberLink(link);
    setOneTimeLinks([link]);
    setMessage("Enlace emitido (visible una sola vez).");
    await loadAssignments(selectedId);
  }

  async function rotate(assignmentId: string) {
    const res = await adminApi.rotateToken(assignmentId);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    const link: OneTimeLink = {
      assignmentId,
      workerId: "",
      token: String(res.token ?? ""),
      link: String(res.link ?? ""),
      tokenLast4: String(res.tokenLast4 ?? ""),
    };
    rememberLink(link);
    setOneTimeLinks([link]);
    setMessage("Enlace regenerado. El anterior ya no es válido.");
    if (selectedId) await loadAssignments(selectedId);
  }

  async function revoke(assignmentId: string) {
    const res = await adminApi.revokeAssignment(assignmentId, "revocado_por_admin");
    setMessage(res.ok ? "Evaluación revocada." : res.message);
    if (selectedId) await loadAssignments(selectedId);
  }

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setMessage(`${label} copiado.`);
  }

  function messageFor(link: OneTimeLink, workerNombre: string) {
    return `Hola ${workerNombre}, como parte de la evaluación NOM-035 de ${companyName}, te compartimos tu enlace individual.

Tus respuestas serán tratadas de forma confidencial y se utilizarán para identificar oportunidades de mejora en el entorno laboral.

Responde desde tu celular en el siguiente enlace:

${link.link}`;
  }

  return (
    <section className="space-y-4" data-testid="admin-campaigns-page">
      <h1 className="text-2xl font-semibold text-slate-900">Campañas</h1>
      {active ? (
        <p data-testid="active-campaign-name" className="text-sm text-emerald-800">
          Campaña activa: {active.nombre}
        </p>
      ) : (
        <p className="text-sm text-slate-600">No hay campaña activa.</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Crear draft</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            data-testid="campaign-nombre"
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <button
            type="button"
            data-testid="campaign-create"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
            onClick={() => void createDraft()}
          >
            Crear
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li
            key={c.id}
            className={`rounded border p-3 ${selectedId === c.id ? "border-slate-900" : "border-slate-200"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="text-left font-medium" onClick={() => setSelectedId(c.id)}>
                {c.nombre} · {c.status}
              </button>
              <div className="flex flex-wrap gap-1">
                {c.status === "draft" ? (
                  <button
                    type="button"
                    data-testid={`campaign-activate-${c.id}`}
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => void activate(c.id)}
                  >
                    Activar
                  </button>
                ) : null}
                {c.status === "active" ? (
                  <button
                    type="button"
                    data-testid={`campaign-close-${c.id}`}
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => void close(c.id)}
                  >
                    Cerrar
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {selected?.status === "active" ? (
        <div className="space-y-3">
          <button
            type="button"
            data-testid="issue-missing-links"
            className="rounded bg-emerald-700 px-3 py-2 text-sm text-white"
            onClick={() => void issueMissing()}
          >
            Generar links para trabajadores activos
          </button>

          {oneTimeLinks.length > 0 ? (
            <div
              data-testid="one-time-links-panel"
              className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"
            >
              <p className="font-medium">
                Por seguridad, estos enlaces no podrán consultarse nuevamente. Puedes regenerarlos
                posteriormente.
              </p>
              <ul className="mt-2 space-y-2">
                {oneTimeLinks.map((l) => (
                  <li key={l.assignmentId || l.workerId} className="rounded bg-white p-2">
                    <code className="break-all text-xs">{l.link}</code>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => copyText(l.link, "Enlace")}
                      >
                        Copiar enlace
                      </button>
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() =>
                          copyText(
                            messageFor(l, l.workerNombre ?? "colaborador/a"),
                            "Mensaje"
                          )
                        }
                      >
                        Copiar mensaje
                      </button>
                      <Link href={l.link} target="_blank" className="rounded border px-2 py-1 text-xs">
                        Abrir evaluación
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Número</th>
                  <th className="px-3 py-2">Trabajador</th>
                  <th className="px-3 py-2">Puesto</th>
                  <th className="px-3 py-2">Depto</th>
                  <th className="px-3 py-2">Cuenta</th>
                  <th className="px-3 py-2">Global</th>
                  <th className="px-3 py-2">Guía I</th>
                  <th className="px-3 py-2">Guía II</th>
                  <th className="px-3 py-2">Guía III</th>
                  <th className="px-3 py-2">Token</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const mem = memoryTokens[a.id];
                  const showII = Boolean(a.guiaIIStatus);
                  const showIII = Boolean(a.guiaIIIStatus);
                  return (
                    <tr key={a.id} className="border-t" data-testid={`assignment-row-${a.id}`}>
                      <td className="px-3 py-2 text-xs">{a.workerNumero ?? "—"}</td>
                      <td className="px-3 py-2">{a.workerNombre}</td>
                      <td className="px-3 py-2 text-xs">{a.workerPuesto ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{a.workerDepartamento ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{a.accountStatus ?? "—"}</td>
                      <td className="px-3 py-2">{STATUS_LABEL[a.status] ?? a.status}</td>
                      <td className="px-3 py-2 text-xs">{a.guiaIStatus ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{showII ? a.guiaIIStatus : "—"}</td>
                      <td className="px-3 py-2 text-xs" data-testid={`guia-iii-${a.id}`}>
                        {showIII ? a.guiaIIIStatus : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {mem ? (
                          <span className="text-xs">…{mem.tokenLast4}</span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            …{a.tokenLast4} · Enlace no recuperable
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {mem ? (
                            <>
                              <button
                                type="button"
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() => copyText(mem.link, "Enlace")}
                              >
                                Copiar enlace
                              </button>
                              <button
                                type="button"
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() =>
                                  copyText(messageFor(mem, a.workerNombre), "Mensaje")
                                }
                              >
                                Copiar mensaje
                              </button>
                              <Link
                                href={mem.link}
                                target="_blank"
                                className="rounded border px-2 py-1 text-xs"
                              >
                                Abrir
                              </Link>
                            </>
                          ) : null}
                          {a.status === "pending" || a.status === "in_progress" ? (
                            <>
                              <button
                                type="button"
                                data-testid={`rotate-${a.id}`}
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() => void rotate(a.id)}
                              >
                                Regenerar enlace
                              </button>
                              <button
                                type="button"
                                data-testid={`revoke-${a.id}`}
                                className="rounded border px-2 py-1 text-xs text-red-700"
                                onClick={() => void revoke(a.id)}
                              >
                                Revocar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Emisión individual implícita vía issue-missing; botón auxiliar si no hay assignments */}
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-600">
              No hay asignaciones. Usa &quot;Generar links…&quot; o emite por trabajador desde
              trabajadores activos.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Helper oculto para E2E: emitir a un workerId concreto via dataset */}
      <button
        type="button"
        data-testid="issue-one-helper"
        className="hidden"
        onClick={() => {
          const workerId = (document.getElementById("issue-worker-id") as HTMLInputElement | null)
            ?.value;
          const workerNombre =
            (document.getElementById("issue-worker-nombre") as HTMLInputElement | null)?.value ??
            "";
          if (workerId) void issueOne(workerId, workerNombre);
        }}
      />
      <input id="issue-worker-id" type="hidden" />
      <input id="issue-worker-nombre" type="hidden" />

      {message ? (
        <p data-testid="campaign-message" className="text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
