import { expect, test } from "@playwright/test";

/**
 * Smoke remoto mínimo. La suite completa se habilita tras Preview + Auth staging.
 * No imprime secretos. Requiere PLAYWRIGHT_BASE_URL HTTPS.
 */
test.describe("B4.7 staging smoke", () => {
  test.beforeAll(() => {
    const url = process.env.PLAYWRIGHT_BASE_URL ?? "";
    if (!/^https:\/\//i.test(url)) {
      throw new Error("PLAYWRIGHT_BASE_URL HTTPS requerido para e2e-staging");
    }
  });

  test("health live responde", async ({ request }) => {
    const res = await request.get("/api/health/live");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("live");
    expect(typeof body.requestId).toBe("string");
  });

  test("admin sin sesión redirige a login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("API admin sin Auth → 401", async ({ request }) => {
    const res = await request.get("/api/admin/nom035/dashboard");
    expect(res.status()).toBe(401);
  });
});
