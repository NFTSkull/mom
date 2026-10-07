import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildNom035AggregateReport } from "../aggregate-report";
import {
  PREDOMINANT_LEVEL_DOMAINS,
  predominantLevelBadge,
  predominantLevelOf,
} from "../report-interpretation";
import { renderExecutiveCharts } from "../report-charts";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import { buildB429ProductionLikeReport } from "./fixtures/b429-production-matrix";

const JORNADA = "Jornada de trabajo";

function aggregate() {
  return buildNom035AggregateReport(buildB429ProductionLikeReport());
}

describe("B4.29.2 Jornada de trabajo: nivel predominante ALTO", () => {
  it("la etiqueta solo aplica a Jornada de trabajo", () => {
    expect(PREDOMINANT_LEVEL_DOMAINS).toEqual([JORNADA]);
  });

  it("Jornada 14/10/22/24/10 → ALTO (24 de 80)", () => {
    const jornada = aggregate().domains.find((d) => d.name === JORNADA)!;
    expect(predominantLevelOf(jornada.levels)).toEqual({ level: "alto", count: 24 });
    expect(predominantLevelBadge(jornada)).toEqual({
      level: "alto",
      text: "Nivel predominante: ALTO (24 de 80)",
    });
  });

  it("ningún otro dominio ni categoría recibe etiqueta", () => {
    const agg = aggregate();
    for (const row of [...agg.domains, ...agg.categories]) {
      if (row.name === JORNADA) continue;
      expect(predominantLevelBadge(row), row.name).toBeNull();
    }
  });

  it("misma regla (y desempate) que «riesgo predominante» general", () => {
    const agg = aggregate();
    const overall = Object.fromEntries(
      agg.overallRiskDistribution.map((r) => [r.level, { count: r.count }])
    ) as Parameters<typeof predominantLevelOf>[0];
    expect(predominantLevelOf(overall)?.level).toBe(agg.predominantRisk.level);
    const carga = agg.domains.find((d) => d.name === "Carga de trabajo")!;
    expect(predominantLevelOf(carga.levels)).toEqual({ level: "bajo", count: 23 });
  });

  it("los conteos de Jornada no cambian", () => {
    const jornada = aggregate().domains.find((d) => d.name === JORNADA)!;
    expect(jornada.medioPlus).toEqual({ count: 56, percentage: 70 });
    expect(jornada.altoPlus).toEqual({ count: 34, percentage: 42.5 });
  });

  it("UI: una sola etiqueta, dentro de la fila de Jornada, en color Alto", () => {
    const html = renderToStaticMarkup(
      createElement(AdminReportChartsPanel, { aggregate: aggregate() })
    );
    const badges = html.match(/data-testid="predominant-level-badge"/g) ?? [];
    expect(badges).toHaveLength(1);
    const row = html.slice(html.indexOf('data-testid="dist-row-jornada-de-trabajo"'));
    expect(row.slice(0, row.indexOf("</li>"))).toContain("Nivel predominante: ALTO (24 de 80)");
    expect(html).not.toMatch(/Nivel predominante: BAJO/);
    expect(html).not.toMatch(/Promedio por dominio/);
    expect(html).not.toContain("2.86");
  });

  it("PNG de dominios se genera con la etiqueta sin alterar dimensiones", async () => {
    const charts = await renderExecutiveCharts(aggregate());
    expect(charts.domainsDistribution.length).toBeGreaterThan(10_000);
    const w = charts.domainsDistribution.readUInt32BE(16);
    const h = charts.domainsDistribution.readUInt32BE(20);
    expect([w, h]).toEqual([1600, 128 + 5 * 84 + 116]);
  });
});
