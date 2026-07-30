import { expect, test } from "@playwright/test";
import {
  answerGuiaINo,
  answerGuiaIIIAllNunca,
  attachStrictGuards,
  seedEvaluationLink,
  sql,
} from "./helpers";

test.describe("B4.10 Guía III E2E", () => {
  test("I→III draft + gates + submit + no reedición", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);

    const seeded = await seedEvaluationLink("G3", {
      questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
    });

    await page.goto(seeded.url);
    await expect(page.getByRole("heading", { name: /Evaluación NOM-035/i })).toBeVisible();
    await expect(page.getByText(/Guía I y Guía III/i)).toBeVisible();

    await answerGuiaINo(page);
    await expect(page.getByTestId("frp-stage-GUIA_III")).toBeVisible();

    // Parcial: primer bloque Nunca + Siguiente
    const radios = page.locator('input[type="radio"][name^="guia-iii-"]');
    await expect(radios.first()).toBeVisible();
    const count = await radios.count();
    for (let i = 4; i < count; i += 5) await radios.nth(i).check();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText(/Progreso guardado|Guardando/)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByTestId("frp-stage-GUIA_III")).toBeVisible({ timeout: 15_000 });

    // Completar desde el bloque actual hasta el final
    await answerGuiaIIIAllNunca(page, { clientes: "si", jefe: "no" });

    await page.getByLabel(/Confirmo que revisé/).check();
    await page.getByRole("button", { name: /Enviar evaluación definitivamente/ }).click();
    await expect(page).toHaveURL(/\/evaluacion\/gracias/, { timeout: 30_000 });

    const status = sql(
      `select status from public.evaluation_assignments where id = '${seeded.assignmentId}'`
    );
    expect(status).toBe("completed");

    const guide = sql(
      `select result_snapshot->>'guide_type' from public.evaluation_results where assignment_id = '${seeded.assignmentId}'`
    );
    expect(guide).toBe("GUIA_III");

    const instruments = sql(
      `select string_agg(questionnaire_type, ',' order by questionnaire_type)
       from public.assignment_questionnaires where assignment_id = '${seeded.assignmentId}'`
    );
    expect(instruments).toBe("GUIA_I,GUIA_III");

    // Reentrada: no editable
    await page.goto(seeded.url);
    await expect(page.getByRole("heading", { name: /Evaluación ya completada/i })).toBeVisible({
      timeout: 15_000,
    });

    expect(errors).toEqual([]);
  });

  test("aislamiento A/B: B no hereda resultado A", async ({ page }) => {
    const a = await seedEvaluationLink("G3A", {
      questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
    });

    await page.goto(a.url);
    await answerGuiaINo(page);
    await answerGuiaIIIAllNunca(page, { clientes: "no", jefe: "no" });
    await page.getByLabel(/Confirmo que revisé/).check();
    await page.getByRole("button", { name: /Enviar evaluación definitivamente/ }).click();
    await expect(page).toHaveURL(/\/evaluacion\/gracias/);

    const b = await seedEvaluationLink("G3B", {
      questionnaireVersion: "nom035-stps-2018-guias-referencia-i-iii",
    });
    const statusB = sql(
      `select status from public.evaluation_assignments where id = '${b.assignmentId}'`
    );
    expect(statusB).toBe("pending");

    await page.goto(b.url);
    await expect(page.getByRole("button", { name: /Iniciar evaluación/i })).toBeVisible();
  });
});
