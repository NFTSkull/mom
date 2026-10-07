"use client";

import type {
  NamedLevelMatrix,
  Nom035AggregateReport,
} from "@/lib/nom035/aggregate-report";
import {
  RISK_CHART_HEX,
  RISK_DISPLAY_LABEL,
  RISK_LEVEL_ORDER,
} from "@/lib/nom035/risk-palette";
import {
  ALTO_PLUS_DEFINITION,
  levelSegmentShares,
  MEDIO_PLUS_DEFINITION,
  PLUS_NOT_OFFICIAL_NOTE,
  predominantLevelBadge,
  UI_DISTRIBUTION_NOTE,
} from "@/lib/nom035/report-interpretation";

export type ReportChartsAggregate = Pick<
  Nom035AggregateReport,
  "population" | "overallRiskDistribution" | "categories" | "domains"
>;

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Barras de personas (misma unidad en todas las filas). */
function PeopleBarCard({
  title,
  items,
  testId,
}: {
  title: string;
  items: Array<{ label: string; count: number; percentage?: number; color: string }>;
  testId: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid={testId}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="text-xs">
            <div className="mb-1 flex justify-between gap-2 text-slate-700">
              <span>{item.label}</span>
              <span className="font-medium">
                {item.count}
                {item.percentage !== undefined ? ` (${item.percentage}%)` : ""}
              </span>
            </div>
            <div className="h-2 rounded bg-slate-100">
              <div
                className="h-2 rounded"
                style={{ width: `${(item.count / max) * 100}%`, backgroundColor: item.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
      {RISK_LEVEL_ORDER.map((level) => (
        <span key={level} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: RISK_CHART_HEX[level] }}
          />
          {RISK_DISPLAY_LABEL[level]}
        </span>
      ))}
    </div>
  );
}

/** Barra horizontal apilada al 100%: longitud = personas / total evaluados. */
export function StackedLevelBar({ row }: { row: NamedLevelMatrix }) {
  const shares = levelSegmentShares(row.levels, row.total);
  return (
    <div
      className="flex h-6 w-full overflow-hidden rounded border border-slate-200 bg-slate-100"
      role="img"
      aria-label={`${row.name}: ${RISK_LEVEL_ORDER.map(
        (l) => `${RISK_DISPLAY_LABEL[l]} ${row.levels[l].count} (${row.levels[l].percentage}%)`
      ).join(", ")}`}
    >
      {RISK_LEVEL_ORDER.map((level) => {
        const { count, percentage } = row.levels[level];
        if (count <= 0) return null;
        return (
          <div
            key={level}
            data-level={level}
            title={`${RISK_DISPLAY_LABEL[level]}: ${count} de ${row.total} (${percentage}%)`}
            className="flex items-center justify-center overflow-hidden text-[10px] font-medium text-white"
            style={{
              width: `${shares[level] * 100}%`,
              backgroundColor: RISK_CHART_HEX[level],
            }}
          >
            {percentage >= 9 ? `${percentage}%` : ""}
          </div>
        );
      })}
    </div>
  );
}

function StackedDistributionCard({
  title,
  rows,
  showCategory,
  testId,
  realResults,
}: {
  title: string;
  rows: NamedLevelMatrix[];
  showCategory: boolean;
  testId: string;
  realResults: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500">Total evaluados: {realResults}</span>
      </div>
      <div className="mt-2">
        <LevelLegend />
      </div>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => {
          const badge = predominantLevelBadge(row);
          return (
          <li
            key={row.name}
            className="grid gap-2 text-xs md:grid-cols-[minmax(0,14rem)_1fr_10rem] md:items-center"
            data-testid={`dist-row-${slug(row.name)}`}
          >
            <div>
              <p className="font-medium text-slate-800">{row.name}</p>
              {showCategory && row.category ? (
                <p className="text-[11px] text-slate-500">Categoría: {row.category}</p>
              ) : null}
              {badge ? (
                <p
                  className="mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: RISK_CHART_HEX[badge.level] }}
                  data-testid="predominant-level-badge"
                >
                  {badge.text}
                </p>
              ) : null}
            </div>
            <StackedLevelBar row={row} />
            <div className="text-[11px] leading-tight text-slate-700">
              <p>
                <span className="font-semibold">Medio+:</span> {row.medioPlus.count} / {row.total} ·{" "}
                {row.medioPlus.percentage}%
              </p>
              <p className="text-orange-800">
                <span className="font-semibold">Alto+:</span> {row.altoPlus.count} / {row.total} ·{" "}
                {row.altoPlus.percentage}%
              </p>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminReportChartsPanel({ aggregate }: { aggregate: ReportChartsAggregate }) {
  const { population } = aggregate;
  const riskItems = aggregate.overallRiskDistribution.map((r) => ({
    label: RISK_DISPLAY_LABEL[r.level],
    count: r.count,
    percentage: r.percentage,
    color: RISK_CHART_HEX[r.level],
  }));
  const completionItems = [
    { label: "Completados", count: population.realCompleted, color: "#0f766e" },
    { label: "Pendientes", count: population.realPending, color: "#ca8a04" },
    { label: "En progreso", count: population.realInProgress, color: "#64748b" },
  ];

  return (
    <section className="space-y-3" data-testid="admin-report-charts">
      <div className="grid gap-3 lg:grid-cols-2">
        <PeopleBarCard
          title="A. Distribución general de riesgo"
          items={riskItems}
          testId="chart-risk-distribution"
        />
        <PeopleBarCard
          title="B. Avance de evaluación"
          items={completionItems}
          testId="chart-completion"
        />
      </div>
      <StackedDistributionCard
        title="C. Distribución de riesgo por categoría"
        rows={aggregate.categories}
        showCategory={false}
        testId="chart-category-distribution"
        realResults={population.realResults}
      />
      <StackedDistributionCard
        title="D. Distribución de riesgo por dominio"
        rows={aggregate.domains}
        showCategory
        testId="chart-domain-distribution"
        realResults={population.realResults}
      />
      <div
        className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
        data-testid="distribution-interpretation-note"
      >
        <p className="font-medium text-slate-700">{UI_DISTRIBUTION_NOTE}</p>
        <p className="mt-1">
          {MEDIO_PLUS_DEFINITION} {ALTO_PLUS_DEFINITION} {PLUS_NOT_OFFICIAL_NOTE}
        </p>
      </div>
    </section>
  );
}
