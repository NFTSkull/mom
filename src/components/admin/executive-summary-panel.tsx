"use client";

import {
  RISK_CHART_HEX,
  RISK_DISPLAY_LABEL,
} from "@/lib/nom035/risk-palette";
import type { RiskLevelNom035 } from "@/types/nom035";

const LEVELS: RiskLevelNom035[] = ["nulo", "bajo", "medio", "alto", "muy_alto"];

type LevelCount = {
  level: RiskLevelNom035;
  label: string;
  shortLabel: string;
  count: number;
  percentage: number;
};

type NamedMatrix = {
  name: string;
  category?: string;
  levels: Record<RiskLevelNom035, { count: number; percentage: number }>;
  total: number;
};

type TopIndicator = { name: string; count: number; percentage: number };

type Binary = {
  yes: number;
  no: number;
  percentageYes: number;
  denominator: number;
};

export type ExecutiveAggregateView = {
  companyName: string;
  modelLabel: string;
  campaignStatusLabel: string;
  population: {
    realWorkers: number;
    realCompleted: number;
    realPending: number;
    realInProgress: number;
    realResults: number;
  };
  overallRiskDistribution: LevelCount[];
  predominantRisk: {
    level: RiskLevelNom035 | null;
    label: string;
    count: number;
    percentage: number;
    metricKind: string;
  };
  categories: NamedMatrix[];
  domains: NamedMatrix[];
  traumaticEvent: Binary;
  clinicalAttention: Binary;
  topDomainsHighRisk: TopIndicator[];
  topCategoriesMediumPlus: TopIndicator[];
};

function RiskBar({
  items,
  title,
}: {
  title: string;
  items: Array<{ label: string; count: number; percentage: number; level?: string }>;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="text-xs">
            <div className="mb-1 flex justify-between gap-2 text-slate-700">
              <span>{item.label}</span>
              <span className="font-medium">
                {item.count} ({item.percentage}%)
              </span>
            </div>
            <div className="h-2 rounded bg-slate-100">
              <div
                className="h-2 rounded"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  backgroundColor:
                    item.level && item.level in RISK_CHART_HEX
                      ? RISK_CHART_HEX[item.level as RiskLevelNom035]
                      : "#334155",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const riskItems = aggregate.overallRiskDistribution.map((r) => ({
    label: r.shortLabel || RISK_DISPLAY_LABEL[r.level],
    count: r.count,
    percentage: r.percentage,
    level: r.level,
  }));

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

      <div className="grid gap-3 lg:grid-cols-2">
        <RiskBar title="Calificación final de riesgos psicosociales" items={riskItems} />
        <div className="grid gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Dominios con mayor concentración Alto / Muy alto
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-700">
              {aggregate.topDomainsHighRisk.length === 0 ? (
                <li className="list-none">Sin concentraciones.</li>
              ) : (
                aggregate.topDomainsHighRisk.map((d) => (
                  <li key={d.name}>
                    {d.name} — {d.count} ({d.percentage}%)
                  </li>
                ))
              )}
            </ol>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Categorías con mayor concentración Medio+
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-700">
              {aggregate.topCategoriesMediumPlus.map((c) => (
                <li key={c.name}>
                  {c.name} — {c.count} ({c.percentage}%)
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs" data-testid="executive-categories-table">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-2 py-2">Categoría</th>
              {LEVELS.map((l) => (
                <th key={l} className="px-2 py-2">
                  {RISK_DISPLAY_LABEL[l]}
                </th>
              ))}
              <th className="px-2 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {aggregate.categories.map((cat) => (
              <tr key={cat.name} className="border-t">
                <td className="px-2 py-1.5 font-medium">{cat.name}</td>
                {LEVELS.map((l) => (
                  <td key={l} className="px-2 py-1.5">
                    {cat.levels[l].count} ({cat.levels[l].percentage}%)
                  </td>
                ))}
                <td className="px-2 py-1.5">{cat.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs" data-testid="executive-domains-table">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-2 py-2">Dominio</th>
              <th className="px-2 py-2">Categoría</th>
              {LEVELS.map((l) => (
                <th key={l} className="px-2 py-2">
                  {RISK_DISPLAY_LABEL[l]}
                </th>
              ))}
              <th className="px-2 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {aggregate.domains.map((dom) => (
              <tr key={dom.name} className="border-t">
                <td className="px-2 py-1.5 font-medium">{dom.name}</td>
                <td className="px-2 py-1.5">{dom.category ?? "—"}</td>
                {LEVELS.map((l) => (
                  <td key={l} className="px-2 py-1.5">
                    {dom.levels[l].count} ({dom.levels[l].percentage}%)
                  </td>
                ))}
                <td className="px-2 py-1.5">{dom.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
