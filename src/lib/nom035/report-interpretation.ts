/**
 * B4.29 — Textos únicos de interpretación (web + Excel + PNG).
 * Medio+ / Alto+ son agregaciones descriptivas; no son niveles oficiales NOM-035.
 */

export const NOM035_REPORT_PRESENTATION_VERSION = "B4.29";

export const MEDIO_PLUS_LABEL = "Medio+";
export const ALTO_PLUS_LABEL = "Alto+";

export const MEDIO_PLUS_DEFINITION =
  "Medio+ representa trabajadores clasificados en Medio, Alto o Muy alto.";
export const ALTO_PLUS_DEFINITION =
  "Alto+ representa trabajadores clasificados en Alto o Muy alto.";
export const PLUS_NOT_OFFICIAL_NOTE =
  "No representan nuevos niveles oficiales de la NOM-035; son indicadores descriptivos para facilitar la lectura agregada.";

export const RAW_SCORES_NOT_COMPARABLE_TEXT =
  "Los puntajes brutos de diferentes categorías y dominios no son directamente comparables entre sí, debido a que cada uno tiene rangos y puntos de corte propios establecidos para su clasificación.";
export const DISTRIBUTION_FIRST_TEXT =
  "Por ello, el análisis agregado se presenta principalmente mediante la proporción de trabajadores clasificados en Nulo, Bajo, Medio, Alto y Muy alto para cada categoría y dominio.";

export const UI_DISTRIBUTION_NOTE =
  "Los dominios se interpretan por la distribución de trabajadores en cada nivel de riesgo; los puntajes brutos de dominios distintos no se comparan directamente.";

export const RAW_AVERAGE_LABEL = "Promedio de puntaje bruto — descriptivo";
export const RAW_AVERAGE_WARNING = "NO COMPARABLE ENTRE DOMINIOS";

export const INTERPRETATION_LINES: readonly string[] = [
  RAW_SCORES_NOT_COMPARABLE_TEXT,
  DISTRIBUTION_FIRST_TEXT,
  MEDIO_PLUS_DEFINITION,
  ALTO_PLUS_DEFINITION,
  PLUS_NOT_OFFICIAL_NOTE,
];

function formatPct(value: number): string {
  return `${value}%`;
}

/** Ej.: «70% del personal se encuentra en nivel Medio, Alto o Muy alto en este dominio.» */
export function describeMedioPlus(
  percentage: number,
  scope: "dominio" | "categoría"
): string {
  return `${formatPct(percentage)} del personal se encuentra en nivel Medio, Alto o Muy alto en ${
    scope === "dominio" ? "este dominio" : "esta categoría"
  }.`;
}

/** Ej.: «42.5% del personal se encuentra en nivel Alto o Muy alto en este dominio.» */
export function describeAltoPlus(
  percentage: number,
  scope: "dominio" | "categoría"
): string {
  return `${formatPct(percentage)} del personal se encuentra en nivel Alto o Muy alto en ${
    scope === "dominio" ? "este dominio" : "esta categoría"
  }.`;
}

export function formatCountOfTotal(count: number, total: number): string {
  return `${count} de ${total}`;
}

const LEVELS = ["nulo", "bajo", "medio", "alto", "muy_alto"] as const;
type Level = (typeof LEVELS)[number];

/**
 * Fracción (0–1) de cada segmento en una barra apilada al 100%.
 * Solo depende de personas por nivel / total; nunca de puntajes brutos.
 */
export function levelSegmentShares(
  levels: Record<Level, { count: number }>,
  total: number
): Record<Level, number> {
  const denom = Math.max(total, 1);
  const out = {} as Record<Level, number>;
  for (const level of LEVELS) out[level] = (levels[level]?.count ?? 0) / denom;
  return out;
}
