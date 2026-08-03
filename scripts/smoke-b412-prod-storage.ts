/**
 * Storage smoke sintético Production (B4.12). No documentos reales.
 * CONFIRM_PRODUCTION_PILOT=YES NOM035_TARGET_ENV=production npx tsx scripts/smoke-b412-prod-storage.ts
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  assertProductionPilotGuards,
  loadProductionEnv,
} from "./lib/assert-production-only";
import { assertNoCsvImport } from "./lib/b412-pilot-policy";

async function main() {
  const env = loadProductionEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = env.SUPABASE_SECRET_KEY!;
  const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  assertNoCsvImport(env);
  assertProductionPilotGuards({ url, env });

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonC = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const name = `${randomBytes(8).toString("hex")}-synthetic.pdf`;
  const path = `b412-pilot/${name}`;
  const body = Buffer.from("%PDF-1.4\n% B412 PILOT STORAGE TEST\ntrailer<<>>\n%%EOF\n");

  const { error: upErr } = await admin.storage.from("nom035-evidence").upload(path, body, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw new Error(`upload ${upErr.message}`);

  const { data: signed, error: sErr } = await admin.storage
    .from("nom035-evidence")
    .createSignedUrl(path, 60);
  if (sErr || !signed?.signedUrl) throw new Error(`signed ${sErr?.message ?? "missing"}`);

  const anonList = await anonC.storage.from("nom035-evidence").list("b412-pilot");
  const anonDenied = Boolean(anonList.error) || (anonList.data ?? []).length === 0;

  const { error: delErr } = await admin.storage.from("nom035-evidence").remove([path]);
  if (delErr) throw new Error(`delete ${delErr.message}`);

  const { data: left } = await admin.storage.from("nom035-evidence").list("b412-pilot");
  const residue = (left ?? []).filter((x) => x.name === name).length;

  const ok = anonDenied && residue === 0;
  console.log(
    JSON.stringify({
      ok,
      upload: true,
      signed: true,
      anonDenied,
      residue,
      contentSha16: createHash("sha256").update(body).digest("hex").slice(0, 16),
    })
  );
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
