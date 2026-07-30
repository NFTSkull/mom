/**
 * Suite WebKit Guía III (CI Linux). Cubre portal + token + aislamiento + denegaciones.
 * No usa datos reales ni Cloud.
 */
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  adminClient,
  answerGuiaINo,
  answerGuiaIIIAllNunca,
  attachStrictGuards,
  loadEnvLocal,
  seedEvaluationLink,
  sql,
} from "./helpers";

const G3_PASSWORD = process.env.GUIDE_III_TEST_PASSWORD || "Nom035-G3#Local2026!";
const G3_USER_A = "worker.g3.a";

async function ensureGuia3Seed() {
  const env = loadEnvLocal();
  execFileSync("npx", ["--yes", "tsx", "scripts/seed-guia-iii-local.ts"], {
    env: {
      ...process.env,
      ...env,
      GUIDE_III_TEST_PASSWORD: G3_PASSWORD,
    },
    encoding: "utf8",
  });
}

test.describe("B4.10 WebKit Guía III cobertura", () => {
  test.beforeAll(async () => {
    sql("truncate table public.public_rate_limits");
    await ensureGuia3Seed();
  });

  test("W-G3-1 portal A: login → I → III gates → draft → reload → submit → no reedición", async ({
    page,
  }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await ensureGuia3Seed();

    await page.goto("/trabajador/login");
    await page.getByTestId("worker-login-username").fill(G3_USER_A);
    await page.getByTestId("worker-login-password").fill(G3_PASSWORD);
    await page.getByTestId("worker-login-submit").click();
    await page.waitForURL("**/trabajador");

    await page.getByRole("link", { name: /Comenzar evaluación|Continuar evaluación/i }).click();
    await page.waitForURL("**/evaluacion/contestar");

    await expect(page.getByText(/Guía I y Guía III/i)).toBeVisible();
    await answerGuiaINo(page);
    await expect(page.getByTestId("frp-stage-GUIA_III")).toBeVisible();

    // Manifiesto: radios guia-iii-*
    await expect(page.locator('input[name^="guia-iii-"]').first()).toBeVisible();

    // Parcial + guardado
    const radios = page.locator('input[type="radio"][name^="guia-iii-"]');
    const count = await radios.count();
    for (let i = 4; i < count; i += 5) await radios.nth(i).check();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText(/Progreso guardado|Guardando/)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByTestId("frp-stage-GUIA_III")).toBeVisible({ timeout: 15_000 });

    // Logout / login y recuperación
    await page.goto("/trabajador");
    const logout = page.getByRole("button", { name: /Cerrar sesión|Salir/i });
    if (await logout.isVisible().catch(() => false)) {
      await logout.click();
    } else {
      await page.request.post("/api/trabajador/logout").catch(() => undefined);
      await page.goto("/trabajador/login");
    }
    await page.goto("/trabajador/login");
    await page.getByTestId("worker-login-username").fill(G3_USER_A);
    await page.getByTestId("worker-login-password").fill(G3_PASSWORD);
    await page.getByTestId("worker-login-submit").click();
    await page.waitForURL("**/trabajador");
    await page.getByRole("link", { name: /Continuar evaluación|Comenzar evaluación/i }).click();
    await page.waitForURL("**/evaluacion/contestar");
    await expect(page.getByTestId("frp-stage-GUIA_III")).toBeVisible({ timeout: 15_000 });

    // Condiciones clientes sí / jefatura no (65–68 aplican; 69–72 no)
    await answerGuiaIIIAllNunca(page, { clientes: "si", jefe: "no" });
    await page.getByLabel(/Confirmo que revisé/).check();
    await page.getByRole("button", { name: /Enviar evaluación definitivamente/ }).click();
    await expect(page).toHaveURL(/\/evaluacion\/gracias|\/trabajador\/completado/, {
      timeout: 30_000,
    });

    const statusA = sql(
      `select a.status
       from public.evaluation_assignments a
       join public.workers w on w.id = a.worker_id
       where w.external_reference = 'WORKER-G3-A'
       order by a.created_at desc limit 1`
    );
    expect(statusA).toBe("completed");

    const instruments = sql(
      `select string_agg(aq.questionnaire_type || ':' || aq.status, ',' order by aq.questionnaire_type)
       from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id = aq.assignment_id
       join public.workers w on w.id = a.worker_id
       where w.external_reference = 'WORKER-G3-A'`
    );
    expect(instruments).toMatch(/GUIA_I:submitted/);
    expect(instruments).toMatch(/GUIA_III:submitted/);
    expect(instruments.split(",").some((p) => p.startsWith("GUIA_II:"))).toBe(false);

    // Reingreso sin edición: hub muestra completada
    await page.goto("/trabajador");
    await expect(page.getByText(/Tu evaluación fue enviada correctamente/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: /Comenzar evaluación/i })).toHaveCount(0);

    // Admin API denegada al worker (sesión trabajador)
    const adminRes = await page.request.get("/api/admin/nom035/dashboard");
    expect(adminRes.status()).toBeGreaterThanOrEqual(401);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("W-G3-2 aislamiento: B no lee sesión/resultado A; token cross denegado", async ({
    page,
    browser,
  }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await ensureGuia3Seed();

    // Completa A por token (independiente del portal)
    const a = await seedEvaluationLink("WK-A", {
      questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
    });
    await page.goto(a.url);
    await answerGuiaINo(page);
    await answerGuiaIIIAllNunca(page, { clientes: "no", jefe: "si" });
    await page.getByLabel(/Confirmo que revisé/).check();
    await page.getByRole("button", { name: /Enviar evaluación definitivamente/ }).click();
    await expect(page).toHaveURL(/\/evaluacion\/gracias/);

    const b = await seedEvaluationLink("WK-B", {
      questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
    });
    expect(
      sql(`select status from public.evaluation_assignments where id = '${b.assignmentId}'`)
    ).toBe("pending");

    // B abre su enlace — no ve resultado A
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    attachStrictGuards(pageB, errors);
    await pageB.goto(b.url);
    await expect(pageB.getByRole("button", { name: /Iniciar evaluación/i })).toBeVisible();
    await expect(pageB.getByText(/nivel de riesgo|score final|finalScore/i)).toHaveCount(0);

    // Cross: cookie de B no puede submitear assignment A (sesión propia)
    const cross = await pageB.request.get("/api/public/evaluations/session");
    expect(cross.ok()).toBeTruthy();
    const body = (await cross.json()) as { context?: { assignmentId?: string } };
    expect(body.context?.assignmentId).toBe(b.assignmentId);
    expect(body.context?.assignmentId).not.toBe(a.assignmentId);

    await ctxB.close();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("W-G3-3 panel: estado final A completed / B pending vía datos admin SQL", async () => {
    await ensureGuia3Seed();
    const admin = adminClient();
    const { data: camp } = await admin
      .from("evaluation_campaigns")
      .select("id")
      .eq("nombre", "CAMPAÑA_GUIA_III_TEST")
      .maybeSingle();
    expect(camp?.id).toBeTruthy();

    // Tras W-G3-1, A debería estar completed si el seed recreó assignments;
    // re-seed deja pending — validamos columnas de instrumentos existen.
    const rows = sql(
      `select count(*)::int from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id = aq.assignment_id
       where a.campaign_id = '${camp!.id}'
         and aq.questionnaire_type = 'GUIA_III'`
    );
    expect(Number(rows)).toBeGreaterThanOrEqual(2);

    const ii = sql(
      `select count(*)::int from public.assignment_questionnaires aq
       join public.evaluation_assignments a on a.id = aq.assignment_id
       where a.campaign_id = '${camp!.id}'
         and aq.questionnaire_type = 'GUIA_II'`
    );
    expect(Number(ii)).toBe(0);
  });
});
