/**
 * B4.24 — Gráficas PNG server-side (SVG → sharp) para Excel.
 */

import sharp from "sharp";
import type { ChartDataset } from "@/lib/nom035/report-data";

export type ReportChartImages = {
  riskDistribution: Buffer;
  categoryAverages: Buffer;
  domainAverages: Buffer;
  completionStatus: Buffer;
  individualCategories?: Buffer;
  individualDomains?: Buffer;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateLabel(label: string, max = 28): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function buildBarChartSvg(input: {
  title: string;
  dataset: ChartDataset;
  width?: number;
  height?: number;
  horizontal?: boolean;
}): string {
  const width = input.width ?? 720;
  const height = input.height ?? 420;
  const margin = { top: 48, right: 24, bottom: 96, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxVal = Math.max(1, ...input.dataset.values, 0);
  const barCount = Math.max(input.dataset.values.length, 1);
  const gap = 8;
  const barW = Math.max(12, (innerW - gap * (barCount - 1)) / barCount);

  const bars = input.dataset.values
    .map((value, i) => {
      const h = (value / maxVal) * innerH;
      const x = margin.left + i * (barW + gap);
      const y = margin.top + innerH - h;
      const label = truncateLabel(input.dataset.labels[i] ?? "");
      const lx = x + barW / 2;
      const ly = height - margin.bottom + 16;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#334155" rx="2"/>
        <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="#0f172a">${value}</text>
        <text transform="rotate(-35 ${lx} ${ly})" x="${lx}" y="${ly}" text-anchor="end" font-size="10" fill="#475569">${escapeXml(label)}</text>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="${margin.left}" y="28" font-size="16" font-weight="600" fill="#0f172a">${escapeXml(input.title)}</text>
    <line x1="${margin.left}" y1="${margin.top + innerH}" x2="${width - margin.right}" y2="${margin.top + innerH}" stroke="#cbd5e1"/>
    ${bars}
  </svg>`;
}

function buildPieChartSvg(input: {
  title: string;
  dataset: ChartDataset;
  width?: number;
  height?: number;
}): string {
  const width = input.width ?? 720;
  const height = input.height ?? 420;
  const cx = width / 2;
  const cy = height / 2 + 10;
  const r = Math.min(width, height) / 3;
  const total = input.dataset.values.reduce((a, b) => a + b, 0) || 1;
  const colors = ["#64748b", "#334155", "#0f766e", "#b45309", "#b91c1c", "#6366f1"];

  let angle = -Math.PI / 2;
  const slices = input.dataset.values
    .map((value, i) => {
      const slice = (value / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += slice;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      const large = slice > Math.PI ? 1 : 0;
      const color = colors[i % colors.length];
      const mid = angle - slice / 2;
      const lx = cx + (r + 24) * Math.cos(mid);
      const ly = cy + (r + 24) * Math.sin(mid);
      const label = truncateLabel(input.dataset.labels[i] ?? "", 22);
      return `
        <path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}"/>
        <text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" fill="#0f172a">${escapeXml(label)} (${value})</text>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="24" y="28" font-size="16" font-weight="600" fill="#0f172a">${escapeXml(input.title)}</text>
    ${slices}
  </svg>`;
}

export async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderAggregateCharts(input: {
  riskDistribution: ChartDataset;
  categoryAverages: ChartDataset;
  domainAverages: ChartDataset;
  completionStatus: ChartDataset;
}): Promise<ReportChartImages> {
  const [riskDistribution, categoryAverages, domainAverages, completionStatus] =
    await Promise.all([
      svgToPng(
        buildPieChartSvg({
          title: "Distribución de niveles de riesgo",
          dataset: input.riskDistribution,
        })
      ),
      svgToPng(
        buildBarChartSvg({
          title: "Promedio por categoría",
          dataset: input.categoryAverages,
        })
      ),
      svgToPng(
        buildBarChartSvg({
          title: "Promedio por dominio",
          dataset: input.domainAverages,
          height: 460,
        })
      ),
      svgToPng(
        buildBarChartSvg({
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
    svgToPng(
      buildBarChartSvg({
        title: "Puntaje por categoría",
        dataset: input.categories,
      })
    ),
    svgToPng(
      buildBarChartSvg({
        title: "Puntaje por dominio",
        dataset: input.domains,
        height: 460,
      })
    ),
  ]);
  return { individualCategories, individualDomains };
}

export { buildBarChartSvg, buildPieChartSvg };
