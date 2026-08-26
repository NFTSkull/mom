/**
 * B4.24 — Gráficas PNG server-side (pureimage, sin native deps) para Excel/Vercel.
 */

import { PassThrough } from "node:stream";
import * as PImage from "pureimage";
import type { ChartDataset } from "@/lib/nom035/report-data";

export type ReportChartImages = {
  riskDistribution: Buffer;
  categoryAverages: Buffer;
  domainAverages: Buffer;
  completionStatus: Buffer;
  individualCategories?: Buffer;
  individualDomains?: Buffer;
};

const COLORS = ["#64748b", "#334155", "#0f766e", "#b45309", "#b91c1c", "#6366f1"];

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

function drawBarChart(input: {
  title: string;
  dataset: ChartDataset;
  width?: number;
  height?: number;
}): PImage.Bitmap {
  const width = input.width ?? 720;
  const height = input.height ?? 420;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const margin = { top: 48, right: 24, bottom: 48, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxVal = Math.max(1, ...input.dataset.values, 0);
  const barCount = Math.max(input.dataset.values.length, 1);
  const gap = 8;
  const barW = Math.max(12, (innerW - gap * (barCount - 1)) / barCount);

  ctx.fillStyle = "#334155";
  input.dataset.values.forEach((value, i) => {
    const h = (value / maxVal) * innerH;
    const x = margin.left + i * (barW + gap);
    const y = margin.top + innerH - h;
    ctx.fillRect(x, y, barW, h);
  });

  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + innerH);
  ctx.lineTo(width - margin.right, margin.top + innerH);
  ctx.stroke();

  return img;
}

function drawPieChart(input: {
  title: string;
  dataset: ChartDataset;
  width?: number;
  height?: number;
}): PImage.Bitmap {
  const width = input.width ?? 720;
  const height = input.height ?? 420;
  const img = PImage.make(width, height);
  const ctx = img.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2 + 10;
  const r = Math.min(width, height) / 3;
  const total = input.dataset.values.reduce((a, b) => a + b, 0) || 1;
  let angle = -Math.PI / 2;

  input.dataset.values.forEach((value, i) => {
    const slice = (value / total) * Math.PI * 2;
    const end = angle + slice;
    ctx.fillStyle = COLORS[i % COLORS.length]!;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, end);
    ctx.closePath();
    ctx.fill();
    angle = end;
  });

  return img;
}

export async function renderAggregateCharts(input: {
  riskDistribution: ChartDataset;
  categoryAverages: ChartDataset;
  domainAverages: ChartDataset;
  completionStatus: ChartDataset;
}): Promise<ReportChartImages> {
  const [riskDistribution, categoryAverages, domainAverages, completionStatus] =
    await Promise.all([
      encodePng(
        drawPieChart({
          title: "Distribución de niveles de riesgo",
          dataset: input.riskDistribution,
        })
      ),
      encodePng(
        drawBarChart({
          title: "Promedio por categoría",
          dataset: input.categoryAverages,
        })
      ),
      encodePng(
        drawBarChart({
          title: "Promedio por dominio",
          dataset: input.domainAverages,
          height: 460,
        })
      ),
      encodePng(
        drawBarChart({
          title: "Completados vs pendientes vs en progreso",
          dataset: input.completionStatus,
        })
      ),
    ]);

  return { riskDistribution, categoryAverages, domainAverages, completionStatus };
}

export async function renderIndividualCharts(input: {
  categories: ChartDataset;
  domains: ChartDataset;
}): Promise<Pick<ReportChartImages, "individualCategories" | "individualDomains">> {
  const [individualCategories, individualDomains] = await Promise.all([
    encodePng(
      drawBarChart({
        title: "Puntaje por categoría",
        dataset: input.categories,
      })
    ),
    encodePng(
      drawBarChart({
        title: "Puntaje por dominio",
        dataset: input.domains,
        height: 460,
      })
    ),
  ]);
  return { individualCategories, individualDomains };
}

/** Compat tests: PNG válido con firma PK alternativa vía PNG signature. */
export function isLikelyPng(buf: Buffer): boolean {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
}
