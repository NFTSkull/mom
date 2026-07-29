import { defineConfig, devices } from "@playwright/test";

/**
 * E2E remoto B4.7 — apunta a Vercel Preview + Supabase staging.
 * NO inicia Next ni Supabase locales.
 * Requiere PLAYWRIGHT_BASE_URL (HTTPS Preview) y credenciales en .tmp (ignorado).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!baseURL || !/^https:\/\//i.test(baseURL)) {
  // Config se evalúa al cargar; el error evita apuntar a local por accidente.
  console.warn(
    "[playwright.staging] PLAYWRIGHT_BASE_URL debe ser HTTPS Preview. No ejecutar sin URL remota."
  );
}

/**
 * WebKit en macOS 14 arm64 (Playwright frozen) falla con
 * `Page.overrideSetting: Unknown setting: PushAPIEnabled`.
 * Solo se habilita con FORCE_STAGING_WEBKIT=1 o fuera de darwin.
 */
const webkitCompatible =
  process.env.FORCE_STAGING_WEBKIT === "1" || process.platform !== "darwin";

export default defineConfig({
  testDir: "./e2e-staging",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: baseURL ?? "https://invalid.example.invalid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "es-MX",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
    ...(webkitCompatible
      ? [
          {
            name: "webkit-public",
            use: { ...devices["Desktop Safari"] },
            testMatch: /public-evaluation|smoke|security/,
          },
        ]
      : []),
    {
      name: "firefox-smoke",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /smoke|security/,
    },
  ],
  // Sin webServer: el target es remoto.
});
