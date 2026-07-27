import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOM035_SCORING_VERSION } from "@/data/nom035/guia-ii-manifest";
import { ACTIVE_REPOSITORY_MODE } from "@/lib/nom035/repository";

const ROOT = process.cwd();

const MIGRATED_PAGES = [
  "src/app/admin/page.tsx",
  "src/app/admin/configuracion/page.tsx",
  "src/app/admin/trabajadores/page.tsx",
  "src/app/admin/campanas/page.tsx",
  "src/app/admin/resultados/page.tsx",
  "src/app/admin/reportes/page.tsx",
];

// B4.5 migró estos módulos; la aserción de "siguen en localStorage" ya no aplica.
// Ver b4-5-security-static.test.ts.

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) acc.push(full);
  }
  return acc;
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("B4.4 · seguridad estática admin", () => {
  it("ACTIVE_REPOSITORY_MODE general permanece local", () => {
    expect(ACTIVE_REPOSITORY_MODE).toBe("local");
  });

  it("scoringVersion certificado no cambió", () => {
    expect(NOM035_SCORING_VERSION).toBe("nom035-stps-2018-guia-i-ii-v1");
  });

  it("fuente canónica intacta", () => {
    const buf = readFileSync(join(ROOT, "docs/source/NOM-035-STPS-2018-oficial.txt"));
    expect(buf.byteLength).toBe(220837);
    expect(createHash("sha256").update(buf).digest("hex")).toBe(
      "8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76"
    );
  });

  it("páginas migradas B4.4 no importan storage-local, demo-data ni mocks", () => {
    for (const page of MIGRATED_PAGES) {
      const content = read(page);
      expect(content, page).not.toMatch(/storage-local/);
      expect(content, page).not.toMatch(/local-repository/);
      expect(content, page).not.toMatch(/demo-data/);
      expect(content, page).not.toMatch(/mock-workers|mock-campaigns|mock-results/);
      expect(content, page).not.toMatch(/\blocalStorage\b/);
      expect(content, page).not.toMatch(/\bsessionStorage\b/);
      expect(content, page).not.toMatch(/calculateGuiaIResult|calculateGuiaIIResult/);
    }
  });

  it("endpoints admin usan cliente server-only, no browser", () => {
    const adminApiDir = join(ROOT, "src/app/api/admin");
    for (const file of walk(adminApiDir)) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/@\/lib\/supabase\/client/);
      expect(content).not.toMatch(/createBrowserClient/);
      expect(content).toMatch(/requireAdminApiAuth|requireAdminAccess|admin-access-guard/);
    }
  });

  it('ningún "use client" importa admin.ts de supabase', () => {
    for (const file of walk(join(ROOT, "src"))) {
      const content = readFileSync(file, "utf8");
      if (!content.includes('"use client"') && !content.includes("'use client'")) continue;
      expect(content).not.toMatch(/from\s+["']@\/lib\/supabase\/admin["']/);
    }
  });

  it("SUPABASE_SECRET_KEY y peppers no aparecen en app/components", () => {
    const forbidden = [
      "SUPABASE_SECRET_KEY",
      "NOM035_TOKEN_PEPPER",
      "NOM035_SESSION_PEPPER",
      "NOM035_RATE_LIMIT_PEPPER",
    ];
    for (const file of [...walk(join(ROOT, "src/app")), ...walk(join(ROOT, "src/components"))]) {
      const content = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        expect(content.includes(needle), `${file} ${needle}`).toBe(false);
      }
    }
  });

  it("banner admin local no se oculta con display:none", () => {
    const banner = read("src/components/admin/admin-local-banner.tsx");
    expect(banner).toContain("Entorno administrativo local conectado a Supabase");
    expect(banner).not.toMatch(/display:\s*none|hidden|sr-only/);
    expect(banner).toMatch(/visibility:\s*"visible"/);
  });

  it("guard exige auth_rbac y valida Origin", () => {
    const guard = read("src/lib/nom035/server/admin-access-guard.ts");
    expect(guard).toMatch(/auth_rbac/);
    expect(guard).toMatch(/backend_disabled/);
    expect(guard).toMatch(/X-Forwarded-Host/);
    expect(guard).toMatch(/origin_missing/);
    expect(guard).not.toMatch(/production_blocked/);
  });

  it("migración 003 no almacena token en texto claro", () => {
    const sql = read("supabase/migrations/003_admin_core_backend.sql");
    expect(sql).not.toMatch(/add column\s+token\s/i);
    expect(sql).toMatch(/token_hash/);
    expect(sql).toMatch(/admin_issue_assignment/);
  });
});
