"use client";

import type { Nom035AggregateReport } from "@/lib/nom035/aggregate-report";
import { RISK_DISPLAY_LABEL, RISK_LEVEL_ORDER } from "@/lib/nom035/risk-palette";
import {
  levelTableRows,
  RISK_SHARE_LABELS,
  RISK_SHARE_LEVELS,
  RISK_SHARE_NOTE,
  RISK_SHARE_TITLES,
  riskShareRows,
  type RiskShareLevel,
} from "@/lib/nom035/report-interpretation";

export type ReportChartsAggregate = Pick<
  Nom035AggregateReport,
  "population" | "overallRiskDistribution" | "categories" | "domains"
>;

type BarChartProps = {
  title: string;
  items: Array<{ label: string; value: number }>;
  testId?: string;
};

const SHARE_BAR_CLASS: Record<RiskShareLevel, string> = {
  medio: "bg-slate-400",
  alto: "bg-slate-600",
  muy_alto: "bg-slate-900",
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatLabel(value: string): string {
  if (value.length <= 36) return value;
  return `${value.slice(0, 35)}…`;
}

export function AdminSimpleBarChart({ title, items, testId }: BarChartProps) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded border border-slate-200 bg-white p-4" data-testid={testId}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-slate-500">Sin datos</li>
        ) : (
          items.map((item) => (
            <li key={item.label} className="text-xs">
              <div className="mb-1 flex justify-between gap-2 text-slate-700">
                <span title={item.label}>{formatLabel(item.label)}</span>
                <span className="font-medium">{item.value}</span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-slate-700"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function FullLevelTable({
  rows,
  leadHeader,
  testId,
}: {
  rows: ReportChartsAggregate["domains"];
  leadHeader: string;
  testId: string;
}) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-slate-600">Ver tabla completa (Nulo a Muy alto)</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-left" data-testid={testId}>
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-2 py-1.5">{leadHeader}</th>
              {RISK_LEVEL_ORDER.map((l) => (
                <th key={l} className="px-2 py-1.5">
                  {RISK_DISPLAY_LABEL[l]}
                </th>
              ))}
              <th className="px-2 py-1.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {levelTableRows(rows).map((row) => (
              <tr key={row.name} className="border-t" data-testid={`${testId}-row-${slug(row.name)}`}>
                <td className="px-2 py-1 font-medium text-slate-800">{row.name}</td>
                {row.cells.map((cell) => (
                  <td key={cell.level} className="whitespace-nowrap px-2 py-1 text-slate-700">
                    {cell.text}
                  </td>
                ))}
                <td className="px-2 py-1 text-slate-700">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Por fila: % en Medio, Alto y Muy alto. Nulo y Bajo quedan como el espacio vacío de la barra. */
function RiskShareChart({
  title,
  rows,
  leadHeader,
  testId,
}: {
  title: string;
  rows: ReportChartsAggregate["domains"];
  leadHeader: string;
  testId: string;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4" data-testid={testId}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span>{RISK_SHARE_NOTE}</span>
        {RISK_SHARE_LEVELS.map((level) => (
          <span key={level} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2 w-3 rounded-sm ${SHARE_BAR_CLASS[level]}`} />
            {RISK_SHARE_LABELS[level]}
          </span>
        ))}
      </p>
      <ul className="mt-3 space-y-2">
        {riskShareRows(rows).map((row) => (
          <li key={row.name} className="text-xs" data-testid={`${testId}-row-${slug(row.name)}`}>
            <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-slate-700">
              <span>{row.name}</span>
              <span className="whitespace-nowrap tabular-nums text-slate-800">
                {row.shares.map((s, i) => (
                  <span key={s.level} data-level={s.level}>
                    {i > 0 ? " · " : ""}
                    {s.text}
                  </span>
                ))}
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded bg-slate-100">
              {row.shares.map((s) => (
                <div
                  key={s.level}
                  className={`h-2 ${SHARE_BAR_CLASS[s.level]}`}
                  style={{ width: `${Math.min(100, Math.max(0, s.percentage))}%` }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <FullLevelTable rows={rows} leadHeader={leadHeader} testId={`${testId}-table`} />
    </div>
  );
}

export function AdminReportChartsPanel({ aggregate }: { aggregate: ReportChartsAggregate }) {
  const riskItems = aggregate.overallRiskDistribution.map((r) => ({
    label: r.level === "nulo" ? "Nulo/despreciable" : RISK_DISPLAY_LABEL[r.level],
    value: r.count,
  }));
  const completionItems = [
    { label: "Completados", value: aggregate.population.realCompleted },
    { label: "Pendientes", value: aggregate.population.realPending },
    { label: "En progreso", value: aggregate.population.realInProgress },
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-2" data-testid="admin-report-charts">
      <AdminSimpleBarChart title={RISK_SHARE_TITLES.risk} items={riskItems} testId="chart-risk" />
      <AdminSimpleBarChart title={RISK_SHARE_TITLES.completion} items={completionItems} testId="chart-completion" />
      <RiskShareChart
        title={RISK_SHARE_TITLES.categories}
        rows={aggregate.categories}
        leadHeader="Categoría"
        testId="chart-categories"
      />
      <RiskShareChart
        title={RISK_SHARE_TITLES.domains}
        rows={aggregate.domains}
        leadHeader="Dominio"
        testId="chart-domains"
      />
    </section>
  );
}
