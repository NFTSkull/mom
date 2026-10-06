"use client";

import type {
  NamedLevelMatrix,
  Nom035AggregateReport,
} from "@/lib/nom035/aggregate-report";
import {
  RISK_DISPLAY_LABEL,
  RISK_EXCEL_ARGB,
  RISK_LEVEL_ORDER,
} from "@/lib/nom035/risk-palette";
import {
  ALTO_PLUS_DEFINITION,
  describeAltoPlus,
  describeMedioPlus,
  MEDIO_PLUS_DEFINITION,
  PLUS_NOT_OFFICIAL_NOTE,
} from "@/lib/nom035/report-interpretation";

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

function argbToCss(argb: string): string {
  return `#${argb.slice(2)}`;
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
  const pDom = aggregate.priorityReading.domainHighestAltoPlus;
  const pCat = aggregate.priorityReading.categoryHighestMedioPlus;

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

      <div
        className="rounded-lg border border-slate-200 bg-white p-4"
        data-testid="executive-priority-reading"
      >
        <h3 className="text-sm font-semibold text-slate-900">Lectura prioritaria</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-orange-200 bg-orange-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Dominio con mayor Alto+ (Alto + Muy alto)
            </p>
            {pDom ? (
              <>
                <p className="mt-1 font-semibold text-slate-900">{pDom.name}</p>
                <p className="text-slate-700">
                  {pDom.count} de {pDom.total} · {pDom.percentage}% Alto/Muy alto
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {describeAltoPlus(pDom.percentage, "dominio")}
                </p>
              </>
            ) : (
              <p className="mt-1 text-slate-600">Sin trabajadores en Alto/Muy alto.</p>
            )}
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Categoría con mayor Medio+ (Medio + Alto + Muy alto)
            </p>
            {pCat ? (
              <>
                <p className="mt-1 font-semibold text-slate-900">{pCat.name}</p>
                <p className="text-slate-700">
                  {pCat.count} de {pCat.total} · {pCat.percentage}% Medio o superior
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {describeMedioPlus(pCat.percentage, "categoría")}
                </p>
              </>
            ) : (
              <p className="mt-1 text-slate-600">Sin trabajadores en Medio o superior.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div
          className="rounded-lg border border-slate-200 bg-white p-4"
          data-testid="executive-top-domains-alto-plus"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            Dominios con mayor proporción Alto / Muy alto
          </h3>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-700">
            {aggregate.topDomainsHighRisk.length === 0 ? (
              <li className="list-none">Sin trabajadores en Alto/Muy alto.</li>
            ) : (
              aggregate.topDomainsHighRisk.map((d) => (
                <li key={d.name}>
                  <span className="font-medium">{d.name}</span> — {d.count} de {d.total} ·{" "}
                  {d.percentage}% Alto/Muy alto
                </li>
              ))
            )}
          </ol>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white p-4"
          data-testid="executive-categories-priority"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            Categorías con mayor proporción Medio o superior
          </h3>
          <table className="mt-2 min-w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">Categoría</th>
                <th className="py-1 pr-2">Medio+</th>
                <th className="py-1">Alto+</th>
              </tr>
            </thead>
            <tbody>
              {aggregate.categoriesPriority.map((c) => (
                <tr key={c.name} className="border-t">
                  <td className="py-1 pr-2 font-medium text-slate-800">{c.name}</td>
                  <td className="py-1 pr-2">
                    {c.medioPlus.count}/{c.total} · {c.medioPlus.percentage}%
                  </td>
                  <td className="py-1">
                    {c.altoPlus.count}/{c.total} · {c.altoPlus.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500" data-testid="executive-plus-definitions">
        {MEDIO_PLUS_DEFINITION} {ALTO_PLUS_DEFINITION} {PLUS_NOT_OFFICIAL_NOTE}
      </p>
    </section>
  );
}

function LevelTable({
  title,
  leadHeaders,
  rows,
  lead,
  testId,
}: {
  title: string;
  leadHeaders: string[];
  rows: NamedLevelMatrix[];
  lead: (row: NamedLevelMatrix) => string[];
  testId: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <h3 className="px-3 pt-3 text-sm font-semibold text-slate-900">{title}</h3>
      <table className="mt-2 min-w-full text-left text-xs" data-testid={testId}>
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            {leadHeaders.map((h) => (
              <th key={h} className="px-2 py-2">
                {h}
              </th>
            ))}
            {RISK_LEVEL_ORDER.flatMap((l) => [
              <th
                key={`${l}-n`}
                className="px-2 py-2"
                style={{ backgroundColor: argbToCss(RISK_EXCEL_ARGB[l]) }}
              >
                {RISK_DISPLAY_LABEL[l]} #
              </th>,
              <th
                key={`${l}-p`}
                className="px-2 py-2"
                style={{ backgroundColor: argbToCss(RISK_EXCEL_ARGB[l]) }}
              >
                {RISK_DISPLAY_LABEL[l]} %
              </th>,
            ])}
            <th className="px-2 py-2">Medio+ #</th>
            <th className="px-2 py-2">Medio+ %</th>
            <th className="px-2 py-2">Alto+ #</th>
            <th className="px-2 py-2">Alto+ %</th>
            <th className="px-2 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t">
              {lead(row).map((v, i) => (
                <td key={i} className={`px-2 py-1.5 ${i === 0 ? "font-medium" : ""}`}>
                  {v}
                </td>
              ))}
              {RISK_LEVEL_ORDER.flatMap((l) => [
                <td key={`${l}-n`} className="px-2 py-1.5">
                  {row.levels[l].count}
                </td>,
                <td key={`${l}-p`} className="px-2 py-1.5">
                  {row.levels[l].percentage}%
                </td>,
              ])}
              <td className="px-2 py-1.5">{row.medioPlus.count}</td>
              <td className="px-2 py-1.5">{row.medioPlus.percentage}%</td>
              <td className="px-2 py-1.5">{row.altoPlus.count}</td>
              <td className="px-2 py-1.5">{row.altoPlus.percentage}%</td>
              <td className="px-2 py-1.5">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDistributionTables({
  aggregate,
}: {
  aggregate: Pick<Nom035AggregateReport, "categories" | "domains">;
}) {
  return (
    <section className="space-y-3" data-testid="admin-distribution-tables">
      <LevelTable
        title="Categorías"
        leadHeaders={["Categoría"]}
        rows={aggregate.categories}
        lead={(r) => [r.name]}
        testId="executive-categories-table"
      />
      <LevelTable
        title="Dominios"
        leadHeaders={["Dominio", "Categoría"]}
        rows={aggregate.domains}
        lead={(r) => [r.name, r.category ?? "—"]}
        testId="executive-domains-table"
      />
    </section>
  );
}
