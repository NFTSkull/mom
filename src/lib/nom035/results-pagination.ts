/**
 * B4.25 — Helpers de paginación para Admin → Resultados.
 */

export const RESULTS_PAGE_SIZE = 20;

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
}): URLSearchParams {
  const pageSize = input.pageSize ?? RESULTS_PAGE_SIZE;
  const page = Math.max(1, Math.floor(input.page) || 1);
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (input.search) q.set("search", input.search);
  if (input.riskLevel) q.set("riskLevel", input.riskLevel);
  if (input.campaignId) q.set("campaignId", input.campaignId);
  return q;
}
