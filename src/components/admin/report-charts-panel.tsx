"use client";

import type { Nom035AggregateReport } from "@/lib/nom035/aggregate-report";
import { RISK_DISPLAY_LABEL, RISK_LEVEL_ORDER } from "@/lib/nom035/risk-palette";
import {
  LEVEL_TABLE_TITLES,
  levelTableRows,
  PREDOMINANT_COLUMN_LABEL,
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
} as const;

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
        {items.map((item) => (
          <li key={item.label} className="text-xs" data-testid={`${testId}-row-${slug(item.label)}`}>
            <div className="mb-1 flex justify-between gap-2 text-slate-700">
              <span>{item.label}</span>
              <span className="font-medium" data-testid="simple-bar-value">
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
        ))}
      </ul>
    </div>
  );
}

/** Tabla tipo reporte: «conteo (porcentaje%)» por nivel, Total y nivel predominante resaltado. */
function LevelReportTable({
  title,
  rows,
  withCategory,
  testId,
}: {
  title: string;
  rows: ReportChartsAggregate["domains"];
  withCategory: boolean;
  testId: string;
}) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <h3 className="px-4 pt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <table className="mt-3 min-w-full text-left text-xs" data-testid={testId}>
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-3 py-2">{withCategory ? "Dominio" : "Categoría"}</th>
            {withCategory ? <th className="px-3 py-2">Categoría</th> : null}
            {RISK_LEVEL_ORDER.map((l) => (
              <th key={l} className="px-3 py-2">
                {RISK_DISPLAY_LABEL[l]}
              </th>
            ))}
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">{PREDOMINANT_COLUMN_LABEL}</th>
          </tr>
        </thead>
        <tbody>
          {levelTableRows(rows).map((row) => (
            <tr key={row.name} className="border-t" data-testid={`${testId}-row-${slug(row.name)}`}>
              <td className="px-3 py-1.5 font-medium text-slate-900">{row.name}</td>
              {withCategory ? <td className="px-3 py-1.5 text-slate-700">{row.category ?? "—"}</td> : null}
              {row.cells.map((cell) => (
                <td
                  key={cell.level}
                  data-level={cell.level}
                  data-predominant={cell.predominant ? "true" : undefined}
                  className={`whitespace-nowrap px-3 py-1.5 ${
                    cell.predominant ? "bg-amber-100 font-semibold text-slate-900" : "text-slate-700"
                  }`}
                >
                  {cell.text}
                </td>
              ))}
              <td className="px-3 py-1.5 text-slate-700">{row.total}</td>
              <td
                className="whitespace-nowrap px-3 py-1.5 font-semibold text-slate-900"
                data-testid="predominant-level"
                data-level={row.predominant?.level}
              >
                {row.predominant?.label ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Admin → Resultados: A/B barras simples, C/D tablas por categoría y dominio. */
export function AdminReportChartsPanel({ aggregate }: { aggregate: ReportChartsAggregate }) {
  return (
    <section className="space-y-3" data-testid="admin-report-charts">
      <div className="grid gap-3 lg:grid-cols-2">
        {simpleDashboardPanels(aggregate).map((panel) => (
          <SimpleBarCard
            key={panel.key}
            title={panel.title}
            items={panel.items}
            testId={PANEL_TEST_IDS[panel.key]}
          />
        ))}
      </div>
      <LevelReportTable
        title={LEVEL_TABLE_TITLES.categories}
        rows={aggregate.categories}
        withCategory={false}
        testId="executive-categories-table"
      />
      <LevelReportTable
        title={LEVEL_TABLE_TITLES.domains}
        rows={aggregate.domains}
        withCategory
        testId="executive-domains-table"
      />
    </section>
  );
}
