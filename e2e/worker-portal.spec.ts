import { expect, test } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  adminClient,
  answerGuiaINo,
  answerGuiaIIAllNunca,
  attachStrictGuards,
  confirmAndSubmit,
  loadEnvLocal,
  sql,
} from "./helpers";

const USERNAME = "trabajador.prueba";
const TEMP_PASSWORD = process.env.WORKER_TEST_PASSWORD || "Nom035-Prueba#2026!";
const NEW_PASSWORD = "Nom035-Cambiada#2026!";

async function ensureWorkerSeed() {
  const env = loadEnvLocal();
  process.env.WORKER_TEST_PASSWORD = TEMP_PASSWORD;
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;
  const { execFileSync } = await import("node:child_process");
  execFileSync("npx", ["--yes", "tsx", "scripts/seed-worker-login-local.ts"], {
    env: process.env,
    encoding: "utf8",
  });
}

test.beforeAll(async () => {
  sql("truncate table public.public_rate_limits");
  await ensureWorkerSeed();
});

test("W1. Login inválido genérico", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await page.goto("/trabajador/login");
  await page.getByTestId("worker-login-username").fill(USERNAME);
  await page.getByTestId("worker-login-password").fill("clave-incorrecta-xyz");
  await page.getByTestId("worker-login-submit").click();
  await expect(page.getByTestId("worker-login-error")).toHaveText(
    "Usuario o contraseña incorrectos."
  );
  expect(errors, errors.join("\n")).toEqual([]);
});

test("W2-W4. Login válido + cambio obligatorio + hub", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await ensureWorkerSeed();

  await page.goto("/trabajador/login");
  await page.getByTestId("worker-login-username").fill(USERNAME);
  await page.getByTestId("worker-login-password").fill(TEMP_PASSWORD);
  await page.getByTestId("worker-login-submit").click();
  await page.waitForURL("**/trabajador/cambiar-contrasena");

  await page.getByTestId("worker-new-password").fill(NEW_PASSWORD);
  await page.getByTestId("worker-confirm-password").fill(NEW_PASSWORD);
  await page.getByTestId("worker-password-submit").click();
  await page.waitForURL("**/trabajador");
  await expect(page.getByText(/Comenzar evaluación|Continuar evaluación/i)).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("W5. Worker sin assignment", async ({ page }) => {
  const admin = adminClient();
  const workerId = randomUUID();
  const authEmail = `sin.asig.${workerId.slice(0, 8)}@nom035.test`;
  const username = `sin.asig.${workerId.slice(0, 8)}`;
  const password = "SinAsig#2026xx!";

  const { data: company } = await admin.from("company_settings").select("id").single();
  await admin.from("workers").insert({
    id: workerId,
    nombre: "Sin Assignment",
    external_reference: `SA-${workerId.slice(0, 6)}`,
    activo: true,
  });
  const created = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    app_metadata: { role: "worker" },
  });
  await admin.from("worker_accounts").insert({
    company_id: company!.id,
    worker_id: workerId,
    auth_user_id: created.data.user!.id,
    username_normalized: username,
    is_active: true,
    must_change_password: false,
  });

  await page.goto("/trabajador/login");
  await page.getByTestId("worker-login-username").fill(username);
  await page.getByTestId("worker-login-password").fill(password);
  await page.getByTestId("worker-login-submit").click();
  await page.waitForURL("**/trabajador");
  await expect(
    page.getByText(/No tienes una evaluación activa/i)
  ).toBeVisible();

  await admin.from("worker_accounts").delete().eq("worker_id", workerId);
  await admin.from("workers").delete().eq("id", workerId);
  await admin.auth.admin.deleteUser(created.data.user!.id);
});

test("W6-W15. Abrir evaluación, draft, submit, completado", async ({ page }) => {
  const errors: string[] = [];
  attachStrictGuards(page, errors);
  await ensureWorkerSeed();
  // Tras seed, password temporal; cambiar primero vía API login flow
  await page.goto("/trabajador/login");
  await page.getByTestId("worker-login-username").fill(USERNAME);
  await page.getByTestId("worker-login-password").fill(TEMP_PASSWORD);
  await page.getByTestId("worker-login-submit").click();
  await page.waitForURL("**/trabajador/cambiar-contrasena");
  await page.getByTestId("worker-new-password").fill(NEW_PASSWORD);
  await page.getByTestId("worker-confirm-password").fill(NEW_PASSWORD);
  await page.getByTestId("worker-password-submit").click();
  await page.waitForURL("**/trabajador");

  await page.getByRole("link", { name: /Comenzar evaluación|Continuar evaluación/i }).click();
  await page.waitForURL("**/evaluacion/contestar");
  expect(page.url()).not.toMatch(/token=|ev_/);

  await answerGuiaINo(page);
  await page.reload();
  await page.waitForURL("**/evaluacion/contestar");
  await answerGuiaIIAllNunca(page, { clientes: "no", jefe: "no" });
  await confirmAndSubmit(page);
  await expect(page.getByRole("heading", { name: /Gracias/i })).toBeVisible();

  await page.goto("/trabajador");
  await expect(page.getByText(/enviada correctamente/i)).toBeVisible();
  await page.goto("/trabajador/completado");
  await expect(page.getByText(/enviada correctamente|Gracias/i)).toBeVisible();

  const assignmentId = sql(
    `select a.id from public.evaluation_assignments a
     join public.workers w on w.id = a.worker_id
     where w.external_reference = 'TST-0001'
     order by a.created_at desc limit 1`
  );
  expect(sql(`select status from public.evaluation_assignments where id='${assignmentId}'`)).toBe(
    "completed"
  );
  expect(errors, errors.join("\n")).toEqual([]);
});

test("W16-W19. Aislamiento: admin API y scores denegados al worker", async ({
  page,
  request,
}) => {
  await ensureWorkerSeed();
  await page.goto("/trabajador/login");
  await page.getByTestId("worker-login-username").fill(USERNAME);
  await page.getByTestId("worker-login-password").fill(TEMP_PASSWORD);
  await page.getByTestId("worker-login-submit").click();
  await page.waitForURL("**/trabajador/cambiar-contrasena");
  await page.getByTestId("worker-new-password").fill(NEW_PASSWORD);
  await page.getByTestId("worker-confirm-password").fill(NEW_PASSWORD);
  await page.getByTestId("worker-password-submit").click();
  await page.waitForURL("**/trabajador");

  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin$/);

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const adminRes = await request.get("/api/admin/nom035/dashboard", {
    headers: { Cookie: cookieHeader, Origin: "http://127.0.0.1:3000" },
  });
  expect([401, 403]).toContain(adminRes.status());

  const resultsRes = await request.get("/api/admin/nom035/results", {
    headers: { Cookie: cookieHeader, Origin: "http://127.0.0.1:3000" },
  });
  expect([401, 403]).toContain(resultsRes.status());
});

test("W20. Cuenta bloqueada", async ({ page }) => {
  await ensureWorkerSeed();
  const workerId = sql(
    `select id from public.workers where external_reference='TST-0001' limit 1`
  );
  sql(
    `update public.worker_accounts set is_active=false where worker_id='${workerId}'`
  );

  await page.goto("/trabajador/login");
  await page.getByTestId("worker-login-username").fill(USERNAME);
  await page.getByTestId("worker-login-password").fill(TEMP_PASSWORD);
  await page.getByTestId("worker-login-submit").click();
  await expect(page.getByTestId("worker-login-error")).toHaveText(
    "Usuario o contraseña incorrectos."
  );

  sql(
    `update public.worker_accounts set is_active=true, must_change_password=true where worker_id='${workerId}'`
  );
});

test("W24. Cero password/tokens en logs de seed", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync("npx", ["--yes", "tsx", "scripts/seed-worker-login-local.ts"], {
    env: { ...process.env, WORKER_TEST_PASSWORD: TEMP_PASSWORD },
    encoding: "utf8",
  });
  expect(out).not.toContain(TEMP_PASSWORD);
  expect(out).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  expect(out).not.toContain("Nom035-Prueba");
  // fingerprint token hashes accidentally printed?
  const hash = createHash("sha256").update(randomBytes(8)).digest("hex");
  void hash;
});
