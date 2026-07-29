import { expect, test } from "@playwright/test";
import {
  answerGuiaINo,
  answerGuiaIIAllNunca,
  attachStrictGuards,
  confirmAndSubmit,
  seedEvaluationLink,
  seedExpiredLink,
  stagingAdmin,
} from "./helpers";

test.describe("B4.7 staging · evaluación pública", () => {
  test("flujo completo: token → cookie → submit → resultado único", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    const seeded = await seedEvaluationLink("FULL");
    await page.goto(seeded.url);
    await page.waitForURL("**/evaluacion/contestar");
    expect(page.url()).not.toContain(seeded.token);

    await answerGuiaINo(page);
    await answerGuiaIIAllNunca(page);
    await confirmAndSubmit(page);
    await expect(page.getByText(/Gracias/i)).toBeVisible();

    await page.goto(seeded.url);
    await expect(page.getByText(/ya completada|no válido|no disponible/i)).toBeVisible({
      timeout: 15_000,
    });

    const admin = stagingAdmin();
    const { count: results } = await admin
      .from("evaluation_results")
      .select("*", { count: "exact", head: true })
      .eq("assignment_id", seeded.assignmentId);
    expect(results).toBe(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("token inválido / vencido", async ({ page }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);
    await page.goto("/evaluacion/ev_token_invalido_staging_xyz");
    await expect(page.getByText(/no válido|no disponible|enlace/i)).toBeVisible();

    const expired = await seedExpiredLink();
    await page.goto(expired.url);
    await expect(page.getByText(/vencido|no válido|no disponible/i)).toBeVisible({
      timeout: 15_000,
    });
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("B4.7 staging · quejas", () => {
  test("queja anónima e identificada", async ({ page, browser }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);

    await page.goto("/queja-confidencial");
    const type = page.getByTestId("queja-type");
    if (await type.count()) {
      await type.selectOption({ index: 1 });
    }
    if (await page.getByTestId("queja-anon").count()) {
      await page.getByTestId("queja-anon").check();
    }
    await page.getByTestId("queja-description").fill("STAGING_TEST Queja anónima e2e remota controlada.");
    if (await page.getByTestId("queja-confirm").count()) {
      await page.getByTestId("queja-confirm").check();
    }
    await page.getByTestId("queja-submit").click();
    await expect(page.getByTestId("queja-folio").or(page.getByTestId("queja-receipt")).first()).toBeVisible({
      timeout: 20_000,
    });

    const other = await browser.newPage();
    attachStrictGuards(other, errors);
    await other.goto("/queja-confidencial");
    if (await other.getByTestId("queja-identified").count()) {
      await other.getByTestId("queja-identified").check();
    }
    if (await other.getByTestId("queja-name").count()) {
      await other.getByTestId("queja-name").fill("STAGING_TEST Reportero");
    }
    if (await other.getByTestId("queja-contact").count()) {
      await other.getByTestId("queja-contact").fill("reportero-e2e@nom035.staging.local");
    }
    await other.getByTestId("queja-description").fill("STAGING_TEST Queja identificada e2e remota.");
    if (await other.getByTestId("queja-confirm").count()) {
      await other.getByTestId("queja-confirm").check();
    }
    await other.getByTestId("queja-submit").click();
    await expect(other.getByTestId("queja-folio").or(other.getByTestId("queja-receipt")).first()).toBeVisible({
      timeout: 20_000,
    });
    await other.close();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
