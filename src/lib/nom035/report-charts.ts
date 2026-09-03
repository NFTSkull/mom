/**
 * B4.27 — Gráficas PNG de alta resolución (pureimage) + labels multilínea.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
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
  categoryAverages: Buffer;
  domainAverages: Buffer;
  individualCategories?: Buffer;
  individualDomains?: Buffer;
};

const FONT_FAMILY = "Nom035Sans";
let fontLoadPromise: Promise<boolean> | null = null;

function resolveFontPath(): string | null {
  const candidates = [
    join(process.cwd(), "src/lib/nom035/fonts/Nom035Sans.ttf"),
    join(process.cwd(), "fonts/Nom035Sans.ttf"),
    "/System/Library/Fonts/Supplemental/Arial.ttf",
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export async function ensureChartFont(): Promise<boolean> {
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      const path = resolveFontPath();
      if (!path) return false;
      try {
        const font = PImage.registerFont(path, FONT_FAMILY);
        await font.load();
        return true;
      } catch {
        return false;
      }
    })();
  }
  return fontLoadPromise;
}

/** Envuelve etiquetas sin truncar con “…”. */
export function wrapChartLabel(
  text: string,
  maxCharsPerLine = 18,
  maxLines = 3
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (lines.length >= maxLines - 1) {
      const rest = [current, word, ...words.slice(i + 1)]
        .filter(Boolean)
        .join(" ");
      lines.push(rest);
      current = "";
      break;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else if (!current) {
      lines.push(word);
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

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

function setFont(ctx: CanvasCtx, size: number, _weight: "normal" | "bold" = "normal"): void {
  // pureimage + TTF Regular: "bold" en la cadena hace fallar fillText.
  void _weight;
  ctx.font = `${size}px ${FONT_FAMILY}`;
}

function drawTitle(ctx: CanvasCtx, title: string, width: number): void {
  setFont(ctx, 22, "bold");
  ctx.fillStyle = "#0f172a";
  const lines = wrapChartLabel(title, 70, 2);
  lines.forEach((line, i) => {
    ctx.fillText(line, 28, 36 + i * 26);
  });
  void width;
}

function drawYGrid(
  ctx: CanvasCtx,
  margin: { top: number; left: number; right: number; bottom: number },
  width: number,
  height: number,
  maxVal: number
): void {
  const innerH = height - margin.top - margin.bottom;
  const ticks = Math.min(5, Math.max(1, Math.ceil(maxVal)));
  const step = maxVal / ticks;
  for (let i = 0; i <= ticks; i++) {
    const v = step * i;
    const y = margin.top + innerH - (v / Math.max(maxVal, 1)) * innerH;
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    setFont(ctx, 12);
    ctx.fillStyle = "#64748b";
    const label = Number.isInteger(v) ? String(v) : v.toFixed(1);
    ctx.fillText(label, 10, y + 4);
  }
}

function drawWrappedLabel(
  ctx: CanvasCtx,
  text: string,
  x: number,
  y: number,
  maxChars: number
): void {
  const lines = wrapChartLabel(text, maxChars, 3);
  setFont(ctx, 11);
  ctx.fillStyle = "#334155";
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * 13);
  });
}

function drawFinalRiskBars(input: {
  title: string;
  labels: string[];
  counts: number[];
  percentages: number[];
  colors: string[];
  width?: number;
  height?: number;
}): PImage.Bitmap {
  const width = input.width ?? 1400;
  const height = input.height ?? 700;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  fillBg(ctx, width, height);
  drawTitle(ctx, input.title, width);

  const margin = { top: 80, right: 36, bottom: 90, left: 64 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxVal = Math.max(1, ...input.counts);
  drawYGrid(ctx, margin, width, height, maxVal);

  const n = Math.max(input.counts.length, 1);
  const gap = 28;
  const barW = Math.max(40, (innerW - gap * (n - 1)) / n);

  input.counts.forEach((count, i) => {
    const h = (count / maxVal) * innerH;
    const x = margin.left + i * (barW + gap);
    const y = margin.top + innerH - h;
    ctx.fillStyle = input.colors[i] ?? "#334155";
    ctx.fillRect(x, y, barW, Math.max(h, count > 0 ? 2 : 0));

    setFont(ctx, 18, "bold");
    ctx.fillStyle = "#0f172a";
    const countLabel = String(count);
    ctx.fillText(countLabel, x + barW / 2 - countLabel.length * 5, y - 32);
    setFont(ctx, 14);
    ctx.fillStyle = "#475569";
    const pct = `${input.percentages[i] ?? 0}%`;
    ctx.fillText(pct, x + barW / 2 - pct.length * 4, y - 12);

    setFont(ctx, 15, "bold");
    ctx.fillStyle = "#0f172a";
    const axis = input.labels[i] ?? "";
    ctx.fillText(axis, x + barW / 2 - axis.length * 4.5, margin.top + innerH + 32);
  });

  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + innerH);
  ctx.lineTo(width - margin.right, margin.top + innerH);
  ctx.stroke();

  return img;
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
  const width = input.width ?? 1000;
  const height = input.height ?? 520;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  fillBg(ctx, width, height);
  drawTitle(ctx, input.title, width);

  const margin = { top: 72, right: 28, bottom: 100, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxVal = Math.max(1, ...input.values, 0);
  drawYGrid(ctx, margin, width, height, maxVal);

  const n = Math.max(input.values.length, 1);
  const gap = 16;
  const barW = Math.max(24, (innerW - gap * (n - 1)) / n);
  const maxChars = Math.max(8, Math.floor(barW / 7));

  input.values.forEach((value, i) => {
    const h = (value / maxVal) * innerH;
    const x = margin.left + i * (barW + gap);
    const y = margin.top + innerH - h;
    ctx.fillStyle = input.colors?.[i] ?? "#334155";
    ctx.fillRect(x, y, barW, h);

    setFont(ctx, 13, "bold");
    ctx.fillStyle = "#0f172a";
    ctx.fillText(`${value}${input.valueSuffix ?? ""}`, x + 4, y - 8);

    drawWrappedLabel(ctx, input.labels[i] ?? "", x, margin.top + innerH + 18, maxChars);
  });

  ctx.strokeStyle = "#94a3b8";
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
  const width = input.width ?? 1400;
  const height = input.height ?? 700;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  fillBg(ctx, width, height);
  drawTitle(ctx, input.title, width);

  const margin = { top: 80, right: 24, bottom: 130, left: 56 };
  const legendY = height - 42;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const groups = Math.max(input.groupLabels.length, 1);
  const seriesCount = Math.max(input.series.length, 1);
  const groupGap = 22;
  const groupW = Math.max(56, (innerW - groupGap * (groups - 1)) / groups);
  const barGap = 3;
  const barW = Math.max(6, (groupW - barGap * (seriesCount - 1)) / seriesCount);
  const maxVal = Math.max(1, ...input.series.flatMap((s) => s.values), 0);
  drawYGrid(ctx, margin, width, height, maxVal);

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
      if (value > 0) {
        setFont(ctx, 10, "bold");
        ctx.fillStyle = "#0f172a";
        ctx.fillText(String(value), x, y - 4);
      }
    }
    const maxChars = Math.max(10, Math.floor(groupW / 6.5));
    drawWrappedLabel(
      ctx,
      input.groupLabels[g] ?? "",
      groupX,
      margin.top + innerH + 18,
      maxChars
    );
  }

  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + innerH);
  ctx.lineTo(width - margin.right, margin.top + innerH);
  ctx.stroke();

  let lx = margin.left;
  for (const series of input.series) {
    ctx.fillStyle = series.color;
    ctx.fillRect(lx, legendY, 14, 14);
    setFont(ctx, 12);
    ctx.fillStyle = "#334155";
    ctx.fillText(series.label, lx + 20, legendY + 12);
    lx += 110;
  }

  return img;
}

export async function renderExecutiveCharts(
  agg: Nom035AggregateReport
): Promise<ReportChartImages> {
  await ensureChartFont();
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
      drawFinalRiskBars({
        title: "CALIFICACIÓN FINAL DE RIESGOS PSICOSOCIALES",
        labels: riskLabels,
        counts: riskCounts,
        percentages: riskPcts,
        colors: riskColors,
        width: 1400,
        height: 700,
      })
    ),
    encodePng(
      drawSimpleBars({
        title: "CALIFICACIÓN FINAL — PORCENTAJE",
        labels: riskLabels,
        values: riskPcts,
        colors: riskColors,
        width: 1100,
        height: 560,
        valueSuffix: "%",
      })
    ),
    encodePng(
      drawGroupedBars({
        title:
          "CALIFICACIÓN DE CATEGORÍAS DE RIESGOS PSICOSOCIALES POR TOTAL DE PERSONAL EVALUADO",
        groupLabels: agg.categories.map((c) => c.name),
        series: catSeries,
        width: 1400,
        height: 700,
      })
    ),
    encodePng(
      drawGroupedBars({
        title:
          "CALIFICACIÓN DE DOMINIOS DE RIESGOS PSICOSOCIALES (1/2) POR TOTAL DE PERSONAL EVALUADO",
        groupLabels: domainsA.map((d) => d.name),
        series: makeDomainSeries(domainsA),
        width: 1400,
        height: 700,
      })
    ),
    encodePng(
      drawGroupedBars({
        title:
          "CALIFICACIÓN DE DOMINIOS DE RIESGOS PSICOSOCIALES (2/2) POR TOTAL DE PERSONAL EVALUADO",
        groupLabels: domainsB.map((d) => d.name),
        series: makeDomainSeries(domainsB),
        width: 1400,
        height: 700,
      })
    ),
    encodePng(
      drawSimpleBars({
        title: "Acontecimiento traumático severo (Guía I)",
        labels: ["Sí", "No"],
        values: [agg.traumaticEvent.yes, agg.traumaticEvent.no],
        colors: ["#dc2626", "#16a34a"],
        width: 900,
        height: 480,
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
        width: 900,
        height: 480,
      })
    ),
  ]);

  return {
    riskDistribution,
    riskDistributionPct,
    categoriesGrouped,
    domainsGrouped,
    domainsGroupedB,
    traumaticEvent,
    completionStatus,
    categoryAverages: categoriesGrouped,
    domainAverages: domainsGrouped,
  };
}

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
  await ensureChartFont();
  const [riskDistribution, categoryAverages, domainAverages, completionStatus] =
    await Promise.all([
      encodePng(
        drawSimpleBars({
          title: "Distribución de niveles de riesgo",
          labels: input.riskDistribution.labels,
          values: input.riskDistribution.values,
          colors: RISK_LEVEL_ORDER.map((l) => RISK_CHART_HEX[l]),
          width: 1100,
          height: 560,
        })
      ),
      encodePng(
        drawSimpleBars({
          title: "Promedio por categoría",
          labels: input.categoryAverages.labels,
          values: input.categoryAverages.values,
          width: 1100,
          height: 560,
        })
      ),
      encodePng(
        drawSimpleBars({
          title: "Promedio por dominio",
          labels: input.domainAverages.labels,
          values: input.domainAverages.values,
          width: 1200,
          height: 600,
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
  await ensureChartFont();
  const [individualCategories, individualDomains] = await Promise.all([
    encodePng(
      drawSimpleBars({
        title: "Puntaje por categoría",
        labels: input.categories.labels,
        values: input.categories.values,
        colors: input.categoryColors,
        width: 1200,
        height: 560,
      })
    ),
    encodePng(
      drawSimpleBars({
        title: "Puntaje por dominio",
        labels: input.domains.labels,
        values: input.domains.values,
        colors: input.domainColors,
        width: 1400,
        height: 620,
      })
    ),
  ]);
  return { individualCategories, individualDomains };
}

export function isLikelyPng(buf: Buffer): boolean {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
}

/** Verifica que el PNG no sea un lienzo casi vacío (smoke visual). */
export async function pngHasVisibleInk(buf: Buffer, minNonWhiteRatio = 0.01): Promise<boolean> {
  if (!isLikelyPng(buf)) return false;
  const stream = new PassThrough();
  stream.end(buf);
  const bitmap = await PImage.decodePNGFromStream(stream);
  const data = bitmap.data as Buffer | Uint8Array;
  let nonWhite = 0;
  const total = bitmap.width * bitmap.height;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    if (r < 250 || g < 250 || b < 250) nonWhite += 1;
  }
  return nonWhite / Math.max(total, 1) >= minNonWhiteRatio;
}
