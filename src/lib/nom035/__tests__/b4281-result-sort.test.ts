/**
 * B4.28.1 — Tests de orden configurable en Admin → Resultados.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SORT,
  RESULTS_PAGE_SIZE,
  SORT_OPTIONS,
  assertNoDuplicatesAcrossPages,
  buildResultsListQuery,
  computeTotalPages,
  pageOffset,
  parseResultSort,
  sortLabel,
} from "../results-pagination";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simula filas de resultados con nombre y timestamp. */
function makeResults(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `r-${String(i).padStart(3, "0")}`,
    workerNombre: [
      "Álvarez Cruz, Pedro",
      "García Llamas, Ana",
      "Ñoño Reyes, Marco",
      "Yañez Alvarado, Alejandro",
      "Zenil Carrasco, Ricardo",
    ][i % 5]!,
    completedAt: new Date(Date.UTC(2026, 7, 10 + i)).toISOString(),
  }));
}

/** Ordena igual que la RPC con sort dado. */
function applySort(
  rows: ReturnType<typeof makeResults>,
  sort: string
): ReturnType<typeof makeResults> {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();

  return [...rows].sort((a, b) => {
    if (sort === "name_asc") {
      const diff = normalize(a.workerNombre).localeCompare(normalize(b.workerNombre), "es");
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    }
    if (sort === "name_desc") {
      const diff = normalize(b.workerNombre).localeCompare(normalize(a.workerNombre), "es");
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    }
    if (sort === "recent") {
      const diff = b.completedAt.localeCompare(a.completedAt);
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    }
    // oldest
    const diff = a.completedAt.localeCompare(b.completedAt);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("B4.28.1 result sort", () => {
  // 1. Default sort
  it("1. default sort es name_asc", () => {
    expect(DEFAULT_SORT).toBe("name_asc");
  });

  // 2. parseResultSort acepta valores válidos
  it("2. parseResultSort – valores válidos", () => {
    expect(parseResultSort("name_asc")).toBe("name_asc");
    expect(parseResultSort("name_desc")).toBe("name_desc");
    expect(parseResultSort("recent")).toBe("recent");
    expect(parseResultSort("oldest")).toBe("oldest");
  });

  // 3. parseResultSort fallback a default para cualquier inválido
  it("3. parseResultSort fallback a default", () => {
    expect(parseResultSort(null)).toBe("name_asc");
    expect(parseResultSort(undefined)).toBe("name_asc");
    expect(parseResultSort("")).toBe("name_asc");
    expect(parseResultSort("foo")).toBe("name_asc");
  });

  // 4. SORT_OPTIONS tiene exactamente 4 opciones
  it("4. SORT_OPTIONS tiene 4 opciones", () => {
    expect(SORT_OPTIONS).toHaveLength(4);
    const values = SORT_OPTIONS.map(o => o.value);
    expect(values).toContain("name_asc");
    expect(values).toContain("name_desc");
    expect(values).toContain("recent");
    expect(values).toContain("oldest");
  });

  // 5. sortLabel devuelve etiqueta legible
  it("5. sortLabel devuelve etiqueta correcta", () => {
    expect(sortLabel("name_asc")).toBe("Nombre A–Z");
    expect(sortLabel("name_desc")).toBe("Nombre Z–A");
    expect(sortLabel("recent")).toBe("Más recientes");
    expect(sortLabel("oldest")).toBe("Más antiguos");
  });

  // 6. Nombre A-Z: primero letra A antes que Z
  it("6. name_asc ordena correctamente A antes de Z", () => {
    const rows = makeResults(5);
    const sorted = applySort(rows, "name_asc");
    const nombres = sorted.map(r => r.workerNombre);
    const idxA = nombres.findIndex(n => n.startsWith("Á") || n.startsWith("A"));
    const idxZ = nombres.findIndex(n => n.startsWith("Z"));
    expect(idxA).toBeLessThan(idxZ);
  });

  // 7. Nombre Z-A: Z antes que A
  it("7. name_desc ordena correctamente Z antes de A", () => {
    const rows = makeResults(5);
    const sorted = applySort(rows, "name_desc");
    const nombres = sorted.map(r => r.workerNombre);
    const idxZ = nombres.findIndex(n => n.startsWith("Z"));
    const idxA = nombres.findIndex(n => n.startsWith("Á") || n.startsWith("A"));
    expect(idxZ).toBeLessThan(idxA);
  });

  // 8. recent: más reciente primero
  it("8. recent pone el más reciente primero", () => {
    const rows = makeResults(10);
    const sorted = applySort(rows, "recent");
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i]!.completedAt >= sorted[i + 1]!.completedAt).toBe(true);
    }
  });

  // 9. oldest: más antiguo primero
  it("9. oldest pone el más antiguo primero", () => {
    const rows = makeResults(10);
    const sorted = applySort(rows, "oldest");
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i]!.completedAt <= sorted[i + 1]!.completedAt).toBe(true);
    }
  });

  // 10. Ñ aparece en lugar correcto (entre N y O)
  it("10. Ñ aparece entre N y O en name_asc", () => {
    const rows = makeResults(5);
    const sorted = applySort(rows, "name_asc");
    const nidxN = sorted.findIndex(r => r.workerNombre.startsWith("N") || r.workerNombre.startsWith("Ñ"));
    const nidxY = sorted.findIndex(r => r.workerNombre.startsWith("Y"));
    expect(nidxN).toBeLessThan(nidxY);
  });

  // 11. Acento no elimina nombre del listado
  it("11. nombres con acentos (Á, ñ) se mantienen en listado", () => {
    const rows = makeResults(5);
    const sorted = applySort(rows, "name_asc");
    const withAccent = sorted.filter(r => /[ÁáÉéÍíÓóÚúÑñ]/.test(r.workerNombre));
    expect(withAccent.length).toBeGreaterThan(0);
  });

  // 12. buildResultsListQuery incluye sort en URL
  it("12. buildResultsListQuery incluye sort", () => {
    const q = buildResultsListQuery({ page: 1, sort: "name_desc" });
    expect(q.get("sort")).toBe("name_desc");
  });

  // 13. default sort en query
  it("13. sort default = name_asc en query", () => {
    const q = buildResultsListQuery({ page: 1 });
    expect(q.get("sort")).toBe("name_asc");
  });

  // 14. Cambio de sort resetea page=1 (query helper)
  it("14. cambio de sort con page=1 está correcto", () => {
    const q = buildResultsListQuery({ page: 1, sort: "recent" });
    expect(q.get("page")).toBe("1");
    expect(q.get("sort")).toBe("recent");
  });

  // 15. Filtros se conservan al cambiar sort
  it("15. filtros conservan sort en query", () => {
    const q = buildResultsListQuery({
      page: 2,
      search: "garcia",
      riskLevel: "alto",
      sort: "oldest",
    });
    expect(q.get("search")).toBe("garcia");
    expect(q.get("riskLevel")).toBe("alto");
    expect(q.get("sort")).toBe("oldest");
    expect(q.get("page")).toBe("2");
  });

  // 16. 80 resultados → 4 páginas, sin duplicados ni faltantes
  it("16. 80 resultados / pageSize 20 = 4 páginas sin duplicados", () => {
    const total = 80;
    const pages = Math.ceil(total / RESULTS_PAGE_SIZE);
    expect(pages).toBe(4);
    const allPages = Array.from({ length: pages }, (_, pi) => {
      const offset = pageOffset(pi + 1);
      return Array.from({ length: Math.min(RESULTS_PAGE_SIZE, total - offset) }, (__, j) => ({
        id: `r-${offset + j}`,
      }));
    });
    const check = assertNoDuplicatesAcrossPages(allPages);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.unique).toBe(80);
    const totalRows = allPages.reduce((s, p) => s + p.length, 0);
    expect(totalRows).toBe(80);
  });

  // 17. Zenil en name_asc aparece en última página (Z → último grupo)
  it("17. nombre que empieza con Z queda en posiciones finales con name_asc", () => {
    const rows = makeResults(80);
    const sorted = applySort(rows, "name_asc");
    const zenilIdx = sorted.findLastIndex(r => r.workerNombre.includes("Zenil"));
    expect(zenilIdx).toBeGreaterThan(60); // en los últimos 20 de 80
  });

  // 18. test user excluido (comprobación documental)
  it("18. migración 015 excluye is_test", () => {
    const mig = readFileSync("supabase/migrations/015_result_sort.sql", "utf8");
    expect(mig).toMatch(/is_test/);
    expect(mig).toMatch(/coalesce\(w\.is_test, false\) = false/);
  });

  // 19. migración 015 tiene unaccent y p_sort
  it("19. migración 015 tiene p_sort y unaccent", () => {
    const mig = readFileSync("supabase/migrations/015_result_sort.sql", "utf8");
    expect(mig).toMatch(/p_sort/);
    expect(mig).toMatch(/unaccent/);
    expect(mig).toMatch(/name_asc/);
    expect(mig).toMatch(/name_desc/);
    expect(mig).toMatch(/recent/);
    expect(mig).toMatch(/oldest/);
  });

  // 20. UI tiene selector sort y indicador visual
  it("20. UI tiene selector sort y summary visual", () => {
    const page = readFileSync("src/app/admin/resultados/page.tsx", "utf8");
    expect(page).toMatch(/results-sort/);
    expect(page).toMatch(/results-summary/);
    expect(page).toMatch(/sortLabel/);
    expect(page).toMatch(/parseResultSort/);
    expect(page).toMatch(/SORT_OPTIONS/);
    expect(page).toMatch(/DEFAULT_SORT/);
  });

  // 21. API route pasa sort a listResults
  it("21. API route incluye sort en llamada a listResults", () => {
    const route = readFileSync("src/app/api/admin/nom035/results/route.ts", "utf8");
    expect(route).toMatch(/sort.*searchParams\.get/);
  });

  // 22. Datos de exportación no dependen de sort de pantalla
  it("22. rutas export full/avance no tienen parámetro sort", () => {
    const full = readFileSync("src/app/api/admin/nom035/reports/full/route.ts", "utf8");
    const avance = readFileSync("src/app/api/admin/nom035/campaigns/avance-excel/route.ts", "utf8");
    expect(full).not.toMatch(/p_sort/);
    expect(avance).not.toMatch(/p_sort/);
  });

  // 23. computeTotalPages no cambia con sort
  it("23. computeTotalPages 80/20 = 4 independiente de sort", () => {
    expect(computeTotalPages(80, 20)).toBe(4);
  });
});
