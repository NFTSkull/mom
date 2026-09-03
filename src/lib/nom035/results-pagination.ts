/**
 * B4.25/B4.28.1 — Helpers de paginación y ordenamiento para Admin → Resultados.
 */

export const RESULTS_PAGE_SIZE = 20;

export type ResultSort = "name_asc" | "name_desc" | "recent" | "oldest";
export const DEFAULT_SORT: ResultSort = "name_asc";
export const SORT_OPTIONS: Array<{ value: ResultSort; label: string }> = [
  { value: "name_asc",  label: "Nombre A–Z"   },
  { value: "name_desc", label: "Nombre Z–A"   },
  { value: "recent",    label: "Más recientes" },
  { value: "oldest",    label: "Más antiguos"  },
];

export function parseResultSort(raw: string | null | undefined): ResultSort {
  if (raw === "name_asc" || raw === "name_desc" || raw === "recent" || raw === "oldest") {
    return raw;
  }
  return DEFAULT_SORT;
}

export function sortLabel(sort: ResultSort): string {
  return SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Nombre A–Z";
}

export function computeTotalPages(total: number, pageSize: number = RESULTS_PAGE_SIZE): number {
  const size = Math.max(1, pageSize);
  const t = Math.max(0, total);
  if (t === 0) return 1;
  return Math.ceil(t / size);
}

/** Normaliza page a [1, totalPages]. */
export function normalizePage(
  page: number,
  total: number,
  pageSize: number = RESULTS_PAGE_SIZE
): number {
  const totalPages = computeTotalPages(total, pageSize);
  if (!Number.isFinite(page) || page < 1) return 1;
  if (page > totalPages) return totalPages;
  return Math.floor(page);
}

export function canGoPrevious(page: number): boolean {
  return page > 1;
}

export function canGoNext(page: number, total: number, pageSize: number = RESULTS_PAGE_SIZE): boolean {
  return page < computeTotalPages(total, pageSize);
}

/** Offset SQL: (page - 1) * pageSize */
export function pageOffset(page: number, pageSize: number = RESULTS_PAGE_SIZE): number {
  const p = Math.max(1, Math.floor(page) || 1);
  return (p - 1) * Math.max(1, pageSize);
}

export function assertNoDuplicatesAcrossPages(
  pages: Array<Array<{ id: string }>>
): { ok: true; unique: number } | { ok: false; duplicateId: string } {
  const seen = new Set<string>();
  for (const items of pages) {
    for (const item of items) {
      if (seen.has(item.id)) return { ok: false, duplicateId: item.id };
      seen.add(item.id);
    }
  }
  return { ok: true, unique: seen.size };
}

export function buildResultsListQuery(input: {
  page: number;
  pageSize?: number;
  search?: string;
  riskLevel?: string;
  campaignId?: string;
  sort?: ResultSort;
}): URLSearchParams {
  const pageSize = input.pageSize ?? RESULTS_PAGE_SIZE;
  const page = Math.max(1, Math.floor(input.page) || 1);
  const sort = input.sort ?? DEFAULT_SORT;
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
  });
  if (input.search) q.set("search", input.search);
  if (input.riskLevel) q.set("riskLevel", input.riskLevel);
  if (input.campaignId) q.set("campaignId", input.campaignId);
  return q;
}
