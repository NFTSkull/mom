import { expect, test } from "@playwright/test";

test.describe("B4.7 staging · seguridad remota básica", () => {
  test("health live/ready", async ({ request }) => {
    const live = await request.get("/api/health/live");
    expect(live.status()).toBe(200);
    const ready = await request.get("/api/health/ready");
    expect(ready.status()).toBe(200);
    const body = await ready.json();
    expect(body.ok).toBe(true);
  });

  test("admin API sin sesión 401 y /admin redirige", async ({ page, request }) => {
    expect((await request.get("/api/admin/nom035/dashboard")).status()).toBe(401);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("headers framing en rutas clave", async ({ request }) => {
    for (const path of ["/", "/login", "/evaluacion/contestar", "/queja-confidencial"]) {
      const res = await request.get(path);
      const csp = res.headers()["content-security-policy"] ?? "";
      const xfo = res.headers()["x-frame-options"] ?? "";
      const hasFrame =
        /frame-ancestors\s+'none'/i.test(csp) || /^deny$/i.test(xfo);
      expect(hasFrame, `${path} sin protección framing`).toBeTruthy();
    }
  });
});
