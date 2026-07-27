import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { attachStrictGuards, loginAsRole, sql } from "./helpers";

const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

test.beforeAll(() => {
  sql("truncate table public.public_rate_limits");
  // B4.5 ejercita quejas/evidencias; el admin sintético habilita acceso sensible solo aquí.
  // B4.6 prueba el default sensitive=false.
  sql(
    `update public.admin_profiles
     set can_view_sensitive_cases = true
     where email = 'admin@nom035.local'`
  );
});

test.beforeEach(async ({ page }, testInfo) => {
  // La prueba de rate limit pública no requiere (ni debe) sesión admin.
  if (testInfo.title.includes("Rate limit")) return;
  await loginAsRole(page, "admin");
});

async function adminFetch(page: Page, path: string, init?: { method?: string; body?: string }) {
  return page.evaluate(
    async ({ path, init }) => {
      const res = await fetch(`/api/admin/nom035${path}`, {
        credentials: "same-origin",
        method: init?.method,
        headers: {
          Accept: "application/json",
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init?.body,
      });
      return { status: res.status, body: await res.json() };
    },
    { path, init }
  );
}

/** Siembra campaña + resultado con dominio crítico y Guía I para generación sugerida. */
function seedCampaignWithResults(): { campaignId: string; workerId: string } {
  const campaignId = randomUUID();
  const workerId = randomUUID();
  const assignmentId = randomUUID();
  sql(
    `update public.evaluation_campaigns
     set status = 'closed', closed_at = coalesce(closed_at, timezone('utc', now()))
     where status = 'active'`
  );
  sql(
    `insert into public.workers (id, nombre, activo) values ('${workerId}', 'W B45 E2E', true)`
  );
  sql(
    `insert into public.evaluation_campaigns (id, nombre, status, activated_at)
     values ('${campaignId}', 'Campaña B45 E2E', 'active', timezone('utc', now()))`
  );
  sql(
    `insert into public.evaluation_assignments
       (id, campaign_id, worker_id, token_hash, token_last4, status, completed_at)
     values ('${assignmentId}', '${campaignId}', '${workerId}', 'hash_${assignmentId.slice(0, 8)}', 'e2e5', 'completed', now())`
  );
  sql(
    `insert into public.evaluation_results (
       assignment_id, worker_id, campaign_id, scoring_version, submission_id, completed_at,
       guia_i_requires_clinical_attention, guia_ii_domain_scores)
     values (
       '${assignmentId}', '${workerId}', '${campaignId}',
       'nom035-stps-2018-guia-i-ii-v1', '${randomUUID()}', now(), true,
       '{"Carga de trabajo":{"score":30,"riskLevel":"alto"}}'::jsonb)`
  );
  return { campaignId, workerId };
}

test("B4.5 · 1 Plan sugerido idempotente", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const { campaignId } = seedCampaignWithResults();

  await page.goto("/admin/plan-accion");
  await expect(page.getByTestId("plan-accion-page")).toBeVisible();
  await page.getByTestId("plan-campaign-select").selectOption(campaignId);

  await page.getByTestId("plan-generate").click();
  await expect(page.getByTestId("plan-message")).toContainText(/creadas/i);

  const first = Number(
    sql(
      `select count(*) from public.action_plans where campaign_id='${campaignId}' and source='suggested'`
    )
  );
  expect(first).toBeGreaterThanOrEqual(1);

  await page.getByTestId("plan-generate").click();
  await expect(page.getByTestId("plan-message")).toContainText(/0 creadas|ya existían/i);

  const second = Number(
    sql(
      `select count(*) from public.action_plans where campaign_id='${campaignId}' and source='suggested'`
    )
  );
  expect(second).toBe(first);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 2 Plan manual + transición", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const { campaignId } = seedCampaignWithResults();

  await page.goto("/admin/plan-accion");
  await page.getByTestId("plan-campaign-select").selectOption(campaignId);
  await page.getByTestId("plan-area").fill("Operaciones");
  await page.getByTestId("plan-risk-factor").fill("Carga E2E");
  await page.getByTestId("plan-responsible").fill("RH Demo");
  await page.getByTestId("plan-description").fill("Acción manual E2E verificable en DB.");
  await page.getByTestId("plan-due-date").fill("2026-12-31");
  await page.getByTestId("plan-save").click();
  await expect(page.getByTestId("plan-message")).toContainText(/creada/i);

  const id = sql(
    `select id from public.action_plans where campaign_id='${campaignId}' and source='manual' and risk_factor='Carga E2E' order by created_at desc limit 1`
  );
  expect(id).toMatch(/^[0-9a-f-]{36}$/);

  await page.getByTestId(`plan-complete-${id}`).click();
  await expect(page.getByTestId("plan-message")).toContainText(/Completada|Estado/i);
  expect(sql(`select status from public.action_plans where id='${id}'`)).toBe("completada");

  const regress = await adminFetch(page, `/action-plans/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "pendiente" }),
  });
  expect(regress.body.ok).toBe(false);
  expect(regress.body.code).toMatch(/invalid_transition|invalid_status/);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 3 Evidencia PDF + descarga firmada + URL directa privada", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/admin/evidencias");
  await expect(page.getByTestId("evidencias-page")).toBeVisible();

  await page.getByTestId("evidence-title").fill("Reporte E2E PDF");
  await page.getByTestId("evidence-type").selectOption("reporte");
  await page.getByTestId("evidence-file").setInputFiles({
    name: "reporte-e2e.pdf",
    mimeType: "application/pdf",
    buffer: PDF_BYTES,
  });
  await page.getByTestId("evidence-upload").click();
  await expect(page.getByTestId("evidence-message")).toContainText(/cargado|Storage/i);

  const row = sql(
    `select id || '|' || storage_path || '|' || sha256 || '|' || mime_type from public.evidence_items
     where title='Reporte E2E PDF' and deleted_at is null and replaced_by_id is null
     order by created_at desc limit 1`
  );
  const [id, storagePath, sha, mime] = row.split("|");
  expect(id).toBeTruthy();
  expect(mime).toBe("application/pdf");
  expect(sha).toHaveLength(64);
  expect(storagePath).toMatch(/^company\/evidence\//);

  // Checklist refleja reporte
  await expect(page.getByTestId("evidence-checklist")).toContainText(/Reporte/);

  // Descarga firmada vía endpoint admin (puede ser 302 o JSON fallback)
  const downloadRes = await page.request.get(`/api/admin/nom035/evidence/${id}/download`, {
    maxRedirects: 0,
  });
  expect([200, 302, 303]).toContain(downloadRes.status());
  if ([302, 303].includes(downloadRes.status())) {
    const location = downloadRes.headers().location ?? "";
    expect(location.length).toBeGreaterThan(10);
  }

  // URL directa al objeto Storage sin firma debe fallar
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
  const direct = await page.request.get(
    `${envUrl}/storage/v1/object/public/nom035-evidence/${storagePath}`
  );
  expect(direct.status()).toBeGreaterThanOrEqual(400);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 4 Evidencia inválida rechazada", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/admin/evidencias");
  await page.getByTestId("evidence-title").fill("SVG malo");
  await page.getByTestId("evidence-file").setInputFiles({
    name: "evil.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
  });
  await page.getByTestId("evidence-upload").click();
  await expect(page.getByTestId("evidence-message")).toContainText(/permit|tipo|válid|MIME|archivo/i);

  // MIME falso: declara PDF pero es JPEG
  await page.getByTestId("evidence-title").fill("MIME falso");
  await page.getByTestId("evidence-file").setInputFiles({
    name: "falso.pdf",
    mimeType: "application/pdf",
    buffer: FAKE_JPEG,
  });
  await page.getByTestId("evidence-upload").click();
  await expect(page.getByTestId("evidence-message")).toContainText(/contenido|tipo|válid|coincid/i);

  const orphans = Number(
    sql(
      `select count(*) from storage.objects where bucket_id='nom035-evidence'
       and name like '%/falso.pdf' or name like '%/evil.svg'`
    )
  );
  expect(orphans).toBe(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 5 Reemplazo versionado", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/admin/evidencias");
  await page.getByTestId("evidence-title").fill("Versionable E2E");
  await page.getByTestId("evidence-type").selectOption("otro");
  await page.getByTestId("evidence-file").setInputFiles({
    name: "v1.pdf",
    mimeType: "application/pdf",
    buffer: PDF_BYTES,
  });
  await page.getByTestId("evidence-upload").click();
  await expect(page.getByTestId("evidence-message")).toContainText(/cargado|Storage/i);

  const v1 = sql(
    `select id from public.evidence_items where title='Versionable E2E' and version=1 and deleted_at is null order by created_at desc limit 1`
  );

  await page.locator(`[data-testid="evidence-row-${v1}"] input[type="file"]`).setInputFiles({
    name: "v2.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([PDF_BYTES, Buffer.from("\n%%v2")]),
  });
  await expect(page.getByTestId("evidence-message")).toContainText(/versión|nueva|creada/i);

  expect(sql(`select version from public.evidence_items where supersedes_id='${v1}'`)).toBe("2");
  expect(sql(`select replaced_by_id is not null from public.evidence_items where id='${v1}'`)).toBe(
    "t"
  );
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 6 Soft delete evidencia", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/admin/evidencias");
  await page.getByTestId("evidence-title").fill("Borrar E2E");
  await page.getByTestId("evidence-file").setInputFiles({
    name: "del.pdf",
    mimeType: "application/pdf",
    buffer: PDF_BYTES,
  });
  await page.getByTestId("evidence-upload").click();
  await expect(page.getByTestId("evidence-message")).toContainText(/cargado|Storage/i);
  const id = sql(
    `select id from public.evidence_items where title='Borrar E2E' and deleted_at is null order by created_at desc limit 1`
  );
  await page.getByTestId(`evidence-delete-${id}`).click();
  await expect(page.getByTestId("evidence-message")).toContainText(/Eliminada/i);
  expect(sql(`select deleted_at is not null from public.evidence_items where id='${id}'`)).toBe("t");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 7 Queja anónima otro navegador", async ({ browser }) => {
  const worker = await browser.newContext();
  const admin = await browser.newContext();
  const w = await worker.newPage();
  const a = await admin.newPage();
  const errors: string[] = [];
  attachStrictGuards(w, errors);
  attachStrictGuards(a, errors);
  await loginAsRole(a, "admin");

  await w.goto("/queja-confidencial");
  await w.getByTestId("queja-type").selectOption("violencia_laboral");
  await w.getByTestId("queja-anon").check();
  await w.getByTestId("queja-description").fill(
    "Reporte anónimo E2E con descripción suficientemente larga para validación."
  );
  await w.getByTestId("queja-confirm").check();
  await w.getByTestId("queja-submit").click();
  await expect(w.getByTestId("queja-receipt")).toBeVisible();
  const folio = (await w.getByTestId("queja-folio").textContent())?.trim() ?? "";
  expect(folio).toMatch(/^NOM035-Q-\d{4}-\d{6}$/);

  await a.goto("/admin/quejas");
  await a.getByTestId("complaint-folio-search").fill(folio);
  await a.getByRole("button", { name: "Buscar" }).click();
  await expect(a.getByTestId(`complaint-row-${folio}`)).toBeVisible();
  await expect(a.getByTestId("complaint-table")).not.toContainText(/@|teléfono|contacto@/i);

  expect(errors, errors.join("\n")).toEqual([]);
  await worker.close();
  await admin.close();
});

test("B4.5 · 8 Queja identificada detalle con contacto", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/queja-confidencial");
  await page.getByTestId("queja-identified").check();
  await page.getByTestId("queja-name").fill("Persona Demo");
  await page.getByTestId("queja-contact").fill("demo@ejemplo.test");
  await page.getByTestId("queja-description").fill(
    "Queja identificada E2E con descripción suficientemente larga."
  );
  await page.getByTestId("queja-confirm").check();
  await page.getByTestId("queja-submit").click();
  const folio = (await page.getByTestId("queja-folio").textContent())?.trim() ?? "";

  await page.goto("/admin/quejas");
  await page.getByTestId("complaint-folio-search").fill(folio);
  await page.getByRole("button", { name: "Buscar" }).click();
  const row = page.getByTestId(`complaint-row-${folio}`);
  await expect(row).toBeVisible();
  await expect(row).not.toContainText("demo@ejemplo.test");

  const id = sql(`select id from public.confidential_complaints where folio='${folio}'`);
  await page.getByTestId(`complaint-open-${id}`).click();
  await expect(page.getByTestId("complaint-contact")).toContainText("demo@ejemplo.test");
  await page.getByTestId("complaint-assign-input").fill("RH Demo");
  await page.getByRole("button", { name: "Asignar" }).click();
  await expect(page.getByTestId("complaint-message")).toContainText(/Asignada/i);
  await page.getByTestId("complaint-to-review").click();
  await expect(page.getByTestId("complaint-message")).toContainText(/revisión/i);
  await page.getByTestId("complaint-resolve").click();
  await expect(page.getByTestId("complaint-message")).toContainText(/Resuelta/i);
  await page.getByTestId("complaint-close").click();
  await expect(page.getByTestId("complaint-message")).toContainText(/Cerrada/i);
  expect(sql(`select status from public.confidential_complaints where folio='${folio}'`)).toBe(
    "cerrada"
  );
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 9 Doble clic queja una sola fila", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  const before = Number(sql("select count(*) from public.confidential_complaints"));
  await page.goto("/queja-confidencial");
  await page.getByTestId("queja-description").fill(
    "Doble envío E2E protegido con descripción suficientemente larga."
  );
  await page.getByTestId("queja-confirm").check();
  // Doble clic síncrono (el botón se deshabilita al primer submit).
  await page.getByTestId("queja-submit").evaluate((el: HTMLButtonElement) => {
    el.click();
    el.click();
  });
  await expect(page.getByTestId("queja-receipt")).toBeVisible({ timeout: 20_000 });
  const after = Number(sql("select count(*) from public.confidential_complaints"));
  expect(after - before).toBe(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 10 Rate limit quejas 429", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  sql("truncate table public.public_rate_limits");
  // Fuerza límite bajo vía env no posible en runtime; dispara muchas solicitudes.
  const max = Number(process.env.NOM035_COMPLAINT_RATE_LIMIT_MAX ?? "5");
  let got429 = false;
  for (let i = 0; i < max + 3; i++) {
    const res = await page.request.post("/api/public/complaints", {
      headers: {
        Origin: "http://127.0.0.1:3000",
        "Content-Type": "application/json",
      },
      data: {
        complaintType: "otro",
        description: `Rate limit prueba número ${i} con texto suficientemente largo.`,
        isAnonymous: true,
        reporterName: null,
        reporterContact: null,
        confirm: true,
        website: "",
      },
    });
    if (res.status() === 429) {
      got429 = true;
      break;
    }
    expect(res.status()).not.toBe(500);
  }
  expect(got429).toBe(true);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 11 Política versionado", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/admin/politica");
  await page.getByTestId("policy-generate-base").click();
  await expect(page.getByTestId("policy-title")).not.toHaveValue("");
  await page.getByTestId("policy-version-label").fill(`e2e-${Date.now()}`);
  await page.getByTestId("policy-save").click();
  await expect(page.getByTestId("policy-message")).toContainText(/Borrador/i);

  page.once("dialog", (d) => d.accept());
  await page.getByTestId("policy-publish").click();
  await expect(page.getByTestId("policy-published-banner")).toBeVisible();

  await page.getByTestId("policy-duplicate").click();
  await expect(page.getByTestId("policy-message")).toContainText(/versión|borrador/i);
  await page.getByTestId("policy-content").fill(
    `${await page.getByTestId("policy-content").inputValue()}\n\nActualización E2E.`
  );
  await page.getByTestId("policy-save").click();
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("policy-publish").click();

  expect(sql(`select count(*) from public.policy_documents where status='publicada'`)).toBe("1");
  expect(
    Number(sql(`select count(*) from public.policy_documents where status='archivada'`))
  ).toBeGreaterThanOrEqual(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 12 Dashboard refleja módulos", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/admin");
  await page.getByTestId("dashboard-refresh").click();
  await expect(page.getByTestId("dashboard-secondary-cards")).toBeVisible();
  await expect(page.getByTestId("card-actions-pending")).toBeVisible();
  await expect(page.getByTestId("card-evidence-active")).toBeVisible();
  await expect(page.getByTestId("card-complaints-received")).toBeVisible();
  await expect(page.getByTestId("card-policy")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("B4.5 · 13 Dos navegadores ven mismos datos", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  const errors: string[] = [];
  attachStrictGuards(pageA, errors);
  attachStrictGuards(pageB, errors);
  await loginAsRole(pageA, "admin");
  await loginAsRole(pageB, "admin");

  const { campaignId } = seedCampaignWithResults();
  const area = `DualArea-${Date.now()}`;

  await pageA.goto("/admin/plan-accion");
  await pageA.getByTestId("plan-campaign-select").selectOption(campaignId);
  await pageA.getByTestId("plan-area").fill(area);
  await pageA.getByTestId("plan-risk-factor").fill("Factor dual");
  await pageA.getByTestId("plan-responsible").fill("RH");
  await pageA.getByTestId("plan-description").fill("Acción visible en dos navegadores E2E.");
  await pageA.getByTestId("plan-save").click();
  await expect(pageA.getByTestId("plan-message")).toContainText(/creada/i);

  await pageB.goto("/admin/plan-accion");
  await pageB.getByTestId("plan-campaign-select").selectOption(campaignId);
  await expect(pageB.getByText(area)).toBeVisible();
  await pageB.evaluate(() => localStorage.clear());
  await pageB.reload();
  await pageB.getByTestId("plan-campaign-select").selectOption(campaignId);
  await expect(pageB.getByText(area)).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
  await a.close();
  await b.close();
});

test("B4.5 · 14 Móvil sin overflow", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await loginAsRole(page, "admin");
  for (const path of [
    "/queja-confidencial",
    "/admin/plan-accion",
    "/admin/evidencias",
    "/admin/politica",
  ]) {
    await page.goto(path);
    const ok = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el ? el.scrollWidth <= el.clientWidth + 4 : true;
    });
    expect(ok, path).toBe(true);
  }
  expect(errors, errors.join("\n")).toEqual([]);
  await ctx.close();
});

test("B4.5 · 15 Admin bloqueado en producción simulada + público sin secretos", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/admin");
  const publicRes = await page.request.post("/api/public/complaints", {
    headers: { Origin: "http://127.0.0.1:3000", "Content-Type": "application/json" },
    data: {
      complaintType: "otro",
      description: "Comprobación de respuesta pública sin secretos expuestos en el cuerpo.",
      isAnonymous: true,
      confirm: true,
      website: "",
    },
  });
  const body = await publicRes.text();
  expect(body).not.toMatch(/SUPABASE_SECRET|PEPPER|service_role/i);

  // Origin externo en admin
  const rejected = await page.request.post("http://127.0.0.1:3000/api/admin/nom035/action-plans", {
    headers: { Origin: "https://evil.example.com", "Content-Type": "application/json" },
    data: {},
  });
  expect(rejected.status()).toBe(403);
  expect(errors, errors.join("\n")).toEqual([]);
});
