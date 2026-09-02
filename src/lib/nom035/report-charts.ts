/**
 * B4.26 — Gráficas PNG server-side (pureimage) para Excel ejecutivo.
 */

import { PassThrough } from "node:stream";
import * as PImage from "pureimage";
import type { Nom035AggregateReport } from "@/lib/nom035/aggregate-report";
import type { ChartDataset } from "@/lib/nom035/report-data";
import {
  RISK_CHART_HEX,
  RISK_LEVEL_ORDER,
  RISK_SHORT_LABEL,
} from "@/lib/nom035/risk-palette";

type CanvasCtx = ReturnType<PImage.Bitmap["getContext"]>;

export type ReportChartImages = {
  riskDistribution: Buffer;
  riskDistributionPct: Buffer;
  categoriesGrouped: Buffer;
  domainsGrouped: Buffer;
  domainsGroupedB?: Buffer;
  traumaticEvent: Buffer;
  completionStatus: Buffer;
  /** Compat B4.24 */
  categoryAverages: Buffer;
  domainAverages: Buffer;
  individualCategories?: Buffer;
  individualDomains?: Buffer;
};

async function encodePng(img: PImage.Bitmap): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = new PassThrough();
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  await PImage.encodePNGToStream(img, stream);
  stream.end();
  await done;
  return Buffer.concat(chunks);
}

function fillBg(ctx: CanvasCtx, width: number, height: number): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
}

function drawTitle(ctx: CanvasCtx, title: string): void {
  ctx.fillStyle = "#0f172a";
  ctx.font = "16px Sans-serif";
  ctx.fillText(title, 24, 28);
}

function drawSimpleBars(input: {
  title: string;
  labels: string[];
  values: number[];
  colors?: string[];
  width?: number;
  height?: number;
  valueSuffix?: string;
}): PImage.Bitmap {
  const width = input.width ?? 900;
  const height = input.height ?? 420;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  fillBg(ctx, width, height);
  drawTitle(ctx, input.title);

  const margin = { top: 56, right: 28, bottom: 72, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxVal = Math.max(1, ...input.values, 0);
  const n = Math.max(input.values.length, 1);
  const gap = 14;
  const barW = Math.max(18, (innerW - gap * (n - 1)) / n);

  input.values.forEach((value, i) => {
    const h = (value / maxVal) * innerH;
    const x = margin.left + i * (barW + gap);
    const y = margin.top + innerH - h;
    ctx.fillStyle = input.colors?.[i] ?? "#334155";
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Sans-serif";
    const label = `${value}${input.valueSuffix ?? ""}`;
    ctx.fillText(label, x + Math.max(0, barW / 2 - 10), y - 6);

    const axisLabel = input.labels[i] ?? "";
    ctx.fillStyle = "#475569";
    ctx.fillText(axisLabel.slice(0, 12), x, margin.top + innerH + 18);
  });

  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + innerH);
  ctx.lineTo(width - margin.right, margin.top + innerH);
  ctx.stroke();

  return img;
}

function drawGroupedBars(input: {
  title: string;
  groupLabels: string[];
  series: Array<{ key: string; label: string; color: string; values: number[] }>;
  width?: number;
  height?: number;
}): PImage.Bitmap {
  const width = input.width ?? 1100;
  const height = input.height ?? 480;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  fillBg(ctx, width, height);
  drawTitle(ctx, input.title);

  const margin = { top: 56, right: 24, bottom: 110, left: 48 };
  const legendY = height - 36;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const groups = Math.max(input.groupLabels.length, 1);
  const seriesCount = Math.max(input.series.length, 1);
  const groupGap = 18;
  const groupW = Math.max(40, (innerW - groupGap * (groups - 1)) / groups);
  const barGap = 2;
  const barW = Math.max(4, (groupW - barGap * (seriesCount - 1)) / seriesCount);
  const maxVal = Math.max(
    1,
    ...input.series.flatMap((s) => s.values),
    0
  );

  for (let g = 0; g < groups; g++) {
    const groupX = margin.left + g * (groupW + groupGap);
    for (let s = 0; s < seriesCount; s++) {
      const series = input.series[s]!;
      const value = series.values[g] ?? 0;
      const h = (value / maxVal) * innerH;
      const x = groupX + s * (barW + barGap);
      const y = margin.top + innerH - h;
      ctx.fillStyle = series.color;
      ctx.fillRect(x, y, barW, h);
      if (value > 0 && barW >= 8) {
        ctx.fillStyle = "#0f172a";
        ctx.font = "9px Sans-serif";
        ctx.fillText(String(value), x, y - 2);
      }
    }
    const label = input.groupLabels[g] ?? "";
    ctx.fillStyle = "#334155";
    ctx.font = "10px Sans-serif";
    const short =
      label.length > 22 ? `${label.slice(0, 20)}…` : label;
    ctx.fillText(short, groupX, margin.top + innerH + 16);
  }

  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + innerH);
  ctx.lineTo(width - margin.right, margin.top + innerH);
  ctx.stroke();

  let lx = margin.left;
  for (const series of input.series) {
    ctx.fillStyle = series.color;
    ctx.fillRect(lx, legendY, 12, 12);
    ctx.fillStyle = "#334155";
    ctx.font = "11px Sans-serif";
    ctx.fillText(series.label, lx + 16, legendY + 11);
    lx += 90;
  }

  return img;
}

export async function renderExecutiveCharts(
  agg: Nom035AggregateReport
): Promise<ReportChartImages> {
  const riskColors = RISK_LEVEL_ORDER.map((l) => RISK_CHART_HEX[l]);
  const riskLabels = RISK_LEVEL_ORDER.map((l) => RISK_SHORT_LABEL[l]);
  const riskCounts = agg.overallRiskDistribution.map((r) => r.count);
  const riskPcts = agg.overallRiskDistribution.map((r) => r.percentage);

  const catSeries = RISK_LEVEL_ORDER.map((level) => ({
    key: level,
    label: RISK_SHORT_LABEL[level],
    color: RISK_CHART_HEX[level],
    values: agg.categories.map((c) => c.levels[level].count),
  }));

  const mid = Math.ceil(agg.domains.length / 2);
  const domainsA = agg.domains.slice(0, mid);
  const domainsB = agg.domains.slice(mid);

  const makeDomainSeries = (slice: typeof agg.domains) =>
    RISK_LEVEL_ORDER.map((level) => ({
      key: level,
      label: RISK_SHORT_LABEL[level],
      color: RISK_CHART_HEX[level],
      values: slice.map((d) => d.levels[level].count),
    }));

  const [
    riskDistribution,
    riskDistributionPct,
    categoriesGrouped,
    domainsGrouped,
    domainsGroupedB,
    traumaticEvent,
    completionStatus,
  ] = await Promise.all([
    encodePng(
      drawSimpleBars({
        title: "CALIFICACIÓN FINAL DE RIESGOS PSICOSOCIALES — No. de personas",
        labels: riskLabels,
        values: riskCounts,
        colors: riskColors,
        width: 920,
        height: 400,
      })
    ),
    encodePng(
      drawSimpleBars({
        title: "CALIFICACIÓN FINAL DE RIESGOS PSICOSOCIALES — Porcentaje",
        labels: riskLabels,
        values: riskPcts,
        colors: riskColors,
        width: 920,
        height: 400,
        valueSuffix: "%",
      })
    ),
    encodePng(
      drawGroupedBars({
        title:
          "CALIFICACIÓN DE CATEGORÍAS DE RIESGOS PSICOSOCIALES POR TOTAL DE PERSONAL EVALUADO",
        groupLabels: agg.categories.map((c) => c.name),
        series: catSeries,
        width: 1100,
        height: 480,
      })
    ),
    encodePng(
      drawGroupedBars({
        title:
          "CALIFICACIÓN DE DOMINIOS DE RIESGOS PSICOSOCIALES (1/2) — PERSONAL EVALUADO",
        groupLabels: domainsA.map((d) => d.name),
        series: makeDomainSeries(domainsA),
        width: 1200,
        height: 500,
      })
    ),
    encodePng(
      drawGroupedBars({
        title:
          "CALIFICACIÓN DE DOMINIOS DE RIESGOS PSICOSOCIALES (2/2) — PERSONAL EVALUADO",
        groupLabels: domainsB.map((d) => d.name),
        series: makeDomainSeries(domainsB),
        width: 1200,
        height: 500,
      })
    ),
    encodePng(
      drawSimpleBars({
        title: "Acontecimiento traumático severo (Guía I)",
        labels: ["Sí", "No"],
        values: [agg.traumaticEvent.yes, agg.traumaticEvent.no],
        colors: ["#dc2626", "#16a34a"],
        width: 640,
        height: 360,
      })
    ),
    encodePng(
      drawSimpleBars({
        title: "Avance de evaluación",
        labels: ["Completados", "Pendientes", "En progreso"],
        values: [
          agg.population.realCompleted,
          agg.population.realPending,
          agg.population.realInProgress,
        ],
        colors: ["#0f766e", "#ca8a04", "#64748b"],
        width: 720,
        height: 360,
      })
    ),
  ]);

  // Compat promedio: usar conteo medio+ como proxy visual legacy (no se usa en nuevas hojas).
  const categoryAverages = categoriesGrouped;
  const domainAverages = domainsGrouped;

  return {
    riskDistribution,
    riskDistributionPct,
    categoriesGrouped,
    domainsGrouped,
    domainsGroupedB,
    traumaticEvent,
    completionStatus,
    categoryAverages,
    domainAverages,
  };
}

/** Compat B4.24 — datasets simples. */
export async function renderAggregateCharts(input: {
  riskDistribution: ChartDataset;
  categoryAverages: ChartDataset;
  domainAverages: ChartDataset;
  completionStatus: ChartDataset;
}): Promise<
  Pick<
    ReportChartImages,
    "riskDistribution" | "categoryAverages" | "domainAverages" | "completionStatus"
  >
> {
  const [riskDistribution, categoryAverages, domainAverages, completionStatus] =
    await Promise.all([
      encodePng(
        drawSimpleBars({
          title: "Distribución de niveles de riesgo",
          labels: input.riskDistribution.labels,
          values: input.riskDistribution.values,
          colors: RISK_LEVEL_ORDER.map((l) => RISK_CHART_HEX[l]),
        })
      ),
      encodePng(
        drawSimpleBars({
          title: "Promedio por categoría",
          labels: input.categoryAverages.labels,
          values: input.categoryAverages.values,
        })
      ),
      encodePng(
        drawSimpleBars({
          title: "Promedio por dominio",
          labels: input.domainAverages.labels,
          values: input.domainAverages.values,
          width: 1000,
          height: 460,
        })
      ),
      encodePng(
        drawSimpleBars({
          title: "Completados vs pendientes vs en progreso",
          labels: input.completionStatus.labels,
          values: input.completionStatus.values,
        })
      ),
    ]);
  return { riskDistribution, categoryAverages, domainAverages, completionStatus };
}

export async function renderIndividualCharts(input: {
  categories: ChartDataset;
  domains: ChartDataset;
  categoryColors?: string[];
  domainColors?: string[];
}): Promise<Pick<ReportChartImages, "individualCategories" | "individualDomains">> {
  const [individualCategories, individualDomains] = await Promise.all([
    encodePng(
      drawSimpleBars({
        title: "Puntaje por categoría",
        labels: input.categories.labels,
        values: input.categories.values,
        colors: input.categoryColors,
        width: 900,
        height: 400,
      })
    ),
    encodePng(
      drawSimpleBars({
        title: "Puntaje por dominio",
        labels: input.domains.labels,
        values: input.domains.values,
        colors: input.domainColors,
        width: 1100,
        height: 460,
      })
    ),
  ]);
  return { individualCategories, individualDomains };
}

export function isLikelyPng(buf: Buffer): boolean {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
}
