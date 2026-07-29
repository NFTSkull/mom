import { expect, test } from "@playwright/test";
import { attachStrictGuards, loginAsRole, loadStagingAuthCredentials } from "./helpers";

test.describe("B4.7 staging · Auth MFA roles", () => {
  test("login inválido mensaje genérico", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await page.goto("/login");
    await page.getByLabel("Correo").fill("noexiste@nom035.staging.local");
    await page.getByLabel("Contraseña").fill("WrongPass!12345");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText(/Correo o contraseña incorrectos/i)).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("login admin + MFA AAL2", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "admin");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    const me = await page.request.get("/api/auth/me");
    const meJson = await me.json();
    expect(meJson.ok).toBe(true);
    expect(meJson.user.aal).toBe("aal2");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("RH sin detalle individual ni quejas", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "rh");
    const results = await page.request.get("/api/admin/nom035/results");
    expect([200, 403]).toContain(results.status());
    if (results.ok()) {
      const body = await results.json();
      const firstId = body?.results?.[0]?.id ?? body?.items?.[0]?.id;
      if (firstId) {
        const detail = await page.request.get(`/api/admin/nom035/results/${firstId}`);
        expect([403, 404]).toContain(detail.status());
      }
    }
    const complaints = await page.request.get("/api/admin/nom035/complaints");
    expect([403, 401]).toContain(complaints.status());
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("psicólogo sin users.manage", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "psicologo");
    const users = await page.request.get("/api/admin/nom035/users");
    expect([403, 401]).toContain(users.status());
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("dirección no muta trabajadores", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "direccion");
    const create = await page.request.post("/api/admin/nom035/workers", {
      data: { nombre: "STAGING_TEST NoDebeCrear" },
    });
    expect([403, 401, 405]).toContain(create.status());
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("logout cierra sesión", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "admin");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    const me = await page.request.get("/api/auth/me");
    expect([401, 403]).toContain(me.status());
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("credenciales staging presentes para 4 roles", async () => {
    const users = loadStagingAuthCredentials();
    expect(users.map((u) => u.role).sort()).toEqual(
      ["admin", "direccion", "psicologo", "rh"].sort()
    );
    for (const u of users) {
      expect(u.email).toMatch(/@nom035\.staging\.local$/);
      expect(u.totpSecret.length).toBeGreaterThan(10);
    }
  });
});
