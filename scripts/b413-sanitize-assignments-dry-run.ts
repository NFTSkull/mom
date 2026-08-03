#!/usr/bin/env node
/**
 * B4.13 dry-run de saneamiento (SOLO LECTURA). No escribe.
 *
 *   ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY \
 *   EXPECTED_SUPABASE_PROJECT_REF=... CONFIRM_SUPABASE_PROJECT_REF=... \
 *   NOM035_TARGET_ENV=production npx tsx scripts/b413-sanitize-assignments-dry-run.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";

async function main() {
  const env = loadProductionEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY!;
  const { sanitized } = assertProductionPilotGuards({ url, env });

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: asgs, error } = await admin
    .from("evaluation_assignments")
    .select("id,status,questionnaire_version,campaign_id,worker_id");
  if (error) throw new Error(error.message);

  let withActivity = 0;
  let noActivity = 0;
  for (const a of asgs ?? []) {
    const [{ count: sessions }, { count: drafts }, { count: answers }, { count: results }] =
      await Promise.all([
        admin
          .from("evaluation_sessions")
          .select("*", { count: "exact", head: true })
          .eq("assignment_id", a.id),
        admin
          .from("evaluation_drafts")
          .select("*", { count: "exact", head: true })
          .eq("assignment_id", a.id),
        admin
          .from("evaluation_answers")
          .select("*", { count: "exact", head: true })
          .eq("assignment_id", a.id),
        admin
          .from("evaluation_results")
          .select("*", { count: "exact", head: true })
          .eq("assignment_id", a.id),
      ]);
    const active =
      (sessions ?? 0) > 0 || (drafts ?? 0) > 0 || (answers ?? 0) > 0 || (results ?? 0) > 0;
    if (active) withActivity += 1;
    else noActivity += 1;
  }

  const blocked = withActivity > 0;
  console.log(
    JSON.stringify(
      {
        ok: !blocked,
        dryRun: true,
        writes: false,
        refSanitized: sanitized,
        totalAssignments: asgs?.length ?? 0,
        noActivity,
        withActivity,
        workersToDelete: 0,
        realAccountsToDelete: 0,
        realAnswersToDelete: 0,
        realResultsToDelete: 0,
        sanitizeExecutable: !blocked,
        verdict: blocked
          ? "PRODUCCIÓN BLOQUEADA — hay assignments con actividad (draft/sesión)"
          : "DRY-RUN LISTO PARA SANEAMIENTO TRANSACCIONAL",
      },
      null,
      2
    )
  );
  if (blocked) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
