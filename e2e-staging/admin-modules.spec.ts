import { expect, test } from "@playwright/test";
import { attachStrictGuards, loginAsRole } from "./helpers";

test.describe("B4.7 staging · módulos admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, "admin");
  });

  test("dashboard / configuración / trabajadores / campañas / resultados", async ({
    page,
  }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/configuracion");
    await expect(page.locator("body")).toContainText(/empresa|configuración|razón/i);

    await page.goto("/admin/trabajadores");
    await expect(page.locator("body")).toContainText(/trabajador/i);

    await page.goto("/admin/campanas");
    await expect(page.locator("body")).toContainText(/campaña/i);

    await page.goto("/admin/resultados");
    await expect(page.locator("body")).toContainText(/resultado/i);

    await page.goto("/admin/reportes");
    await expect(page.locator("body")).toContainText(/reporte|resumen|riesgo/i);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("plan / evidencias / quejas / política / auditoría", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);

    await page.goto("/admin/plan-accion");
    await expect(page.getByTestId("plan-accion-page")).toBeVisible();

    await page.goto("/admin/evidencias");
    await expect(page.getByTestId("evidencias-page")).toBeVisible();

    await page.goto("/admin/quejas");
    await expect(page.locator("h1, h2").filter({ hasText: /queja/i }).first()).toBeVisible();

    await page.goto("/admin/politica");
    await expect(page.locator("h1, h2").filter({ hasText: /pol[ií]tica/i }).first()).toBeVisible();

    await page.goto("/admin/auditoria");
    await expect(page.locator("h1, h2").filter({ hasText: /auditor/i }).first()).toBeVisible();

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
