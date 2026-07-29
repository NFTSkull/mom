/**
 * Helpers E2E staging remoto (Vercel Preview + Supabase Cloud).
 * No usa psql local. Credenciales solo desde .tmp ignorado.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

export function loadStagingEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.staging.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  } catch {
    // ignore
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

export function stagingAdmin(): SupabaseClient {
  const env = loadStagingEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta .env.staging.local");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co/i.test(url)) {
    throw new Error("E2E staging solo contra Supabase Cloud staging");
  }
  if (/prod|production|concasa/i.test(url)) throw new Error("URL prohibida");
  class NoopRealtimeTransport {}
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopRealtimeTransport as never },
  } as never);
}

export interface SeededLink {
  token: string;
  assignmentId: string;
  workerId: string;
  campaignId: string;
  url: string;
}

export async function seedEvaluationLink(label = "E2E"): Promise<SeededLink> {
  const env = loadStagingEnv();
  const admin = stagingAdmin();
  const pepper = env.NOM035_TOKEN_PEPPER;
  const appUrl = process.env.PLAYWRIGHT_BASE_URL || env.NEXT_PUBLIC_APP_URL;
  if (!pepper || !appUrl) throw new Error("Falta pepper o APP/BASE URL staging");

  const workerId = randomUUID();
  const campaignId = randomUUID();
  await admin.from("workers").insert({
    id: workerId,
    nombre: `STAGING_TEST Trabajador ${label} ${workerId.slice(0, 8)}`,
    activo: true,
  });
  await admin
    .from("evaluation_campaigns")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active")
    .like("nombre", "STAGING_TEST%");

  await admin.from("evaluation_campaigns").insert({
    id: campaignId,
    nombre: `STAGING_TEST Campaña ${label} ${campaignId.slice(0, 8)}`,
    status: "active",
    activated_at: new Date().toISOString(),
    fecha_inicio: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    fecha_cierre: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });

  const token = `ev_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHmac("sha256", pepper).update(token, "utf8").digest("hex");
  const created = await admin.rpc("create_public_evaluation_assignment", {
    p_campaign_id: campaignId,
    p_worker_id: workerId,
    p_token_hash: tokenHash,
    p_token_last4: token.slice(-4),
    p_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    p_questionnaire_version: "nom035-stps-2018-guias-referencia-i-ii",
  });
  if (!created.data?.ok) throw new Error(`seed staging falló: ${JSON.stringify(created)}`);

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
  await stagingAdmin()
    .from("evaluation_assignments")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", seeded.assignmentId);
  return seeded;
}

export function attachStrictGuards(page: Page, errors: string[]): void {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource:.*status of 4\d\d/i.test(text)) return;
    if (/vercel\.live/i.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  page.on("pageerror", (err) => {
    const message = err.message || "";
    // WebKit/Safari reporta fallos de prefetch RSC como pageerror (access control / Load failed)
    // sin HTTP 500. No oculta fallos de aplicación: los 500 siguen fallando el test.
    if (
      /due to access control checks/i.test(message) &&
      /[?&]_rsc=/i.test(message)
    ) {
      return;
    }
    if (/^TypeError: Load failed$/i.test(message.trim())) {
      return;
    }
    errors.push(`pageerror: ${message}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 500) errors.push(`HTTP ${res.status()} ${res.url()}`);
  });
}

export async function answerGuiaINo(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Iniciar evaluación" }).click();
  const first = page.locator("fieldset").first();
  await first.getByLabel("No", { exact: true }).check();
  await page.getByRole("button", { name: "Continuar a Guía II" }).click();
}

export async function answerGuiaIIAllNunca(
  page: Page,
  gates: { clientes: "si" | "no"; jefe: "si" | "no" } = { clientes: "no", jefe: "no" }
): Promise<void> {
  async function answerVisibleNunca(): Promise<void> {
    const radios = page.locator('input[type="radio"][name^="guia-ii-"]');
    const count = await radios.count();
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

export async function confirmAndSubmit(page: Page): Promise<void> {
  await page.getByLabel(/Confirmo que revisé/).check();
  await page.getByRole("button", { name: "Enviar evaluación definitivamente" }).click();
  await page.waitForURL("**/evaluacion/gracias");
}

export type StagingCredUser = {
  email: string;
  password: string;
  role: string;
  totpSecret: string;
};

export function loadStagingAuthCredentials(): StagingCredUser[] {
  const path = ".tmp/staging-auth-credentials.json";
  if (!existsSync(path)) {
    throw new Error("Falta .tmp/staging-auth-credentials.json — npm run staging:seed:auth");
  }
  return (JSON.parse(readFileSync(path, "utf8")) as { users: StagingCredUser[] }).users;
}

export function totpNow(secret: string): string {
  return new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  }).generate();
}

export async function loginAsRole(page: Page, role: string): Promise<StagingCredUser> {
  const user = loadStagingAuthCredentials().find((u) => u.role === role);
  if (!user) throw new Error(`No hay credenciales staging para rol ${role}`);

  await page.goto("/login");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  try {
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
  } catch {
    const body = await page.textContent("body");
    throw new Error(`loginAsRole staging falló para ${role}. UI: ${body?.slice(0, 200)}`);
  }

  if (page.url().includes("/admin/seguridad/mfa")) {
    const status = await page.request.get("/api/auth/mfa/status");
    const statusJson = (await status.json()) as { factors?: Array<{ id: string }> };
    const factorId = statusJson.factors?.[0]?.id;
    if (!factorId) throw new Error("Sin factor MFA staging");
    for (let attempt = 0; attempt < 3; attempt++) {
      const ch = await page.request.post("/api/auth/mfa/challenge", {
        data: { factorId },
      });
      const chJson = (await ch.json()) as { challengeId?: string; code?: string };
      if (chJson.code === "rate_limited") {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const verified = await page.request.post("/api/auth/mfa/verify", {
        data: {
          factorId,
          challengeId: chJson.challengeId,
          code: totpNow(user.totpSecret),
        },
      });
      const vJson = (await verified.json()) as { ok?: boolean; next?: string };
      if (vJson.ok) {
        await page.goto(vJson.next ?? "/admin");
        break;
      }
      await new Promise((r) => setTimeout(r, 31_000));
    }
  }
  return user;
}
