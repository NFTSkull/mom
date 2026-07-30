import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("B4.9 · portal trabajador (estático)", () => {
  it("migración 006 tiene RLS FORCE y uniques", () => {
    const sql = read("supabase/migrations/006_worker_auth_portal.sql");
    expect(sql).toMatch(/create table if not exists public\.worker_accounts/);
    expect(sql).toMatch(/force row level security/);
    expect(sql).toMatch(/worker_accounts_worker_id_unique/);
    expect(sql).toMatch(/worker_accounts_auth_user_id_unique/);
    expect(sql).toMatch(/worker_accounts_company_username_unique/);
    expect(sql).not.toMatch(/password\s+text/i);
  });

  it("login trabajador no menciona Guía III como implementada", () => {
    const login = read("src/app/trabajador/login/page.tsx");
    expect(login).not.toMatch(/Guía III implementada|GUIA_III completa/i);
  });

  it("API login no registra password", () => {
    const route = read("src/app/api/trabajador/login/route.ts");
    expect(route).not.toMatch(/console\.(log|info|debug).*password/i);
    expect(route).toContain("Usuario o contraseña incorrectos.");
  });

  it("abre evaluación vía motor existente contestar", () => {
    const open = read("src/app/api/trabajador/evaluacion/open/route.ts");
    expect(open).toContain("/evaluacion/contestar");
    expect(open).toContain("openWorkerEvaluationSession");
  });

  it("Guía III permanece P0 (sin archivos guia-iii)", () => {
    expect(existsSync(join(ROOT, "src/data/nom035/guia-iii.ts"))).toBe(false);
  });
});
