/**
 * Cleanup LOCAL B4.11 — elimina únicamente datos marcados B411 (SQL + Auth admin).
 *   npm run b411:cleanup:local
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertLocalSupabaseOnly,
  loadEnvLocal,
} from "./lib/assert-local-supabase-only";
import {
  B411_CAMPAIGN,
  B411_COMPANY,
  B411_CREDS_PATH,
  B411_EMAIL_DOMAIN,
  B411_MARKER,
} from "./lib/b411-constants";

const DB = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

function sqlFile(content: string): string {
  const dir = join(process.cwd(), ".tmp");
  if (!existsSync(dir)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("node:fs").mkdirSync(dir, { recursive: true });
  }
  const path = join(dir, "b411-cleanup.sql");
  writeFileSync(path, content, { mode: 0o600 });
  try {
    return execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-f", path], {
      encoding: "utf8",
    });
  } finally {
    if (existsSync(path)) unlinkSync(path);
  }
}

function sql(query: string): string {
  return execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8",
  }).trim();
}

async function main() {
  const env = loadEnvLocal();
  assertLocalSupabaseOnly(env.NEXT_PUBLIC_SUPABASE_URL!);

  sqlFile(`
BEGIN;
DELETE FROM public.evaluation_results
WHERE campaign_id IN (SELECT id FROM public.evaluation_campaigns WHERE nombre = '${B411_CAMPAIGN}');
DELETE FROM public.assignment_questionnaires
WHERE assignment_id IN (
  SELECT a.id FROM public.evaluation_assignments a
  JOIN public.evaluation_campaigns c ON c.id = a.campaign_id
  WHERE c.nombre = '${B411_CAMPAIGN}'
);
DELETE FROM public.evaluation_answers
WHERE assignment_id IN (
  SELECT a.id FROM public.evaluation_assignments a
  JOIN public.evaluation_campaigns c ON c.id = a.campaign_id
  WHERE c.nombre = '${B411_CAMPAIGN}'
);
DELETE FROM public.evaluation_drafts
WHERE assignment_id IN (
  SELECT a.id FROM public.evaluation_assignments a
  JOIN public.evaluation_campaigns c ON c.id = a.campaign_id
  WHERE c.nombre = '${B411_CAMPAIGN}'
);
DELETE FROM public.evaluation_sessions
WHERE assignment_id IN (
  SELECT a.id FROM public.evaluation_assignments a
  JOIN public.evaluation_campaigns c ON c.id = a.campaign_id
  WHERE c.nombre = '${B411_CAMPAIGN}'
);
DELETE FROM public.evaluation_assignments
WHERE campaign_id IN (SELECT id FROM public.evaluation_campaigns WHERE nombre = '${B411_CAMPAIGN}');
DELETE FROM public.evaluation_campaigns WHERE nombre = '${B411_CAMPAIGN}';
DELETE FROM public.worker_accounts
WHERE worker_id IN (SELECT id FROM public.workers WHERE external_reference LIKE 'TST-B411-%');
DELETE FROM public.workers WHERE external_reference LIKE 'TST-B411-%';
UPDATE public.company_settings
SET razon_social = 'EMPRESA_LOCAL_RESET', total_trabajadores = 0
WHERE razon_social = '${B411_COMPANY}';
COMMIT;
`);

  const options: { auth: object; realtime?: { transport: new () => unknown } } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: class {} as never };
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, options as never);

  for (let page = 1; page <= 20; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = listed.data.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      const email = (u.email || "").toLowerCase();
      const marker = (u.user_metadata as { marker?: string } | undefined)?.marker;
      if (email.endsWith(`@${B411_EMAIL_DOMAIN}`) || marker === B411_MARKER) {
        await admin.auth.admin.deleteUser(u.id);
      }
    }
    if (users.length < 200) break;
  }

  if (existsSync(B411_CREDS_PATH)) unlinkSync(B411_CREDS_PATH);

  const camp = sql(`select count(*) from public.evaluation_campaigns where nombre='${B411_CAMPAIGN}'`);
  const workers = sql(`select count(*) from public.workers where external_reference like 'TST-B411-%'`);
  const ok = camp === "0" && workers === "0";

  console.log(
    JSON.stringify({
      ok,
      cleaned: true,
      marker: B411_MARKER,
      campaign: B411_CAMPAIGN,
      residueCampaign: Number(camp),
      residueWorkers: Number(workers),
      credsRemoved: !existsSync(B411_CREDS_PATH),
    }),
  );
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
