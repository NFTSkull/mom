/**
 * B4.20 — Smoke login 001/042/083 post-activación.
 * No imprime passwords. No pulsa Comenzar / no crea sesión de evaluación.
 *
 *   ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY NOM035_TARGET_ENV=production \
 *   EXPECTED_… CONFIRM_… npx tsx scripts/b420-smoke-login-start-button.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";
import { passwordFromEmployeeNumber } from "./lib/b4154-employee-password";

const APP = "https://nom035-production.vercel.app";
const USERS = ["001", "042", "083"] as const;

type CookieJar = Map<string, string>;

function storeCookies(jar: CookieJar, res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = anyHeaders.getSetCookie?.() ?? [];
  for (const line of raw) {
    const part = line.split(";")[0] ?? "";
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function smokeOne(
  username: string,
  password: string
): Promise<Record<string, unknown>> {
  const jar: CookieJar = new Map();
  const commonHeaders = {
    "content-type": "application/json",
    origin: APP,
    referer: `${APP}/trabajador/login`,
  };
  const login1 = await fetch(`${APP}/api/trabajador/login`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({ username, password }),
  });
  storeCookies(jar, login1);
  const loginBody = (await login1.json()) as Record<string, unknown>;
  if (!login1.ok || loginBody.ok !== true) {
    return {
      username,
      pass: false,
      step: "login1",
      status: login1.status,
      code: loginBody.code ?? loginBody.message,
    };
  }
  if (loginBody.mfaRequired === true || loginBody.requiresMfa === true) {
    return { username, pass: false, step: "mfa_gate" };
  }
  if (loginBody.mustChangePassword === true) {
    return { username, pass: false, step: "must_change_password" };
  }

  const me1 = await fetch(`${APP}/api/trabajador/me`, {
    headers: { cookie: cookieHeader(jar), origin: APP },
  });
  const meBody = (await me1.json()) as Record<string, unknown>;
  if (!me1.ok || meBody.ok !== true) {
    return { username, pass: false, step: "me1", status: me1.status };
  }
  if (meBody.mustChangePassword === true) {
    return { username, pass: false, step: "me_must_change" };
  }
  const evalStatus = String(meBody.evaluationStatus ?? "");
  const assignment = meBody.assignment as
    | { status?: string; campaignName?: string }
    | null
    | undefined;
  if (evalStatus !== "pending") {
    return {
      username,
      pass: false,
      step: "eval_status",
      evaluationStatus: evalStatus,
      campaignName: assignment?.campaignName ?? null,
    };
  }
  if (assignment?.campaignName !== "Evaluación NOM-035 2026") {
    return {
      username,
      pass: false,
      step: "campaign_name",
      campaignName: assignment?.campaignName ?? null,
    };
  }

  await fetch(`${APP}/api/trabajador/logout`, {
    method: "POST",
    headers: { cookie: cookieHeader(jar), origin: APP },
  });

  const jar2: CookieJar = new Map();
  const login2 = await fetch(`${APP}/api/trabajador/login`, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({ username, password }),
  });
  storeCookies(jar2, login2);
  const login2Body = (await login2.json()) as Record<string, unknown>;
  if (!login2.ok || login2Body.ok !== true) {
    return { username, pass: false, step: "login2", status: login2.status };
  }
  const me2 = await fetch(`${APP}/api/trabajador/me`, {
    headers: { cookie: cookieHeader(jar2), origin: APP },
  });
  const me2Body = (await me2.json()) as Record<string, unknown>;
  await fetch(`${APP}/api/trabajador/logout`, {
    method: "POST",
    headers: { cookie: cookieHeader(jar2), origin: APP },
  });

  return {
    username,
    pass:
      me2.ok &&
      me2Body.ok === true &&
      me2Body.evaluationStatus === "pending" &&
      (me2Body.assignment as { campaignName?: string } | null)?.campaignName ===
        "Evaluación NOM-035 2026",
    evaluationStatus: me2Body.evaluationStatus,
    campaignName: (me2Body.assignment as { campaignName?: string } | null)
      ?.campaignName,
    startButtonExpected: true,
    beganEvaluation: false,
    mfa: false,
    otp: false,
    mustChangePassword: false,
  };
}

async function main() {
  const env = loadProductionEnv();
  Object.assign(process.env, env);
  const { sanitized } = assertProductionPilotGuards({
    url: env.NEXT_PUBLIC_SUPABASE_URL!,
    env: {
      ...env,
      ALLOW_PRODUCTION_PILOT: process.env.ALLOW_PRODUCTION_PILOT,
      CONFIRM_SUPABASE_PROJECT_REF: process.env.CONFIRM_SUPABASE_PROJECT_REF,
      EXPECTED_SUPABASE_PROJECT_REF: process.env.EXPECTED_SUPABASE_PROJECT_REF,
      NOM035_TARGET_ENV: process.env.NOM035_TARGET_ENV ?? "production",
    },
  });

  if (!env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY ausente");
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: class {} as never },
    }
  );

  const results: Array<Record<string, unknown>> = [];
  for (const username of USERS) {
    const { data: wa, error } = await admin
      .from("worker_accounts")
      .select("username_normalized, worker_id, workers!inner(external_reference)")
      .eq("username_normalized", username)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !wa) {
      results.push({ username, pass: false, step: "lookup", error: error?.message });
      continue;
    }
    const workers = wa.workers as
      | { external_reference?: string }
      | { external_reference?: string }[]
      | null;
    const ext = Array.isArray(workers)
      ? workers[0]?.external_reference
      : workers?.external_reference;
    if (!ext) {
      results.push({ username, pass: false, step: "no_external_ref" });
      continue;
    }
    const password = passwordFromEmployeeNumber(String(ext));
    results.push(await smokeOne(username, password));
  }

  const allPass = results.every((r) => r.pass === true);
  console.log(
    JSON.stringify(
      {
        block: "B4.20",
        refSanitized: sanitized,
        app: APP,
        results,
        allPass,
        passwordsPrinted: false,
      },
      null,
      2
    )
  );
  if (!allPass) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
