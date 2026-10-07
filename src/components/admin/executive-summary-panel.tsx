"use client";

import type { Nom035AggregateReport } from "@/lib/nom035/aggregate-report";

export type ExecutiveAggregateView = Pick<
  Nom035AggregateReport,
  | "companyName"
  | "modelLabel"
  | "campaignStatusLabel"
  | "generatedAt"
  | "presentationVersion"
  | "population"
  | "overallRiskDistribution"
  | "predominantRisk"
  | "categories"
  | "domains"
  | "traumaticEvent"
  | "clinicalAttention"
  | "topDomainsHighRisk"
  | "topCategoriesMediumPlus"
  | "categoriesPriority"
  | "priorityReading"
>;

function Kpi({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "blue" | "green" | "yellow" | "red" | "slate";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-sky-50 border-sky-200"
      : tone === "green"
        ? "bg-emerald-50 border-emerald-200"
        : tone === "yellow"
          ? "bg-amber-50 border-amber-200"
          : tone === "red"
            ? "bg-rose-50 border-rose-200"
            : "bg-slate-50 border-slate-200";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900 whitespace-pre-line">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function AdminExecutiveSummaryPanel({
  aggregate,
}: {
  aggregate: ExecutiveAggregateView;
}) {
  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
      data-testid="admin-executive-summary"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          RESULTADOS NOM-035 2026 — Resumen Ejecutivo
        </h2>
        <p className="text-sm text-slate-600">{aggregate.companyName}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Modelo" value={aggregate.modelLabel} tone="blue" />
        <Kpi
          title="Personal evaluado"
          value={String(aggregate.population.realCompleted)}
          tone="green"
        />
        <Kpi
          title="Pendientes"
          value={String(aggregate.population.realPending)}
          tone="yellow"
        />
        <Kpi
          title="En progreso"
          value={String(aggregate.population.realInProgress)}
          tone="slate"
        />
        <Kpi title="Estado" value={aggregate.campaignStatusLabel} tone="slate" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Kpi
          title="Riesgo predominante"
          value={aggregate.predominantRisk.label}
          hint={`${aggregate.predominantRisk.count} de ${aggregate.population.realResults} (${aggregate.predominantRisk.percentage}%)`}
          tone="yellow"
        />
        <Kpi
          title="Acontecimiento traumático severo"
          value={`${aggregate.traumaticEvent.yes}`}
          hint={`${aggregate.traumaticEvent.percentageYes}% · denom. ${aggregate.traumaticEvent.denominator}`}
          tone="red"
        />
        <Kpi
          title="Valoración clínica"
          value={`${aggregate.clinicalAttention.yes}`}
          hint={`${aggregate.clinicalAttention.percentageYes}% · denom. ${aggregate.clinicalAttention.denominator}`}
          tone="yellow"
        />
      </div>
    </section>
  );
}
