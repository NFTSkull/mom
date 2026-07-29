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
    await expect(page.getByText(/no válido|no disponible|enlace/i).first()).toBeVisible();

    const expired = await seedExpiredLink();
    await page.goto(expired.url);
    await expect(page.getByText(/vencido|no válido|no disponible/i).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("B4.7 staging · quejas", () => {
  test.beforeEach(async () => {
    // Evitar 429 residuales entre proyectos Chromium desktop/móvil.
    await stagingAdmin().from("public_rate_limits").delete().neq("action", "");
  });

  test("queja anónima e identificada", async ({ page, browser }) => {
    const errors: string[] = [];
    attachStrictGuards(page, errors);

    async function submitQueja(
      p: typeof page,
      mode: "anon" | "identified"
    ): Promise<void> {
      await p.goto("/queja-confidencial");
      await p.getByTestId("queja-type").selectOption("violencia_laboral");
      if (mode === "anon") {
        await p.getByTestId("queja-anon").check();
      } else {
        await p.getByTestId("queja-identified").check();
        await p.getByTestId("queja-name").fill("STAGING_TEST Reportero");
        await p.getByTestId("queja-contact").fill("reportero-e2e@nom035.staging.local");
      }
      await p
        .getByTestId("queja-description")
        .fill(
          mode === "anon"
            ? "STAGING_TEST Queja anónima e2e remota controlada."
            : "STAGING_TEST Queja identificada e2e remota."
        );
      await p.getByTestId("queja-confirm").check();
      await p.getByTestId("queja-submit").click();
      const receipt = p.getByTestId("queja-receipt");
      const err = p.getByTestId("queja-error");
      await Promise.race([
        receipt.waitFor({ state: "visible", timeout: 25_000 }),
        err.waitFor({ state: "visible", timeout: 25_000 }).then(async () => {
          throw new Error(`queja error UI: ${(await err.textContent())?.slice(0, 160)}`);
        }),
      ]);
      await expect(p.getByTestId("queja-folio")).toBeVisible();
    }

    await submitQueja(page, "anon");
    const other = await browser.newPage();
    attachStrictGuards(other, errors);
    await submitQueja(other, "identified");
    await other.close();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
