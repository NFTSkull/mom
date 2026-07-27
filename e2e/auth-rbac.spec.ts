import { expect, test } from "@playwright/test";
import {
  attachStrictGuards,
  loginAsRole,
  loadAuthTestCredentials,
  sql,
  totpNow,
} from "./helpers";

test.describe("B4.6 Auth RBAC MFA", () => {
  test.beforeAll(() => {
    // Evitar 429 residuales de suites anteriores sobre el mismo admin.
    sql("truncate public.public_rate_limits");
  });

  test("1. Sin sesión /admin redirige y API 401", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    const res = await page.request.get("/api/admin/nom035/dashboard");
    expect(res.status()).toBe(401);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("2. Login inválido mensaje genérico", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await page.goto("/login");
    await page.getByLabel("Correo").fill("noexiste@nom035.local");
    await page.getByLabel("Contraseña").fill("WrongPass!12345");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText(/Correo o contraseña incorrectos/i)).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("3-5. Login válido + MFA AAL2", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "admin");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    const me = await page.request.get("/api/auth/me");
    const meJson = await me.json();
    expect(meJson.ok).toBe(true);
    expect(meJson.user.aal).toBe("aal2");
    const storage = await page.evaluate(() => ({
      ls: Object.keys(localStorage),
      url: location.href,
    }));
    expect(storage.ls.join(",")).not.toMatch(/access_token|refresh_token/i);
    expect(storage.url).not.toMatch(/access_token|refresh_token/);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("7. RH no abre individual ni quejas", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "rh");
    const results = await page.request.get("/api/admin/nom035/results/11111111-1111-4111-8111-111111111111");
    expect([403, 404]).toContain(results.status());
    const complaints = await page.request.get("/api/admin/nom035/complaints");
    expect(complaints.status()).toBe(403);
    await page.goto("/admin/quejas");
    // UI puede redirigir o mostrar vacío institucional
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("8. Psicólogo no administra usuarios", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "psicologo");
    const users = await page.request.get("/api/admin/nom035/users");
    expect(users.status()).toBe(403);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("9. Dirección no muta", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "direccion");
    const res = await page.request.post("/api/admin/nom035/workers", {
      headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3000" },
      data: { nombre: "No permitido" },
    });
    expect(res.status()).toBe(403);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("11. Perfil inactivo pierde acceso", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const victimCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const victimPage = await victimCtx.newPage();
    const errors: string[] = [];
    attachStrictGuards(adminPage, errors);
    attachStrictGuards(victimPage, errors);

    await loginAsRole(victimPage, "direccion");
    const users = loadAuthTestCredentials();
    const victim = users.find((u) => u.role === "direccion")!;
    const victimId = sql(
      `select id from public.admin_profiles where email = '${victim.email}'`
    );

    await loginAsRole(adminPage, "admin");
    const deact = await adminPage.request.post(
      `/api/admin/nom035/users/${victimId}/deactivate`,
      { headers: { Origin: "http://127.0.0.1:3000" } }
    );
    expect(deact.status()).toBe(200);

    const next = await victimPage.request.get("/api/admin/nom035/dashboard");
    expect(next.status()).toBe(403);
    const body = await next.json();
    expect(body.code).toMatch(/account_disabled|forbidden|unauthorized/);

    // Reactivar para no romper otras pruebas
    await adminPage.request.post(`/api/admin/nom035/users/${victimId}/reactivate`, {
      headers: { Origin: "http://127.0.0.1:3000" },
    });

    expect(errors, errors.join("\n")).toEqual([]);
    await adminCtx.close();
    await victimCtx.close();
  });

  test("13. Último admin protegido", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "admin");
    const adminId = sql(
      `select id from public.admin_profiles where email='admin@nom035.local'`
    );
    // Desactivar otros admins si existen
    sql(
      `update public.admin_profiles set active=false
       where role='admin' and email <> 'admin@nom035.local'`
    );
    const res = await page.request.post(`/api/admin/nom035/users/${adminId}/deactivate`, {
      headers: { Origin: "http://127.0.0.1:3000" },
    });
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("last_admin_protected");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("14. Logout cierra sesión", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await loginAsRole(page, "admin");
    await page.request.post("/api/auth/logout");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("18. Origin externo rechazado", async ({ page }) => {
    await loginAsRole(page, "admin");
    const res = await page.request.post("http://127.0.0.1:3000/api/admin/nom035/workers", {
      headers: { Origin: "https://evil.example.com", "Content-Type": "application/json" },
      data: { nombre: "X" },
    });
    expect(res.status()).toBe(403);
  });

  test("22. Flujo público sin login", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await page.goto("/queja-confidencial");
    await expect(page.getByTestId("queja-submit")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

void totpNow;
