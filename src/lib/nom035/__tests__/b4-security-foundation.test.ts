import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVE_REPOSITORY_MODE, getNom035Repository, localRepository } from "../repository";

const ROOT = path.resolve(__dirname, "../../../..");
const MIGRATION = path.join(ROOT, "supabase/migrations/001_nom035_initial_schema.sql");

const DOMAIN_TABLES = [
  "company_settings",
  "admin_profiles",
  "workers",
  "evaluation_campaigns",
  "evaluation_assignments",
  "evaluation_answers",
  "evaluation_results",
  "action_plans",
  "evidence_items",
  "confidential_complaints",
  "policy_documents",
  "audit_log",
] as const;

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkSourceFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("B4.0 schema security (migración estática)", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("existe la migración inicial", () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  it("habilita RLS en todas las tablas del dominio", () => {
    for (const table of DOMAIN_TABLES) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} force row level security`, "i"));
    }
  });

  it("no define políticas permisivas para anon", () => {
    expect(sql.toLowerCase()).not.toMatch(/create policy[\s\S]{0,200}\banon\b/);
    expect(sql.toLowerCase()).not.toMatch(/to\s+anon/);
    expect(sql.toLowerCase()).not.toMatch(/using\s*\(\s*true\s*\)/);
  });

  it("revoca acceso a anon y authenticated en tablas sensibles", () => {
    expect(sql).toMatch(/revoke all on table public\.workers from anon,\s*authenticated/i);
    expect(sql).toMatch(/revoke all on table public\.evaluation_answers from anon,\s*authenticated/i);
    expect(sql).toMatch(/revoke all on table public\.evaluation_results from anon,\s*authenticated/i);
    expect(sql).toMatch(/revoke all on table public\.confidential_complaints from anon,\s*authenticated/i);
  });

  it("usa token_hash y no columna token en texto plano en assignments", () => {
    expect(sql).toMatch(/token_hash text not null/i);
    expect(sql).toMatch(/token_last4 text not null/i);
    expect(sql).not.toMatch(/evaluation_assignments[\s\S]{0,800}\btoken text\b/i);
  });

  it("tiene unicidad campaign_id+worker_id, resultado/assignment y respuesta/pregunta", () => {
    expect(sql).toMatch(/unique\s*\(\s*campaign_id\s*,\s*worker_id\s*\)/i);
    expect(sql).toMatch(/assignment_id uuid not null unique references public\.evaluation_assignments/i);
    expect(sql).toMatch(
      /unique\s*\(\s*assignment_id\s*,\s*questionnaire_code\s*,\s*question_id\s*\)/i
    );
  });

  it("documenta singleton de company_settings", () => {
    expect(sql).toMatch(/singleton_lock/i);
    expect(sql).toMatch(/company_settings_singleton unique/i);
  });
});

describe("B4.0 secretos y límites de importación", () => {
  it("SUPABASE_SECRET_KEY no aparece en src/app ni src/components", () => {
    const files = [
      ...walkSourceFiles(path.join(ROOT, "src/app")),
      ...walkSourceFiles(path.join(ROOT, "src/components")),
    ];
    const allowAdminClient = [
      `${path.sep}api${path.sep}admin${path.sep}nom035${path.sep}users${path.sep}`,
    ];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content.includes("SUPABASE_SECRET_KEY")).toBe(false);
      const allowed = allowAdminClient.some((p) => file.includes(p));
      if (!allowed) {
        expect(content.includes("createSupabaseAdminClient")).toBe(false);
        expect(content.includes("@/lib/supabase/admin")).toBe(false);
        expect(content.includes("lib/supabase/admin")).toBe(false);
      }
    }
  });

  it('ningún archivo "use client" importa admin.ts', () => {
    const files = [
      ...walkSourceFiles(path.join(ROOT, "src/app")),
      ...walkSourceFiles(path.join(ROOT, "src/components")),
      ...walkSourceFiles(path.join(ROOT, "src/lib")).filter(
        (file) => !file.includes(`${path.sep}__tests__${path.sep}`)
      ),
    ];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (!/^["']use client["']/m.test(content)) continue;
      expect(content).not.toMatch(/from\s+["']@\/lib\/supabase\/admin["']/);
      expect(content).not.toMatch(/from\s+["']\.\.?\/.*supabase\/admin["']/);
      expect(content).not.toMatch(/createSupabaseAdminClient/);
    }
  });

  it("admin.ts está marcado server-only", () => {
    const admin = readFileSync(path.join(ROOT, "src/lib/supabase/admin.ts"), "utf8");
    expect(admin).toMatch(/import\s+["']server-only["']/);
  });
});

describe("B4.0 repository mode", () => {
  it("ACTIVE_REPOSITORY_MODE es local y getNom035Repository usa localRepository", () => {
    expect(ACTIVE_REPOSITORY_MODE).toBe("local");
    expect(getNom035Repository()).toBe(localRepository);
    expect(localRepository.mode).toBe("local");
  });
});
