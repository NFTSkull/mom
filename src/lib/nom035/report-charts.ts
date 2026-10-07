/**
 * B4.27 — Gráficas PNG de alta resolución (pureimage) + labels multilínea.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import * as PImage from "pureimage";
import type {
  NamedLevelMatrix,
  Nom035AggregateReport,
} from "@/lib/nom035/aggregate-report";
import type { ChartDataset } from "@/lib/nom035/report-data";
import {
  RISK_CHART_HEX,
  RISK_LEVEL_ORDER,
  RISK_SHORT_LABEL,
} from "@/lib/nom035/risk-palette";
import type { RiskLevelNom035 } from "@/types/nom035";
import { levelSegmentShares } from "@/lib/nom035/report-interpretation";

type CanvasCtx = ReturnType<PImage.Bitmap["getContext"]>;

export type ReportChartImages = {
  riskDistribution: Buffer;
  riskDistributionPct: Buffer;
  /** Barras apiladas 100% por categoría (distribución por nivel). */
  categoriesDistribution: Buffer;
  /** Barras apiladas 100% por dominio (1/2). */
  domainsDistribution: Buffer;
  /** Barras apiladas 100% por dominio (2/2). */
  domainsDistributionB?: Buffer;
  traumaticEvent: Buffer;
  completionStatus: Buffer;
  individualCategories?: Buffer;
  individualDomains?: Buffer;
};

export const EXECUTIVE_CHART_TITLES = {
  categories: "DISTRIBUCIÓN DE RIESGO POR CATEGORÍA",
  domainsA: "DISTRIBUCIÓN DE RIESGO POR DOMINIO (1/2)",
  domainsB: "DISTRIBUCIÓN DE RIESGO POR DOMINIO (2/2)",
} as const;

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

function textWidth(ctx: CanvasCtx, text: string, size: number): number {
  try {
    const w = ctx.measureText(text).width;
    if (Number.isFinite(w) && w > 0) return w;
  } catch {
    /* fuente no cargada: aproximación */
  }
  return text.length * size * 0.56;
}

export type StackedLevelRow = {
  label: string;
  sublabel?: string;
  counts: Record<RiskLevelNom035, number>;
  percentages: Record<RiskLevelNom035, number>;
  total: number;
  medioPlus: { count: number; percentage: number };
  altoPlus: { count: number; percentage: number };
};

/**
 * Barra horizontal apilada al 100% por fila (distribución de personas por nivel).
 * La longitud de cada segmento es count/total; nunca se usa un puntaje bruto.
 */
function drawStackedLevelBars(input: {
  title: string;
  subtitle: string;
  rows: StackedLevelRow[];
  width?: number;
}): PImage.Bitmap {
  const width = input.width ?? 1600;
  const rowH = 84;
  const top = 128;
  const bottom = 116;
  const height = top + Math.max(input.rows.length, 1) * rowH + bottom;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  fillBg(ctx, width, height);
  drawTitle(ctx, input.title, width);
  setFont(ctx, 15);
  ctx.fillStyle = "#475569";
  ctx.fillText(input.subtitle, 28, 92);

  const labelW = 380;
  const rightW = 290;
  const x0 = labelW + 24;
  const barW = width - x0 - rightW - 32;
  const rightX = x0 + barW + 24;
  const barH = 42;

  setFont(ctx, 14, "bold");
  ctx.fillStyle = "#0f172a";
  ctx.fillText("Medio+  /  Alto+", rightX, top - 12);

  input.rows.forEach((row, i) => {
    const yTop = top + i * rowH;
    const barY = yTop + (rowH - barH) / 2;

    const lines = wrapChartLabel(row.label, 36, 2);
    const labelBlockH = lines.length * 19 + (row.sublabel ? 16 : 0);
    let ly = yTop + (rowH - labelBlockH) / 2 + 15;
    setFont(ctx, 16, "bold");
    ctx.fillStyle = "#0f172a";
    for (const line of lines) {
      ctx.fillText(line, 28, ly);
      ly += 19;
    }
    if (row.sublabel) {
      setFont(ctx, 12);
      ctx.fillStyle = "#64748b";
      ctx.fillText(wrapChartLabel(row.sublabel, 48, 1)[0] ?? "", 28, ly);
    }

    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(x0, barY, barW, barH);

    const shares = levelSegmentShares(
      {
        nulo: { count: row.counts.nulo },
        bajo: { count: row.counts.bajo },
        medio: { count: row.counts.medio },
        alto: { count: row.counts.alto },
        muy_alto: { count: row.counts.muy_alto },
      },
      row.total
    );
    let x = x0;
    let acc = 0;
    for (const level of RISK_LEVEL_ORDER) {
      const count = row.counts[level] ?? 0;
      if (count <= 0) continue;
      acc += shares[level];
      const xEnd = x0 + acc * barW;
      const segW = xEnd - x;
      ctx.fillStyle = RISK_CHART_HEX[level];
      ctx.fillRect(x, barY, segW, barH);

      const pctText = `${row.percentages[level] ?? 0}%`;
      const candidates = [`${pctText} (${count})`, pctText, String(count)];
      setFont(ctx, 14);
      const fit = candidates.find((t) => textWidth(ctx, t, 14) + 8 <= segW);
      if (fit) {
        ctx.fillStyle = "#ffffff";
        const tw = textWidth(ctx, fit, 14);
        ctx.fillText(fit, x + (segW - tw) / 2, barY + barH / 2 + 5);
      }
      x = xEnd;
    }

    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(x0, barY, barW, barH);

    setFont(ctx, 14);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(
      `Medio+: ${row.medioPlus.count}/${row.total} · ${row.medioPlus.percentage}%`,
      rightX,
      barY + 16
    );
    ctx.fillStyle = "#9a3412";
    ctx.fillText(
      `Alto+: ${row.altoPlus.count}/${row.total} · ${row.altoPlus.percentage}%`,
      rightX,
      barY + 36
    );
  });

  const legendY = height - bottom + 30;
  let lx = 28;
  for (const level of RISK_LEVEL_ORDER) {
    ctx.fillStyle = RISK_CHART_HEX[level];
    ctx.fillRect(lx, legendY, 18, 18);
    setFont(ctx, 14);
    ctx.fillStyle = "#334155";
    ctx.fillText(RISK_SHORT_LABEL[level], lx + 26, legendY + 15);
    lx += 140;
  }
  setFont(ctx, 13);
  ctx.fillStyle = "#475569";
  ctx.fillText(
    "Medio+ = Medio + Alto + Muy alto · Alto+ = Alto + Muy alto · Indicadores descriptivos; no son niveles oficiales NOM-035.",
    28,
    legendY + 50
  );

  return img;
}

function matrixToStackedRow(
  m: NamedLevelMatrix,
  withCategory: boolean
): StackedLevelRow {
  const counts = {} as Record<RiskLevelNom035, number>;
  const percentages = {} as Record<RiskLevelNom035, number>;
  for (const level of RISK_LEVEL_ORDER) {
    counts[level] = m.levels[level].count;
    percentages[level] = m.levels[level].percentage;
  }
  return {
    label: m.name,
    sublabel: withCategory && m.category ? `Categoría: ${m.category}` : undefined,
    counts,
    percentages,
    total: m.total,
    medioPlus: m.medioPlus,
    altoPlus: m.altoPlus,
  };
}

export async function renderExecutiveCharts(
  agg: Nom035AggregateReport
): Promise<ReportChartImages> {
  await ensureChartFont();
  const riskColors = RISK_LEVEL_ORDER.map((l) => RISK_CHART_HEX[l]);
  const riskLabels = RISK_LEVEL_ORDER.map((l) => RISK_SHORT_LABEL[l]);
  const riskCounts = agg.overallRiskDistribution.map((r) => r.count);
  const riskPcts = agg.overallRiskDistribution.map((r) => r.percentage);

  const n = agg.population.realResults;
  const subtitle = `Porcentaje de personal evaluado en cada nivel (N = ${n}). Cada barra suma 100%.`;
  const mid = Math.ceil(agg.domains.length / 2);
  const domainsA = agg.domains.slice(0, mid);
  const domainsB = agg.domains.slice(mid);

  const [
    riskDistribution,
    riskDistributionPct,
    categoriesDistribution,
    domainsDistribution,
    domainsDistributionB,
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
      drawStackedLevelBars({
        title: EXECUTIVE_CHART_TITLES.categories,
        subtitle,
        rows: agg.categories.map((c) => matrixToStackedRow(c, false)),
      })
    ),
    encodePng(
      drawStackedLevelBars({
        title: EXECUTIVE_CHART_TITLES.domainsA,
        subtitle,
        rows: domainsA.map((d) => matrixToStackedRow(d, true)),
      })
    ),
    encodePng(
      drawStackedLevelBars({
        title: EXECUTIVE_CHART_TITLES.domainsB,
        subtitle,
        rows: domainsB.map((d) => matrixToStackedRow(d, true)),
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
    categoriesDistribution,
    domainsDistribution,
    domainsDistributionB,
    traumaticEvent,
    completionStatus,
  };
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
