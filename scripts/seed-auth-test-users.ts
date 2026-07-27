/**
 * Seed de usuarios sintéticos @nom035.local para pruebas B4.6.
 * Se niega a ejecutarse contra URL no local.
 * Contraseñas + secretos TOTP solo en archivo temporal ignorado por Git.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as OTPAuth from "otpauth";

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
  } catch {
    // ignore
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

function strongPassword(): string {
  return `Aa1!${randomBytes(24).toString("base64url")}`;
}

const USERS = [
  { email: "admin@nom035.local", role: "admin", nombre: "Admin Prueba", sensitive: false },
  { email: "rh@nom035.local", role: "rh", nombre: "RH Prueba", sensitive: false },
  {
    email: "psicologo@nom035.local",
    role: "psicologo",
    nombre: "Psicologo Prueba",
    sensitive: true,
  },
  {
    email: "direccion@nom035.local",
    role: "direccion",
    nombre: "Direccion Prueba",
    sensitive: false,
  },
] as const;

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !anon) throw new Error("Falta configuración Supabase local");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url)) {
    throw new Error("auth:seed:test solo contra Supabase local");
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
        user_metadata: {},
      });
      if (created.error || !created.data.user) {
        throw new Error(`No se pudo crear ${u.email}: ${created.error?.message}`);
      }
      userId = created.data.user.id;
    } else {
      await admin.auth.admin.updateUserById(userId, { password });
      // Limpiar factores MFA previos
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
    if (error) throw new Error(`Perfil ${u.email}: ${error.message}`);

    // Enrolar TOTP con sesión de usuario (publishable key)
    const userClient = createClient(url, anon, options as never);
    const signed = await userClient.auth.signInWithPassword({ email: u.email, password });
    if (signed.error) throw new Error(`login seed ${u.email}: ${signed.error.message}`);

    const enrolled = await userClient.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "seed-totp",
    });
    if (enrolled.error || !enrolled.data) {
      throw new Error(`mfa enroll ${u.email}: ${enrolled.error?.message}`);
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
      throw new Error(`mfa challenge ${u.email}: ${challenge.error?.message}`);
    }
    const verified = await userClient.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: totp.generate(),
    });
    if (verified.error) {
      throw new Error(`mfa verify ${u.email}: ${verified.error.message}`);
    }
    await userClient.auth.signOut();

    credentials.push({ email: u.email, password, role: u.role, totpSecret });
  }

  const outDir = resolve(".tmp");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, "auth-test-credentials.json");
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
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
  console.log(`Seed OK: ${credentials.length} usuarios con MFA. Credenciales temporales listas.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "seed failed");
  process.exit(1);
});
