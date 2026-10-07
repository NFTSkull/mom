import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildNom035AggregateReport,
  type NamedLevelMatrix,
  type Nom035AggregateReport,
} from "../aggregate-report";
import { RISK_CHART_HEX, RISK_LEVEL_ORDER } from "../risk-palette";
import { AdminReportChartsPanel } from "@/components/admin/report-charts-panel";
import { B429_CATEGORIES, B429_DOMAINS, buildB429ProductionLikeReport } from "./fixtures/b429-production-matrix";

const JORNADA = "Jornada de trabajo";

function aggregate(report = buildB429ProductionLikeReport()): Nom035AggregateReport {
  return buildNom035AggregateReport(report, { companyName: "Empresa Demo" });
}

function panel(agg: Nom035AggregateReport): string {
  return renderToStaticMarkup(createElement(AdminReportChartsPanel, { aggregate: agg }));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function block(html: string, testId: string, end = "</li>"): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  expect(start, testId).toBeGreaterThan(-1);
  const rest = html.slice(start);
  return rest.slice(0, rest.indexOf(end));
}

/** Segmentos de la barra apilada: nivel, ancho %, color y texto visible. */
function segments(row: string) {
  return [
    ...row.matchAll(
      /<div data-level="([a-z_]+)" title="[^"]*" class="[^"]*" style="width:([\d.]+)%;background-color:(#[0-9a-f]{6})">([^<]*)<\/div>/g
    ),
  ].map((m) => ({ level: m[1], width: Number(m[2]), color: m[3], text: m[4] }));
}

function find(rows: NamedLevelMatrix[], name: string): NamedLevelMatrix {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(name);
  return row;
}

describe("B4.29.7 barras apiladas a color en Admin → Resultados", () => {
  it("1. secciones de categoría y dominio con «Total evaluados» y leyenda de 5 niveles", () => {
    const html = panel(aggregate());
    for (const [testId, title] of [
      ["chart-category-distribution", "C. Distribución de riesgo por categoría"],
      ["chart-domain-distribution", "D. Distribución de riesgo por dominio"],
    ]) {
      const card = block(html, testId, "<ul");
      expect(card).toContain(`>${title}</h3>`);
      expect(card).toMatch(/Total evaluados: (<!-- -->)?80/);
      for (const label of ["Nulo", "Bajo", "Medio", "Alto", "Muy alto"]) expect(card).toContain(label);
    }
  });

  it("2. colores por nivel: Nulo gris, Bajo verde, Medio ámbar, Alto naranja, Muy alto rojo", () => {
    expect(RISK_CHART_HEX).toEqual({
      nulo: "#64748b",
      bajo: "#16a34a",
      medio: "#ca8a04",
      alto: "#ea580c",
      muy_alto: "#dc2626",
    });
    const segs = segments(block(panel(aggregate()), `dist-row-${slug(JORNADA)}`));
    expect(segs.map((s) => [s.level, s.color])).toEqual(RISK_LEVEL_ORDER.map((l) => [l, RISK_CHART_HEX[l]]));
  });

  it("3. Jornada refleja la data real: segmentos 17.5/12.5/27.5/30/12.5 y Alto es el más ancho", () => {
    const segs = segments(block(panel(aggregate()), `dist-row-${slug(JORNADA)}`));
    expect(segs.map((s) => Math.round(s.width * 100) / 100)).toEqual([17.5, 12.5, 27.5, 30, 12.5]);
    expect(segs.map((s) => s.text)).toEqual(["17.5%", "12.5%", "27.5%", "30%", "12.5%"]);
    const widest = segs.reduce((a, b) => (b.width > a.width ? b : a));
    expect(widest.level).toBe("alto");
  });

  it("4. porcentaje dentro del segmento solo cuando cabe (≥ 9%)", () => {
    const html = panel(aggregate());
    const liderazgo = segments(block(html, "dist-row-liderazgo"));
    expect(liderazgo.map((s) => [s.level, s.text])).toEqual([
      ["nulo", "62.5%"],
      ["bajo", ""],
      ["medio", "10%"],
      ["alto", ""],
      ["muy_alto", "13.75%"],
    ]);
  });

  it("5. Medio+ y Alto+ a la derecha como «x / total · %»", () => {
    const row = block(panel(aggregate()), `dist-row-${slug(JORNADA)}`).replace(/<!-- -->/g, "");
    expect(row).toContain("Medio+:</span> 56 / 80 · 70%");
    expect(row).toContain("Alto+:</span> 34 / 80 · 42.5%");
  });

  it("6. orden y nombres de categorías y dominios sin cambios", () => {
    const html = panel(aggregate());
    const order = (names: string[]) => names.map((n) => html.indexOf(`data-testid="dist-row-${slug(n)}"`));
    for (const names of [Object.keys(B429_CATEGORIES), Object.keys(B429_DOMAINS)]) {
      const idx = order(names);
      expect(idx.every((i) => i > -1)).toBe(true);
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
  });

  it("7. sin promedios brutos, sin etiqueta de nivel predominante ni lógica especial para Jornada", () => {
    const html = panel(aggregate());
    expect(html).not.toMatch(/Promedio por (categor[ií]a|dominio)/i);
    expect(html).not.toContain("2.86");
    expect(html).not.toMatch(/Nivel predominante|Predominante|data-predominant/);
    const src = readFileSync("src/components/admin/report-charts-panel.tsx", "utf8");
    expect(src).not.toMatch(/Jornada|predominantLevelOf|domainAverages|categoryAverages|\.score\b/);
  });

  it("8. tabla completa plegable conserva Nulo…Total", () => {
    const html = panel(aggregate());
    const table = block(html, "chart-domain-distribution-table", "</thead>");
    expect([...table.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1])).toEqual([
      "Dominio", "Nulo", "Bajo", "Medio", "Alto", "Muy alto", "Total",
    ]);
    const row = block(html, `chart-domain-distribution-table-row-${slug(JORNADA)}`, "</tr>");
    expect([...row.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1])).toEqual([
      JORNADA, "14 (17.5%)", "10 (12.5%)", "22 (27.5%)", "24 (30%)", "10 (12.5%)", "80",
    ]);
  });

  it("9. data sin modificar: 80 resultados, test excluido, conteos de Jornada", () => {
    const agg = aggregate();
    expect(agg.population.realResults).toBe(80);
    expect(agg.population.testResultsIncluded).toBe(0);
    const j = find(agg.domains, JORNADA);
    expect(RISK_LEVEL_ORDER.map((l) => j.levels[l].count)).toEqual([14, 10, 22, 24, 10]);
    const mutation = /\.(insert|update|upsert|delete)\(|\b(insert\s+into|update\s+public\.|delete\s+from)\b/i;
    for (const file of ["src/components/admin/report-charts-panel.tsx", "src/lib/nom035/report-interpretation.ts"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(mutation);
    }
  });
});
