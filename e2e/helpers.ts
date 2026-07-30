import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

export function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    // ignore
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

export function adminClient(): SupabaseClient {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta .env.local de Supabase local");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url)) {
    throw new Error("E2E solo contra Supabase local");
  }
  const options: { auth: object; realtime?: { transport: new () => unknown } } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: class {} as never };
  }
  return createClient(url, secret, options as never);
}

export function sql(query: string): string {
  return execFileSync(
    "psql",
    ["postgresql://postgres:postgres@127.0.0.1:55322/postgres", "-At", "-c", query],
    { encoding: "utf8" }
  ).trim();
}

export interface SeededLink {
  token: string;
  assignmentId: string;
  workerId: string;
  campaignId: string;
  url: string;
}

export async function seedEvaluationLink(
  label = "E2E",
  options?: { questionnaireVersion?: string }
): Promise<SeededLink> {
  const env = loadEnvLocal();
  const admin = adminClient();
  const pepper = env.NOM035_TOKEN_PEPPER;
  const appUrl = env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
  const questionnaireVersion =
    options?.questionnaireVersion ?? "nom035-stps-2018-guias-referencia-i-ii";

  const workerId = randomUUID();
  const campaignId = randomUUID();
  await admin.from("workers").insert({
    id: workerId,
    nombre: `Trabajador ${label} ${workerId.slice(0, 8)}`,
    activo: true,
  });
  // B4.4: solo una campaña active. Cerrar previas antes de sembrar.
  sql(
    `update public.evaluation_campaigns
     set status = 'closed', closed_at = coalesce(closed_at, timezone('utc', now()))
     where status = 'active'`
  );
  await admin.from("evaluation_campaigns").insert({
    id: campaignId,
    nombre: `Campaña ${label} ${campaignId.slice(0, 8)}`,
    status: "active",
    activated_at: new Date().toISOString(),
    fecha_inicio: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    fecha_cierre: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    questionnaire_version: questionnaireVersion,
  });

  const token = `ev_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHmac("sha256", pepper).update(token, "utf8").digest("hex");
  const created = await admin.rpc("create_public_evaluation_assignment", {
    p_campaign_id: campaignId,
    p_worker_id: workerId,
    p_token_hash: tokenHash,
    p_token_last4: token.slice(-4),
    p_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    p_questionnaire_version: questionnaireVersion,
  });
  if (!created.data?.ok) throw new Error(`seed falló: ${JSON.stringify(created)}`);

  return {
    token,
    assignmentId: created.data.assignmentId as string,
    workerId,
    campaignId,
    url: `${appUrl}/evaluacion/${token}`,
  };
}

export async function seedExpiredLink(): Promise<SeededLink> {
  const seeded = await seedEvaluationLink("EXPIRED");
  // Fuerza expires_at al pasado vía SQL (postgres bypass).
  sql(
    `update public.evaluation_assignments set expires_at = now() - interval '1 minute' where id = '${seeded.assignmentId}'`
  );
  return seeded;
}

/** Attaches listeners that fail the test on pageerror / HTTP 500.
 * Los console.error de recursos 4xx esperados (enlace inválido/completado) se ignoran. */
export function attachStrictGuards(page: Page, errors: string[]): void {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource:.*status of 4\d\d/i.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 500) errors.push(`HTTP ${res.status()} ${res.url()}`);
  });
}

export async function answerGuiaINo(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Iniciar evaluación" }).click();
  // Sección I = No
  const first = page.locator("fieldset").first();
  await first.getByLabel("No", { exact: true }).check();
  await page.getByRole("button", { name: /Continuar a Guía (II|III)/ }).click();
}

export async function answerGuiaIIAllNunca(
  page: Page,
  gates: { clientes: "si" | "no"; jefe: "si" | "no" } = { clientes: "no", jefe: "no" }
): Promise<void> {
  async function answerVisibleNunca(): Promise<void> {
    const radios = page.locator('input[type="radio"][name^="guia-ii-"]');
    const count = await radios.count();
    // Marca "Nunca" (último de cada grupo de 5).
    for (let i = 4; i < count; i += 5) {
      await radios.nth(i).check();
    }
  }

  for (let block = 0; block < 6; block++) {
    if (block === 4) {
      await page.locator('input[name="gate-clientes"]').nth(gates.clientes === "si" ? 0 : 1).check();
      if (gates.clientes === "si") {
        await page.waitForSelector('input[name^="guia-ii-"]');
        await answerVisibleNunca();
      }
    } else if (block === 5) {
      await page.locator('input[name="gate-jefe"]').nth(gates.jefe === "si" ? 0 : 1).check();
      if (gates.jefe === "si") {
        await page.waitForSelector('input[name^="guia-ii-"]');
        await answerVisibleNunca();
      }
    } else {
      await page.waitForSelector('input[name^="guia-ii-"]');
      await answerVisibleNunca();
    }

    if (block < 5) {
      await page.getByRole("button", { name: "Siguiente" }).click();
    } else {
      await page.getByRole("button", { name: "Finalizar bloque y revisar" }).click();
    }
  }
}

/** Guía III: bloques dinámicos (core + 2 compuertas). */
export async function answerGuiaIIIAllNunca(
  page: Page,
  gates: { clientes: "si" | "no"; jefe: "si" | "no" } = { clientes: "no", jefe: "no" }
): Promise<void> {
  async function answerVisibleNunca(): Promise<void> {
    const radios = page.locator('input[type="radio"][name^="guia-iii-"]');
    const count = await radios.count();
    for (let i = 4; i < count; i += 5) {
      await radios.nth(i).check();
    }
  }

  // Máximo de seguridad; sale al encontrar Finalizar.
  for (let block = 0; block < 20; block++) {
    const gateClientes = page.locator('input[name="gate-clientes"]');
    const gateJefe = page.locator('input[name="gate-jefe"]');
    if ((await gateClientes.count()) > 0) {
      await gateClientes.nth(gates.clientes === "si" ? 0 : 1).check();
      if (gates.clientes === "si") {
        await page.waitForSelector('input[name^="guia-iii-"]');
        await answerVisibleNunca();
      }
    } else if ((await gateJefe.count()) > 0) {
      await gateJefe.nth(gates.jefe === "si" ? 0 : 1).check();
      if (gates.jefe === "si") {
        await page.waitForSelector('input[name^="guia-iii-"]');
        await answerVisibleNunca();
      }
    } else {
      await page.waitForSelector('input[name^="guia-iii-"]');
      await answerVisibleNunca();
    }

    const finish = page.getByRole("button", { name: "Finalizar bloque y revisar" });
    if (await finish.isVisible()) {
      await finish.click();
      return;
    }
    await page.getByRole("button", { name: "Siguiente" }).click();
  }
  throw new Error("Guía III: no se alcanzó Finalizar");
}

export async function completeGuiaIIFromCurrent(
  page: Page,
  gates: { clientes: "si" | "no"; jefe: "si" | "no" } = { clientes: "no", jefe: "no" }
): Promise<void> {
  for (let safety = 0; safety < 8; safety++) {
    if (await page.getByRole("heading", { name: "Revisar respuestas" }).isVisible().catch(() => false)) {
      return;
    }
    const gateC = page.locator('input[name="gate-clientes"]');
    const gateJ = page.locator('input[name="gate-jefe"]');
    if (await gateC.count()) {
      await gateC.nth(gates.clientes === "si" ? 0 : 1).check();
      if (gates.clientes === "si") {
        await page.waitForSelector('input[name^="guia-ii-"]');
        const r = page.locator('input[type="radio"][name^="guia-ii-"]');
        const n = await r.count();
        for (let i = 4; i < n; i += 5) await r.nth(i).check();
      }
    } else if (await gateJ.count()) {
      await gateJ.nth(gates.jefe === "si" ? 0 : 1).check();
      if (gates.jefe === "si") {
        await page.waitForSelector('input[name^="guia-ii-"]');
        const r = page.locator('input[type="radio"][name^="guia-ii-"]');
        const n = await r.count();
        for (let i = 4; i < n; i += 5) await r.nth(i).check();
      }
    } else if (await page.locator('input[name^="guia-ii-"]').count()) {
      const r = page.locator('input[type="radio"][name^="guia-ii-"]');
      const n = await r.count();
      for (let i = 4; i < n; i += 5) await r.nth(i).check();
    }

    if (await page.getByRole("button", { name: "Finalizar bloque y revisar" }).isVisible()) {
      await page.getByRole("button", { name: "Finalizar bloque y revisar" }).click();
      await expectReview(page);
      return;
    }
    await page.getByRole("button", { name: "Siguiente" }).click();
  }
  throw new Error("No se pudo completar Guía II desde la posición actual");
}

async function expectReview(page: Page): Promise<void> {
  await page.getByRole("heading", { name: "Revisar respuestas" }).waitFor({ timeout: 15_000 });
}

export async function confirmAndSubmit(page: Page): Promise<void> {
  await page.getByLabel(/Confirmo que revisé/).check();
  await page.getByRole("button", { name: "Enviar evaluación definitivamente" }).click();
  await page.waitForURL("**/evaluacion/gracias");
}

export type TestCredUser = {
  email: string;
  password: string;
  role: string;
  totpSecret: string;
};

export function loadAuthTestCredentials(): TestCredUser[] {
  const path = ".tmp/auth-test-credentials.json";
  if (!existsSync(path)) {
    throw new Error("Falta .tmp/auth-test-credentials.json — ejecute npm run auth:seed:test");
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as { users: TestCredUser[] };
  return raw.users;
}

export function totpNow(secret: string): string {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.generate();
}

async function waitNextTotpWindow(): Promise<void> {
  const ms = 30_000 - (Date.now() % 30_000) + 250;
  await new Promise((r) => setTimeout(r, ms));
}

/** Login + MFA verify para un rol sintético. Deja cookies de sesión en el page. */
export async function loginAsRole(page: Page, role: string): Promise<TestCredUser> {
  const users = loadAuthTestCredentials();
  const user = users.find((u) => u.role === role);
  if (!user) throw new Error(`No hay credenciales para rol ${role}`);

  await page.goto("/login");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  // Esperar redirección o mensaje de error (p.ej. rate limit)
  try {
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
  } catch {
    const body = await page.textContent("body");
    throw new Error(`loginAsRole falló para ${role}. UI: ${body?.slice(0, 200)}`);
  }
  if (page.url().includes("/admin/seguridad/mfa")) {
    const status = await page.request.get("/api/auth/mfa/status");
    const statusJson = await status.json();
    const factorId = statusJson.factors?.[0]?.id as string | undefined;
    if (!factorId) throw new Error("Sin factor MFA tras login");

    let lastErr = "verify MFA falló";
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await waitNextTotpWindow();
      const ch = await page.request.post("/api/auth/mfa/challenge", {
        data: { factorId },
      });
      const chJson = await ch.json();
      if (!chJson.ok) {
        lastErr = `challenge MFA falló: ${chJson.code ?? ch.status()}`;
        continue;
      }
      const verify = await page.request.post("/api/auth/mfa/verify", {
        data: {
          factorId,
          challengeId: chJson.challengeId,
          code: totpNow(user.totpSecret),
        },
      });
      const vJson = await verify.json();
      if (vJson.ok) {
        await page.goto(vJson.next ?? "/admin");
        return user;
      }
      lastErr = `verify MFA falló: ${vJson.code ?? verify.status()}`;
      // Código reutilizado en la misma ventana TOTP → esperar siguiente periodo
      if (vJson.code === "rate_limited") {
        sql("truncate public.public_rate_limits");
      }
    }
    throw new Error(lastErr);
  }
  return user;
}
