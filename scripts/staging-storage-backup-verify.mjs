#!/usr/bin/env node
/**
 * Verifica backup/restore lógico de un PDF ficticio en bucket privado nom035-evidence.
 * No imprime service keys ni signed URLs activas.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(
  process.env.HOME ?? "",
  "Desktop/nom035-staging-backup-verified"
);
const BUCKET = "nom035-evidence";
const MARK = "STAGING_TEST";

function loadEnv() {
  const out = {};
  try {
    const raw = readFileSync(".env.staging.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    // optional
  }
  return { ...out, ...process.env };
}

function assertStaging(url, expectedRef) {
  const host = new URL(url).hostname;
  const ref = host.split(".")[0] ?? "";
  if (ref !== expectedRef) throw new Error("project ref mismatch");
  if (/prod|production|concasa|charolais/i.test(url)) {
    throw new Error("proyecto prohibido");
  }
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !publishable) throw new Error("faltan credenciales staging");
  const ref = readFileSync(".tmp/staging-project-ref.txt", "utf8").trim();
  assertStaging(url, ref);

  class NoopRealtimeTransport {}
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopRealtimeTransport },
  });
  const anon = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopRealtimeTransport },
  });

  const path = `${MARK}/backup-verify/${Date.now()}-ficticio.pdf`;
  const bytes = new TextEncoder().encode(
    "%PDF-1.4\n% STAGING_TEST backup restore fiction\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
  );
  const originalHash = sha256(bytes);

  const up = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) throw new Error(`upload: ${up.error.message}`);

  // Anónimo directo debe fallar (bucket privado)
  const anonGet = await anon.storage.from(BUCKET).download(path);
  const anonDenied = Boolean(anonGet.error);

  // Signed URL (no se persiste la URL)
  const signed = await admin.storage.from(BUCKET).createSignedUrl(path, 60);
  if (signed.error) throw new Error(`signed: ${signed.error.message}`);
  const signedUrl = signed.data.signedUrl;
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`signed fetch HTTP ${res.status}`);
  const downloaded = Buffer.from(await res.arrayBuffer());
  const downloadHash = sha256(downloaded);
  if (downloadHash !== originalHash) throw new Error("hash mismatch after signed download");

  // "Restore" controlado: re-upload a path de recuperación en el mismo bucket (prueba de procedimiento)
  const restorePath = `${MARK}/backup-verify/restored-${Date.now()}.pdf`;
  const restoreUp = await admin.storage.from(BUCKET).upload(restorePath, downloaded, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (restoreUp.error) throw new Error(`restore upload: ${restoreUp.error.message}`);
  const restoreDl = await admin.storage.from(BUCKET).download(restorePath);
  if (restoreDl.error) throw new Error(restoreDl.error.message);
  const restoreBuf = Buffer.from(await restoreDl.data.arrayBuffer());
  const restoreHash = sha256(restoreBuf);
  if (restoreHash !== originalHash) throw new Error("restore hash mismatch");

  // Bucket privacy check via list as anon
  const anonList = await anon.storage.from(BUCKET).list(MARK);
  const anonListDenied = Boolean(anonList.error) || (anonList.data?.length ?? 0) === 0;

  // Cleanup objetos de prueba
  await admin.storage.from(BUCKET).remove([path, restorePath]);

  mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });
  const manifest = {
    verified_at_utc: new Date().toISOString(),
    bucket: BUCKET,
    path_ficticio_sanitized: `${MARK}/backup-verify/<timestamp>-ficticio.pdf`,
    mime: "application/pdf",
    bytes: bytes.length,
    sha256: originalHash,
    anonymous_direct_denied: anonDenied,
    anonymous_list_private_ok: anonListDenied,
    signed_url_functional: true,
    signed_url_ttl_seconds: 60,
    restore_hash_match: restoreHash === originalHash,
    note:
      "Signed URL no se guarda. Service key no se guarda. Objetos de prueba eliminados.",
  };
  const out = resolve(OUT_DIR, "STORAGE_MANIFEST.json");
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  console.log("[storage-backup-verify] OK");
  console.log(
    JSON.stringify(
      {
        bucket: BUCKET,
        bytes: bytes.length,
        sha256: originalHash,
        anon_denied: anonDenied,
        restore_hash_match: true,
        cleaned: true,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("[storage-backup-verify]", e.message || e);
  process.exit(1);
});
