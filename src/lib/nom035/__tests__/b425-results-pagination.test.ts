import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  RESULTS_PAGE_SIZE,
  assertNoDuplicatesAcrossPages,
  buildResultsListQuery,
  canGoNext,
  canGoPrevious,
  computeTotalPages,
  normalizePage,
  pageOffset,
} from "../results-pagination";

describe("B4.25 results pagination", () => {
  it("pageSize oficial es 20", () => {
    expect(RESULTS_PAGE_SIZE).toBe(20);
  });

  it("totalPages para 80 completed con pageSize 20 = 4", () => {
    expect(computeTotalPages(80, 20)).toBe(4);
    expect(computeTotalPages(0, 20)).toBe(1);
    expect(computeTotalPages(21, 20)).toBe(2);
  });

  it("offsets page 1/2/3 son bloques distintos", () => {
    expect(pageOffset(1, 20)).toBe(0);
    expect(pageOffset(2, 20)).toBe(20);
    expect(pageOffset(3, 20)).toBe(40);
    expect(pageOffset(4, 20)).toBe(60);
  });

  it("no hay duplicados entre páginas simuladas", () => {
    const pages = [
      Array.from({ length: 20 }, (_, i) => ({ id: `r-${i}` })),
      Array.from({ length: 20 }, (_, i) => ({ id: `r-${i + 20}` })),
      Array.from({ length: 20 }, (_, i) => ({ id: `r-${i + 40}` })),
      Array.from({ length: 20 }, (_, i) => ({ id: `r-${i + 60}` })),
    ];
    const check = assertNoDuplicatesAcrossPages(pages);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.unique).toBe(80);
  });

  it("detecta duplicados entre páginas", () => {
    const check = assertNoDuplicatesAcrossPages([
      [{ id: "a" }, { id: "b" }],
      [{ id: "b" }, { id: "c" }],
    ]);
    expect(check.ok).toBe(false);
  });

  it("unión de páginas = total", () => {
    const total = 80;
    const pages = Math.ceil(total / RESULTS_PAGE_SIZE);
    let count = 0;
    for (let p = 1; p <= pages; p += 1) {
      const start = pageOffset(p);
      const end = Math.min(start + RESULTS_PAGE_SIZE, total);
      count += end - start;
    }
    expect(count).toBe(total);
  });

  it("anterior deshabilitado en página 1; siguiente en última", () => {
    expect(canGoPrevious(1)).toBe(false);
    expect(canGoPrevious(2)).toBe(true);
    expect(canGoNext(1, 80, 20)).toBe(true);
    expect(canGoNext(4, 80, 20)).toBe(false);
  });

  it("normaliza page inválida", () => {
    expect(normalizePage(0, 80, 20)).toBe(1);
    expect(normalizePage(-3, 80, 20)).toBe(1);
    expect(normalizePage(99, 80, 20)).toBe(4);
    expect(normalizePage(2.9, 80, 20)).toBe(2);
  });

  it("buildResultsListQuery conserva filtros y page", () => {
    const q = buildResultsListQuery({
      page: 2,
      search: "ana",
      riskLevel: "alto",
      campaignId: "11111111-1111-4111-8111-111111111111",
    });
    expect(q.get("page")).toBe("2");
    expect(q.get("pageSize")).toBe("20");
    expect(q.get("search")).toBe("ana");
    expect(q.get("riskLevel")).toBe("alto");
    expect(q.get("campaignId")).toBeTruthy();
  });

  it("cambio de filtro resetea page=1 en query builder al pedir page 1", () => {
    const q = buildResultsListQuery({ page: 1, riskLevel: "medio" });
    expect(q.get("page")).toBe("1");
    expect(q.get("riskLevel")).toBe("medio");
  });

  it("UI tiene controles Anterior/Siguiente y URL page", () => {
    const page = readFileSync("src/app/admin/resultados/page.tsx", "utf8");
    expect(page).toMatch(/results-page-prev/);
    expect(page).toMatch(/results-page-next/);
    expect(page).toMatch(/useSearchParams/);
    expect(page).toMatch(/replaceParams/);
    expect(page).toMatch(/resetPage:\s*true/);
  });

  it("API route expone totalPages", () => {
    const route = readFileSync("src/app/api/admin/nom035/results/route.ts", "utf8");
    expect(route).toMatch(/totalPages/);
    expect(route).toMatch(/RESULTS_PAGE_SIZE/);
  });

  it("RPC admin_list_results usa offset determinista", () => {
    const mig = readFileSync(
      "supabase/migrations/013_is_test_exclude_metrics.sql",
      "utf8"
    );
    expect(mig).toMatch(/admin_list_results/);
    expect(mig).toMatch(/offset \(v_page - 1\) \* v_size/);
    expect(mig).toMatch(/order by r\.completed_at desc nulls last, r\.id/);
    expect(mig).toMatch(/is_test/);
  });

  it("exports no dependen de page (rutas full/avance intactas)", () => {
    const full = readFileSync(
      "src/app/api/admin/nom035/reports/full/route.ts",
      "utf8"
    );
    const avance = readFileSync(
      "src/app/api/admin/nom035/campaigns/avance-excel/route.ts",
      "utf8"
    );
    expect(full).not.toMatch(/pageSize/);
    expect(avance).not.toMatch(/p_page/);
  });
});
