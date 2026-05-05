"use client";

import { getRequiredQuestionnaires } from "@/lib/nom035/get-required-questionnaires";
import { getCompanyConfigLocal, seedNom035LocalData } from "@/lib/nom035/storage-local";

export default function AdminConfiguracionPage() {
  seedNom035LocalData();
  const company = getCompanyConfigLocal();

  const questionnaires = getRequiredQuestionnaires(company.employeeCount);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900">Configuracion de empresa</h1>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-zinc-800">{company.legalName}</p>
        <p className="text-sm text-zinc-600">RFC: {company.rfc}</p>
        <p className="text-sm text-zinc-600">Empleados: {company.employeeCount}</p>
        <p className="text-sm text-zinc-600">Centros de trabajo: {company.workplaceCount}</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-medium text-zinc-900">Guias requeridas (regla MVP)</h2>
        <p className="mt-2 text-sm text-zinc-700">{questionnaires.join(", ")}</p>
      </div>
    </section>
  );
}
