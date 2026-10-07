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

export const LEVEL_TABLE_RULE_TEXT =
  "En las tablas por categoría y por dominio, la columna «Predominante» y la celda resaltada indican el nivel predominante: el nivel con más trabajadores (en empate, el nivel menor). No se calcula con puntajes brutos.";

export const INTERPRETATION_LINES: readonly string[] = [
  RAW_SCORES_NOT_COMPARABLE_TEXT,
  DISTRIBUTION_FIRST_TEXT,
  LEVEL_TABLE_RULE_TEXT,
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

export const LEVEL_UPPER_LABEL: Record<Level, string> = {
  nulo: "NULO",
  bajo: "BAJO",
  medio: "MEDIO",
  alto: "ALTO",
  muy_alto: "MUY ALTO",
};

/**
 * Nivel con más trabajadores. En empate gana el primero en orden Nulo→Muy alto,
 * igual que «riesgo predominante» de la distribución general.
 */
export function predominantLevelOf(
  levels: Record<Level, { count: number }>
): { level: Level; count: number } | null {
  let best: { level: Level; count: number } | null = null;
  for (const level of LEVELS) {
    const count = levels[level]?.count ?? 0;
    if (count > 0 && (!best || count > best.count)) best = { level, count };
  }
  return best;
}

export const SIMPLE_DASHBOARD_TITLES = {
  risk: "Distribución por nivel de riesgo",
  completion: "Avance de evaluación",
} as const;

export const LEVEL_TABLE_TITLES = {
  categories: "Resultados por categoría",
  domains: "Resultados por dominio",
} as const;

export const PREDOMINANT_COLUMN_LABEL = "Predominante";

export const SIMPLE_RISK_LABELS: Record<Level, string> = {
  nulo: "Nulo/despreciable",
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  muy_alto: "Muy alto",
};

export type SimpleBarItem = { label: string; value: string; ratio: number };
export type SimpleDashboardPanel = {
  key: keyof typeof SIMPLE_DASHBOARD_TITLES;
  title: string;
  items: SimpleBarItem[];
};

function countItems(rows: Array<{ label: string; count: number }>): SimpleBarItem[] {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => ({ label: r.label, value: String(r.count), ratio: r.count / max }));
}

/** Paneles de barras simples (personas por nivel y avance). */
export function simpleDashboardPanels(agg: {
  population: { realCompleted: number; realPending: number; realInProgress: number };
  overallRiskDistribution: ReadonlyArray<{ level: Level; count: number }>;
}): SimpleDashboardPanel[] {
  return [
    {
      key: "risk",
      title: SIMPLE_DASHBOARD_TITLES.risk,
      items: countItems(
        agg.overallRiskDistribution.map((r) => ({ label: SIMPLE_RISK_LABELS[r.level], count: r.count }))
      ),
    },
    {
      key: "completion",
      title: SIMPLE_DASHBOARD_TITLES.completion,
      items: countItems([
        { label: "Completados", count: agg.population.realCompleted },
        { label: "Pendientes", count: agg.population.realPending },
        { label: "En progreso", count: agg.population.realInProgress },
      ]),
    },
  ];
}

/** Ej.: «48 (60%)». */
export function formatLevelCell(count: number, percentage: number): string {
  return `${count} (${percentage}%)`;
}

export type LevelTableRow = {
  name: string;
  category: string | null;
  cells: Array<{ level: Level; text: string; predominant: boolean }>;
  total: number;
  predominant: { level: Level; label: string } | null;
};

/**
 * Fila de tabla Nulo…Muy alto con «conteo (porcentaje%)». El nivel predominante sale de
 * predominantLevelOf sobre los conteos persistidos; nunca de puntajes brutos.
 */
export function levelTableRows(
  rows: ReadonlyArray<{
    name: string;
    category?: string | null;
    total: number;
    levels: Record<Level, { count: number; percentage: number }>;
  }>
): LevelTableRow[] {
  return rows.map((row) => {
    const top = predominantLevelOf(row.levels);
    return {
      name: row.name,
      category: row.category ?? null,
      cells: LEVELS.map((level) => ({
        level,
        text: formatLevelCell(row.levels[level].count, row.levels[level].percentage),
        predominant: top?.level === level,
      })),
      total: row.total,
      predominant: top ? { level: top.level, label: LEVEL_UPPER_LABEL[top.level] } : null,
    };
  });
}
