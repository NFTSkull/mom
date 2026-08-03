import { defineConfig, devices } from "@playwright/test";

/**
 * E2E B4.3 — Chromium real contra Next + Supabase local.
 * Capturas/traces solo en fallo. Fallar ante console.error/pageerror/500
 * se configura en cada test.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "es-MX",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      testMatch: /worker-portal\.spec\.ts|guia-iii-evaluation\.spec\.ts/,
      grep: /W1\.|W2-W4|I→III draft/,
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "firefox-smoke",
      testMatch: /worker-portal\.spec\.ts/,
      grep: /W1\./,
      use: { ...devices["Desktop Firefox"] },
    },
    // WebKit solo con flag explícito (workflow Guía III WebKit).
    // No incluirlo en RC Quality: ese job instala chromium+firefox, no WebKit.
    ...(process.env.PLAYWRIGHT_WEBKIT_GUIA3 === "1"
      ? [
          {
            name: "webkit-guia3",
            testMatch: /guia-iii-webkit\.spec\.ts|guia-iii-evaluation\.spec\.ts/,
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
