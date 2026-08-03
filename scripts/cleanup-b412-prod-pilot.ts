/**
 * Cleanup exacto del piloto B4.12. Solo filas del marcador exacto.
 *
 * Requiere ALLOW_PRODUCTION_PILOT=B412_PILOT_ONLY + refs coincidentes.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, unlinkSync } from "node:fs";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";
import {
  assertCleanupTarget,
  assertExactPilotCampaign,
  assertExactPilotWorkerRef,
  assertNoCsvImport,
  assertNotMassOperation,
  isPilotDryRun,
} from "./lib/b412-pilot-policy";
import {
  B412_PILOT_CAMPAIGN,
  B412_PILOT_CREDS_PATH,
  B412_PILOT_EMAIL,
  B412_PILOT_REF,
} from "./lib/b412-pilot-constants";

async function deleteAssignmentTree(
  admin: ReturnType<typeof createClient>,
  assignmentId: string
) {
  await admin.from("assignment_questionnaires").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_answers").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_results").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_drafts").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_sessions").delete().eq("assignment_id", assignmentId);
  await admin.from("evaluation_assignments").delete().eq("id", assignmentId);
}

async function main() {
  const env = loadProductionEnv();
  assertNoCsvImport(env);
  assertExactPilotWorkerRef(B412_PILOT_REF);
  assertExactPilotCampaign(B412_PILOT_CAMPAIGN);

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Falta URL/secret");
  const { sanitized } = assertProductionPilotGuards({ url, env });

  if (isPilotDryRun(env)) {
    console.log(
      JSON.stringify({
        ok: true,
        dryRun: true,
        writes: false,
        ref: B412_PILOT_REF,
        campaign: B412_PILOT_CAMPAIGN,
        refSanitized: sanitized,
      })
    );
    return;
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
      ? { realtime: { transport: class {} as never } }
      : {}),
  });

  const { data: camp } = await admin
    .from("evaluation_campaigns")
    .select("id,nombre")
    .eq("nombre", B412_PILOT_CAMPAIGN)
    .maybeSingle();

  if (camp) {
    assertCleanupTarget({ campaignName: camp.nombre });
    const { data: asgs } = await admin
      .from("evaluation_assignments")
      .select("id")
      .eq("campaign_id", camp.id);
    assertNotMassOperation((asgs ?? []).length, 1);
    for (const a of asgs ?? []) {
      await deleteAssignmentTree(admin, a.id);
    }
    await admin
      .from("evaluation_campaigns")
      .delete()
      .eq("id", camp.id)
      .eq("nombre", B412_PILOT_CAMPAIGN);
  }

  const { data: w } = await admin
    .from("workers")
    .select("id,external_reference")
    .eq("external_reference", B412_PILOT_REF)
    .maybeSingle();

  if (w) {
    assertCleanupTarget({ workerRef: w.external_reference });
    await admin.from("worker_accounts").delete().eq("worker_id", w.id);
    const { data: orphanAsgs } = await admin
      .from("evaluation_assignments")
      .select("id")
      .eq("worker_id", w.id);
    assertNotMassOperation((orphanAsgs ?? []).length, 1);
    for (const a of orphanAsgs ?? []) {
      await deleteAssignmentTree(admin, a.id);
    }
    await admin
      .from("workers")
      .delete()
      .eq("id", w.id)
      .eq("external_reference", B412_PILOT_REF);
  }

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const pilotUsers = listed.data.users.filter(
    (u) => (u.email || "").toLowerCase() === B412_PILOT_EMAIL
  );
  assertNotMassOperation(pilotUsers.length, 1);
  for (const u of pilotUsers) {
    assertCleanupTarget({ authEmail: u.email ?? "" });
    await admin.auth.admin.deleteUser(u.id);
  }

  if (existsSync(B412_PILOT_CREDS_PATH)) unlinkSync(B412_PILOT_CREDS_PATH);

  const { count: workersLeft } = await admin
    .from("workers")
    .select("*", { count: "exact", head: true })
    .eq("external_reference", B412_PILOT_REF);
  const { count: campsLeft } = await admin
    .from("evaluation_campaigns")
    .select("*", { count: "exact", head: true })
    .eq("nombre", B412_PILOT_CAMPAIGN);
  const authLeft = (
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ).data.users.filter((u) => (u.email || "").toLowerCase() === B412_PILOT_EMAIL).length;

  const ok =
    (workersLeft ?? 0) === 0 &&
    (campsLeft ?? 0) === 0 &&
    authLeft === 0 &&
    !existsSync(B412_PILOT_CREDS_PATH);
  console.log(
    JSON.stringify({
      ok,
      dryRun: false,
      refSanitized: sanitized,
      residueWorkers: workersLeft ?? 0,
      residueCampaigns: campsLeft ?? 0,
      residueAuth: authLeft,
      credsDeleted: !existsSync(B412_PILOT_CREDS_PATH),
    })
  );
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
