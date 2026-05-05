"use client";

import { useEffect, useState } from "react";
import { getRequiredQuestionnaires } from "@/lib/nom035/get-required-questionnaires";
import { getCompanyConfigLocal, seedNom035LocalData } from "@/lib/nom035/storage-local";
import type { CompanyConfig } from "@/types/nom035";

export default function AdminConfiguracionPage() {
  const [mounted, setMounted] = useState(false);
  const [company, setCompany] = useState<CompanyConfig | null>(null);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      seedNom035LocalData();
      setCompany(getCompanyConfigLocal());
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  if (!mounted || !company) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Configuración de empresa</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const questionnaires = getRequiredQuestionnaires(company.employeeCount);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Configuración de empresa</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-slate-800">{company.legalName}</p>
        <p className="text-sm text-slate-600">RFC: {company.rfc}</p>
        <p className="text-sm text-slate-600">Empleados: {company.employeeCount}</p>
        <p className="text-sm text-slate-600">Centros de trabajo: {company.workplaceCount}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-medium text-slate-900">Guías requeridas (regla MVP)</h2>
        <p className="mt-2 text-sm text-slate-700">{questionnaires.join(", ")}</p>
      </div>
    </section>
  );
}
