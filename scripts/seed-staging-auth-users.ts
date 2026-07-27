/**
 * Seed de usuarios sintéticos SOLO para Supabase staging (nom035-staging).
 * Se niega a correr si el project ref / URL no corresponden a staging.
 * Credenciales solo en .tmp/ (gitignored). Nunca usuarios reales.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as OTPAuth from "otpauth";

const EXPECTED_NAME = "nom035-staging";
const SYNTH_DOMAIN = "@nom035.staging.local";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.staging.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  } catch {
    // optional
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function strongPassword(): string {
  return `Aa1!${randomBytes(24).toString("base64url")}`;
}

function assertStaging(url: string, expectedRef: string) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url.replace(/\/$/, ""))) {
    throw new Error("URL staging inválida");
  }
  const host = new URL(url).hostname;
  const ref = host.split(".")[0] ?? "";
  if (ref !== expectedRef) {
    throw new Error("project ref no coincide con staging verificado");
  }
  if (ref.length < 8) throw new Error("project ref inválido");
}

const USERS = [
  { email: `admin${SYNTH_DOMAIN}`, role: "admin", nombre: "STAGING Admin", sensitive: false },
  { email: `rh${SYNTH_DOMAIN}`, role: "rh", nombre: "STAGING RH", sensitive: false },
  {
    email: `psicologo${SYNTH_DOMAIN}`,
    role: "psicologo",
    nombre: "STAGING Psicologo",
    sensitive: true,
  },
  {
    email: `direccion${SYNTH_DOMAIN}`,
    role: "direccion",
    nombre: "STAGING Direccion",
    sensitive: false,
  },
] as const;

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !anon) {
    throw new Error("Falta .env.staging.local (URL + keys). No se usan valores del chat.");
  }

  const refFile = resolve(".tmp/staging-project-ref.txt");
  if (!existsSync(refFile)) {
    throw new Error("Falta .tmp/staging-project-ref.txt (generado tras identificar staging)");
  }
  const expectedRef = readFileSync(refFile, "utf8").trim();
  assertStaging(url, expectedRef);

  // Defensa: rechazar refs conocidos prohibidos por nombre histórico
  if (env.STAGING_PROJECT_NAME && env.STAGING_PROJECT_NAME !== EXPECTED_NAME) {
    throw new Error("STAGING_PROJECT_NAME debe ser nom035-staging");
  }

  class NoopRealtimeTransport {}
  const options: {
    auth: object;
    realtime?: { transport: new () => unknown };
  } = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    options.realtime = { transport: NoopRealtimeTransport as never };
  }
  const admin = createClient(url, secret, options as never);

  const credentials: Array<{
    email: string;
    password: string;
    role: string;
    totpSecret: string;
  }> = [];

  for (const u of USERS) {
    const password = strongPassword();
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed.data.users.find(
      (x) => x.email?.toLowerCase() === u.email.toLowerCase()
    );
    let userId = existing?.id;
    if (!userId) {
      const created = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { staging: true },
      });
      if (created.error || !created.data.user) {
        throw new Error(`No se pudo crear usuario staging: ${created.error?.message}`);
      }
      userId = created.data.user.id;
    } else {
      await admin.auth.admin.updateUserById(userId, { password });
      const factors = await admin.auth.admin.mfa.listFactors({ userId });
      for (const f of [...(factors.data?.factors ?? [])]) {
        await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
      }
    }

    const { error } = await admin.from("admin_profiles").upsert(
      {
        id: userId,
        nombre: u.nombre,
        email: u.email,
        role: u.role,
        can_view_sensitive_cases: u.sensitive,
        mfa_required: true,
        active: true,
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Perfil staging: ${error.message}`);

    const userClient = createClient(url, anon, options as never);
    const signed = await userClient.auth.signInWithPassword({ email: u.email, password });
    if (signed.error) throw new Error(`login seed staging: ${signed.error.message}`);

    const enrolled = await userClient.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "staging-totp",
    });
    if (enrolled.error || !enrolled.data) {
      throw new Error(`mfa enroll staging: ${enrolled.error?.message}`);
    }
    const totpSecret = enrolled.data.totp.secret;
    const factorId = enrolled.data.id;
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(totpSecret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    const challenge = await userClient.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      throw new Error(`mfa challenge staging: ${challenge.error?.message}`);
    }
    const verified = await userClient.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: totp.generate(),
    });
    if (verified.error) throw new Error(`mfa verify staging: ${verified.error.message}`);
    await userClient.auth.signOut();

    credentials.push({ email: u.email, password, role: u.role, totpSecret });
  }

  const outDir = resolve(".tmp");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "staging-auth-credentials.json"),
    JSON.stringify(
      {
        createdAt: new Date().toString(),
        projectName: EXPECTED_NAME,
        fingerprint: createHash("sha256")
          .update(credentials.map((c) => c.email).join(","))
          .digest("hex")
          .slice(0, 12),
        users: credentials,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  console.log(`Seed staging OK: ${credentials.length} usuarios sintéticos (${SYNTH_DOMAIN}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "seed staging failed");
  process.exit(1);
});
