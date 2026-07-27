import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOM035_SCORING_VERSION } from "@/data/nom035/guia-ii-manifest";
import { ACTIVE_REPOSITORY_MODE } from "@/lib/nom035/repository";

const ROOT = process.cwd();

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

describe("B4.3 · seguridad estática", () => {
  it("ACTIVE_REPOSITORY_MODE general permanece local", () => {
    expect(ACTIVE_REPOSITORY_MODE).toBe("local");
  });

  it("scoringVersion certificado no cambió", () => {
    expect(NOM035_SCORING_VERSION).toBe("nom035-stps-2018-guia-i-ii-v1");
  });

  it("fuente canónica mantiene tamaño y SHA-256", () => {
    const buf = readFileSync(join(ROOT, "docs/source/NOM-035-STPS-2018-oficial.txt"));
    expect(buf.byteLength).toBe(220837);
    expect(createHash("sha256").update(buf).digest("hex")).toBe(
      "8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76"
    );
  });

  it("SUPABASE_SECRET_KEY y peppers no aparecen en src/app ni src/components", () => {
    const appFiles = walk(join(ROOT, "src/app"));
    let componentFiles: string[] = [];
    try {
      componentFiles = walk(join(ROOT, "src/components"));
    } catch {
      componentFiles = [];
    }
    const forbidden = [
      "SUPABASE_SECRET_KEY",
      "NOM035_TOKEN_PEPPER",
      "NOM035_SESSION_PEPPER",
      "NOM035_RATE_LIMIT_PEPPER",
    ];
    for (const file of [...appFiles, ...componentFiles]) {
      const content = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        expect(content.includes(needle), `${file} no debe contener ${needle}`).toBe(false);
      }
    }
  });

  it('ningún archivo "use client" importa admin.ts', () => {
    for (const file of walk(join(ROOT, "src"))) {
      const content = readFileSync(file, "utf8");
      if (!content.includes('"use client"') && !content.includes("'use client'")) continue;
      expect(content).not.toMatch(/from\s+["']@\/lib\/supabase\/admin["']/);
      expect(content).not.toMatch(/from\s+["'].*supabase\/admin["']/);
    }
  });

  it("la ruta del trabajador no importa el cliente Supabase de navegador ni localStorage", () => {
    const pages = [
      "src/app/evaluacion/[token]/page.tsx",
      "src/app/evaluacion/contestar/page.tsx",
      "src/app/evaluacion/gracias/page.tsx",
    ];
    for (const page of pages) {
      const content = read(page);
      expect(content).not.toMatch(/@\/lib\/supabase\/client/);
      expect(content).not.toMatch(/createBrowserClient|createClient/);
      expect(content).not.toMatch(/localStorage/);
      expect(content).not.toMatch(/sessionStorage/);
      expect(content).not.toMatch(/calculateGuiaIResult|calculateGuiaIIResult/);
    }
  });

  it("el endpoint submit no acepta finalScore del navegador como autoridad", () => {
    const submit = read("src/app/api/public/evaluations/submit/route.ts");
    const service = read("src/lib/nom035/server/public-evaluation-service.ts");
    expect(service).toMatch(/CLIENT_AUTHORITATIVE_FIELDS/);
    expect(service).toMatch(/finalScore/);
    expect(submit).toMatch(/prepareCanonicalSubmission/);
    expect(submit).not.toMatch(/body\.value\.finalScore/);
  });

  it("migración 002 no crea columna token en texto claro; sí token_hash", () => {
    const sql = read("supabase/migrations/002_public_evaluation_backend.sql");
    expect(sql).not.toMatch(/add column\s+token\s/i);
    expect(sql).toMatch(/session_hash/);
    expect(sql).toMatch(/token_hash/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/FORCE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/revoke all on function/i);
    expect(sql).toMatch(/grant execute on function .* to service_role/i);
  });

  it("módulos del flujo público usan import server-only", () => {
    const files = [
      "src/lib/nom035/server/evaluation-token.ts",
      "src/lib/nom035/server/evaluation-session.ts",
      "src/lib/nom035/server/public-evaluation-service.ts",
      "src/lib/nom035/server/public-rate-limit.ts",
      "src/lib/nom035/server/public-evaluation-backend.ts",
      "src/lib/nom035/server/api-helpers.ts",
    ];
    for (const file of files) {
      expect(read(file).startsWith('import "server-only"')).toBe(true);
    }
  });
});
