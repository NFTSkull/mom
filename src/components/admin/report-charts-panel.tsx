"use client";

import type { Nom035AggregateReport } from "@/lib/nom035/aggregate-report";
import {
  simpleDashboardPanels,
  type SimpleBarItem,
} from "@/lib/nom035/report-interpretation";

export type ReportChartsAggregate = Pick<
  Nom035AggregateReport,
  "population" | "overallRiskDistribution" | "categories" | "domains"
>;

const PANEL_TEST_IDS = {
  risk: "chart-risk",
  completion: "chart-completion",
  categories: "chart-categories",
  domains: "chart-domains",
} as const;

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

function SimpleBarCard({
  title,
  items,
  testId,
}: {
  title: string;
  items: SimpleBarItem[];
  testId: string;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4" data-testid={testId}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-slate-500">Sin datos</li>
        ) : (
          items.map((item) => (
            <li key={item.label} className="text-xs" data-testid={`${testId}-row-${slug(item.label)}`}>
              <div className="mb-1 flex justify-between gap-2 text-slate-700">
                <span title={item.label}>{formatLabel(item.label)}</span>
                <span className="font-medium" data-testid="simple-bar-value" data-level={item.level}>
                  {item.value}
                </span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-slate-700"
                  style={{ width: `${Math.min(1, Math.max(0, item.ratio)) * 100}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Tablero ejecutivo 2×2 con el estilo de barras simples del panel original. */
export function AdminReportChartsPanel({ aggregate }: { aggregate: ReportChartsAggregate }) {
  return (
    <section className="grid gap-3 lg:grid-cols-2" data-testid="admin-report-charts">
      {simpleDashboardPanels(aggregate).map((panel) => (
        <SimpleBarCard
          key={panel.key}
          title={panel.title}
          items={panel.items}
          testId={PANEL_TEST_IDS[panel.key]}
        />
      ))}
    </section>
  );
}
