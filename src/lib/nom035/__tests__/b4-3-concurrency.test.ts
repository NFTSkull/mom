import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Concurrencia real contra Supabase local: dos submits simultáneos.
 * Resultado obligatorio: exactamente un resultado, un assignment completed,
 * ninguna respuesta duplicada, cero 500 (ambos ok o conflicto controlado).
 */

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    // vacío
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function adminClient() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta config Supabase local en .env.local");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url)) {
    throw new Error("Concurrencia solo se prueba contra Supabase local");
  }
  const options: { auth: object; realtime?: { transport: new () => unknown } } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: class {} as never };
  }
  return createClient(url, secret, options as never);
}

function sql(query: string): string {
  return execFileSync(
    "psql",
    ["postgresql://postgres:postgres@127.0.0.1:55322/postgres", "-At", "-c", query],
    { encoding: "utf8" }
  ).trim();
}

describe("B4.3 · concurrencia de submit", () => {
  it("dos submits simultáneos producen exactamente un resultado", async () => {
    const env = loadEnvLocal();
    const admin = adminClient();
    const pepper = env.NOM035_TOKEN_PEPPER;
    const sessionPepper = env.NOM035_SESSION_PEPPER;
    expect(pepper).toBeTruthy();
    expect(sessionPepper).toBeTruthy();

    const workerId = randomUUID();
    const campaignId = randomUUID();
    await admin.from("workers").insert({ id: workerId, nombre: "Concurrency Worker", activo: true });
    // B4.4: solo una campaña active.
    sql(
      `update public.evaluation_campaigns
       set status='closed', closed_at=coalesce(closed_at, timezone('utc', now()))
       where status='active'`
    );
    await admin.from("evaluation_campaigns").insert({
      id: campaignId,
      nombre: `Concurrency ${Date.now()}`,
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
      p_expires_at: new Date(Date.now() + 86400000).toISOString(),
      p_questionnaire_version: "nom035-stps-2018-guias-referencia-i-ii",
    });
    expect(created.data?.ok).toBe(true);

    const session = `es_${randomBytes(32).toString("base64url")}`;
    const sessionHash = createHmac("sha256", sessionPepper).update(session, "utf8").digest("hex");
    const exchanged = await admin.rpc("exchange_evaluation_token", {
      p_token_hash: tokenHash,
      p_session_hash: sessionHash,
      p_session_expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(exchanged.data?.ok).toBe(true);
    await admin.rpc("start_public_evaluation", { p_session_hash: sessionHash });

    const answers = [
      { questionnaire_code: "GUIA_I", question_id: "guia_i_1", answer_value: "no" },
      { questionnaire_code: "GUIA_II", question_id: "guia_ii_gate_clientes", answer_value: "no" },
      { questionnaire_code: "GUIA_II", question_id: "guia_ii_1", answer_value: "nunca" },
    ];
    const resultPayload = {
      guia_ii_final_score: 10,
      guia_ii_final_risk_level: "bajo",
      alerts: [],
      validation_warnings: [],
    };
    const submissionId = randomUUID();

    const submitOnce = () =>
      admin.rpc("submit_public_evaluation", {
        p_session_hash: sessionHash,
        p_submission_id: submissionId,
        p_answers: answers,
        p_result: resultPayload,
        p_questionnaire_version: "nom035-stps-2018-guias-referencia-i-ii",
        p_scoring_version: "nom035-stps-2018-guia-i-ii-v1",
        p_calculated_at: new Date().toISOString(),
      });

    const [a, b] = await Promise.all([submitOnce(), submitOnce()]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const codes = [a.data, b.data].map((d) => ({ ok: d?.ok, code: d?.code }));
    expect(
      codes.every(
        (c) =>
          c.ok === true ||
          c.code === "conflict" ||
          c.code === "no_session" ||
          c.code === "session_revoked"
      )
    ).toBe(true);
    expect(codes.some((c) => c.ok === true)).toBe(true);

    const assignmentId = created.data.assignmentId as string;
    expect(sql(`select count(*) from public.evaluation_results where assignment_id='${assignmentId}'`)).toBe("1");
    expect(sql(`select status from public.evaluation_assignments where id='${assignmentId}'`)).toBe("completed");
    const answerCount = sql(
      `select count(*) from public.evaluation_answers where assignment_id='${assignmentId}'`
    );
    const distinctCount = sql(
      `select count(distinct question_id) from public.evaluation_answers where assignment_id='${assignmentId}'`
    );
    expect(answerCount).toBe(distinctCount);
  }, 30_000);
});
