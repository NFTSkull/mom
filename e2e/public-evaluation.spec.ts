import { expect, test } from "@playwright/test";
import {
  answerGuiaINo,
  answerGuiaIIAllNunca,
  attachStrictGuards,
  completeGuiaIIFromCurrent,
  confirmAndSubmit,
  seedEvaluationLink,
  seedExpiredLink,
  sql,
} from "./helpers";

test.beforeAll(() => {
  // Limpia ventanas de rate limit locales para no contaminar la suite E2E.
  sql("truncate table public.public_rate_limits");
});

test("1. Flujo completo escritorio + verificación DB", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const seeded = await seedEvaluationLink("FULL");

  await page.goto(`/evaluacion/${seeded.token}`);
  await page.waitForURL("**/evaluacion/contestar");
  expect(page.url()).not.toContain(seeded.token);

  await answerGuiaINo(page);
  await answerGuiaIIAllNunca(page, { clientes: "no", jefe: "no" });

  // Editar Guía I y volver a revisión (Guía II ya válida).
  await page.getByRole("button", { name: "Editar Guía I", exact: true }).click();
  await page.locator("fieldset").first().getByLabel("No", { exact: true }).check();
  await page.getByRole("button", { name: "Continuar a Guía II" }).click();
  await expect(page.getByRole("heading", { name: "Revisar respuestas" })).toBeVisible();

  await confirmAndSubmit(page);
  await expect(page.getByRole("heading", { name: /Gracias/i })).toBeVisible();
  await expect(page.getByText(/puntaje|nivel de riesgo|score/i)).toHaveCount(0);

  expect(sql(`select status from public.evaluation_assignments where id='${seeded.assignmentId}'`)).toBe(
    "completed"
  );
  expect(sql(`select count(*) from public.evaluation_results where assignment_id='${seeded.assignmentId}'`)).toBe(
    "1"
  );
  expect(
    sql(
      `select scoring_version from public.evaluation_results where assignment_id='${seeded.assignmentId}'`
    )
  ).toBe("nom035-stps-2018-guia-i-ii-v1");
  expect(
    sql(
      `select questionnaire_version from public.evaluation_results where assignment_id='${seeded.assignmentId}'`
    )
  ).toBe("nom035-stps-2018-guias-referencia-i-ii");
  expect(sql(`select count(*) from public.evaluation_drafts where assignment_id='${seeded.assignmentId}'`)).toBe(
    "0"
  );
  expect(
    sql(
      `select count(*) from public.evaluation_sessions where assignment_id='${seeded.assignmentId}' and revoked_at is null`
    )
  ).toBe("0");
  expect(
    sql(
      `select count(*) from public.evaluation_answers where assignment_id='${seeded.assignmentId}' and question_id in ('guia_ii_41','guia_ii_42','guia_ii_43','guia_ii_44','guia_ii_45','guia_ii_46')`
    )
  ).toBe("0");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("2. Recuperación de draft tras recarga", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const seeded = await seedEvaluationLink("DRAFT");

  await page.goto(`/evaluacion/${seeded.token}`);
  await page.waitForURL("**/evaluacion/contestar");
  await answerGuiaINo(page);
  const radios = page.locator('input[type="radio"][name^="guia-ii-"]');
  const count = await radios.count();
  for (let i = 4; i < count; i += 5) await radios.nth(i).check();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText(/Progreso guardado|Guardando/)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByText(/Guía II - Paso/)).toBeVisible();
  await completeGuiaIIFromCurrent(page, { clientes: "no", jefe: "no" });
  await confirmAndSubmit(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("3. Viewport móvil sin overflow", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.setViewportSize({ width: 390, height: 844 });
  const seeded = await seedEvaluationLink("MOBILE");
  await page.goto(`/evaluacion/${seeded.token}`);
  await page.waitForURL("**/evaluacion/contestar");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
  await answerGuiaINo(page);
  await expect(page.getByText(/Guía II - Paso/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("4. Gate clientes = No no inserta 41-43", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const seeded = await seedEvaluationLink("GATE-C");
  await page.goto(`/evaluacion/${seeded.token}`);
  await page.waitForURL("**/evaluacion/contestar");
  await answerGuiaINo(page);
  await answerGuiaIIAllNunca(page, { clientes: "no", jefe: "si" });
  await expect(page.getByText("41.").locator("..").getByText("No aplicable")).toBeVisible();
  await confirmAndSubmit(page);
  expect(
    sql(
      `select count(*) from public.evaluation_answers where assignment_id='${seeded.assignmentId}' and question_id in ('guia_ii_41','guia_ii_42','guia_ii_43')`
    )
  ).toBe("0");
  expect(
    sql(
      `select count(*) from public.evaluation_answers where assignment_id='${seeded.assignmentId}' and question_id='guia_ii_44'`
    )
  ).toBe("1");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("5. Gate supervisión = No no inserta 44-46", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const seeded = await seedEvaluationLink("GATE-J");
  await page.goto(`/evaluacion/${seeded.token}`);
  await page.waitForURL("**/evaluacion/contestar");
  await answerGuiaINo(page);
  await answerGuiaIIAllNunca(page, { clientes: "si", jefe: "no" });
  await expect(page.getByText("44.").locator("..").getByText("No aplicable")).toBeVisible();
  await confirmAndSubmit(page);
  expect(
    sql(
      `select count(*) from public.evaluation_answers where assignment_id='${seeded.assignmentId}' and question_id in ('guia_ii_44','guia_ii_45','guia_ii_46')`
    )
  ).toBe("0");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("6. Doble clic en enviar produce un solo resultado", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const seeded = await seedEvaluationLink("DBLCLK");
  await page.goto(`/evaluacion/${seeded.token}`);
  await page.waitForURL("**/evaluacion/contestar");
  await answerGuiaINo(page);
  await answerGuiaIIAllNunca(page, { clientes: "no", jefe: "no" });
  await page.getByLabel(/Confirmo que revisé/).check();
  const btn = page.getByRole("button", { name: "Enviar evaluación definitivamente" });
  await btn.dblclick({ delay: 50 }).catch(async () => {
    await Promise.all([btn.click(), btn.click({ force: true }).catch(() => undefined)]);
  });
  await page.waitForURL("**/evaluacion/gracias", { timeout: 30_000 });
  expect(sql(`select count(*) from public.evaluation_results where assignment_id='${seeded.assignmentId}'`)).toBe(
    "1"
  );
  expect(errors.filter((e) => e.includes("HTTP 5")), errors.join("\n")).toEqual([]);
});

test("7. Refresh posterior no reabre el examen ni muestra score", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const seeded = await seedEvaluationLink("REFRESH");
  await page.goto(`/evaluacion/${seeded.token}`);
  await page.waitForURL("**/evaluacion/contestar");
  await answerGuiaINo(page);
  await answerGuiaIIAllNunca(page, { clientes: "no", jefe: "no" });
  await confirmAndSubmit(page);
  await page.goto(`/evaluacion/${seeded.token}`);
  await expect(page.getByRole("heading", { name: /ya completada/i })).toBeVisible();
  await expect(page.getByText(/puntaje|nivel de riesgo|score/i)).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("8. Token inválido muestra estado institucional genérico", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/evaluacion/ev_token_inexistente_con_longitud_suficiente_abcdef1234567890");
  await expect(page.getByRole("heading", { name: /Enlace no válido/i })).toBeVisible();
  await expect(page.getByText(/trabajador específico|workerId|@/i)).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("9. Token vencido", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const seeded = await seedExpiredLink();
  await page.goto(`/evaluacion/${seeded.token}`);
  await expect(page.getByRole("heading", { name: /Enlace vencido/i })).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("10. Sesión sustituida: la primera deja de poder guardar", async ({ browser }) => {
  sql("truncate table public.public_rate_limits");
  const seeded = await seedEvaluationLink("SESSION");
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();
  const errors: string[] = [];
  attachStrictGuards(page1, errors);
  attachStrictGuards(page2, errors);

  await page1.goto(`/evaluacion/${seeded.token}`);
  await page1.waitForURL("**/evaluacion/contestar", { timeout: 30_000 });
  await page1.getByRole("button", { name: "Iniciar evaluación" }).click();
  await expect(page1.getByText("Guía I (Paso 1 de 2)")).toBeVisible();

  // Segunda sesión revoca la primera (puede restaurar draft en guia_i).
  await page2.goto(`/evaluacion/${seeded.token}`);
  await page2.waitForURL("**/evaluacion/contestar", { timeout: 30_000 });
  const iniciar2 = page2.getByRole("button", { name: "Iniciar evaluación" });
  if (await iniciar2.isVisible().catch(() => false)) {
    await iniciar2.click();
  }
  await expect(page2.getByText("Guía I (Paso 1 de 2)")).toBeVisible({ timeout: 15_000 });

  // Página 1 intenta avanzar → sesión revocada al guardar draft.
  await page1.getByRole("radio", { name: "No", exact: true }).check();
  await Promise.all([
    page1.waitForResponse((r) => r.url().includes("/api/public/evaluations/draft"), {
      timeout: 20_000,
    }),
    page1.getByRole("button", { name: "Continuar a Guía II" }).click(),
  ]);
  await expect(page1.getByRole("heading", { name: "Sesión no disponible" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page1.getByText(/reemplazada/i)).toBeVisible();

  // Página 2 puede continuar.
  await page2.getByRole("radio", { name: "No", exact: true }).check();
  await page2.getByRole("button", { name: "Continuar a Guía II" }).click();
  await expect(page2.getByText(/Guía II - Paso 1/)).toBeVisible({ timeout: 20_000 });

  await ctx1.close();
  await ctx2.close();
  expect(errors.filter((e) => e.includes("HTTP 5")), errors.join("\n")).toEqual([]);
});
