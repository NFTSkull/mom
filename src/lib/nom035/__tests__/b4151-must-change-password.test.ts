import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("B4.15.1 — cambio de contraseña no obligatorio", () => {
  it("login redirige a /trabajador cuando mustChangePassword es false", () => {
    const src = readFileSync(
      resolve("src/app/trabajador/login/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(
      /data\.mustChangePassword \? "\/trabajador\/cambiar-contrasena" : "\/trabajador"/
    );
  });

  it("creación de cuentas 83 usa must_change_password=false", () => {
    const src = readFileSync(
      resolve("scripts/b414-create-worker-accounts-83.ts"),
      "utf8"
    );
    expect(src).toMatch(/must_change_password:\s*false/);
    expect(src).not.toMatch(/must_change_password:\s*true/);
  });

  it("migración 008 fija default false", () => {
    const src = readFileSync(
      resolve(
        "supabase/migrations/008_worker_must_change_password_default_false.sql"
      ),
      "utf8"
    );
    expect(src).toMatch(/set default false/i);
  });
});
