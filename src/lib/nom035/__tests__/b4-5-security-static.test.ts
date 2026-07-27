import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOM035_SCORING_VERSION } from "@/data/nom035/guia-ii-manifest";
import { ACTIVE_REPOSITORY_MODE } from "@/lib/nom035/repository";

const ROOT = process.cwd();

const MIGRATED_B45 = [
  "src/app/admin/plan-accion/page.tsx",
  "src/app/admin/evidencias/page.tsx",
  "src/app/admin/quejas/page.tsx",
  "src/app/admin/politica/page.tsx",
  "src/app/queja-confidencial/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/admin/reportes/page.tsx",
];

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

describe("B4.5 · seguridad estática módulos secundarios", () => {
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

  it("páginas B4.5 no usan localStorage/mocks/storage-local", () => {
    for (const page of MIGRATED_B45) {
      const content = read(page);
      expect(content, page).not.toMatch(/storage-local/);
      expect(content, page).not.toMatch(/local-repository/);
      expect(content, page).not.toMatch(/demo-data/);
      expect(content, page).not.toMatch(/mock-company|mock-workers|mock-campaigns/);
      expect(content, page).not.toMatch(/\blocalStorage\b/);
      expect(content, page).not.toMatch(/\bsessionStorage\b/);
    }
  });

  it("política no usa dangerouslySetInnerHTML", () => {
    expect(read("src/app/admin/politica/page.tsx")).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("listado de quejas admin no renderiza contacto en tabla", () => {
    const content = read("src/app/admin/quejas/page.tsx");
    expect(content).toMatch(/complaint-table/);
    // El contacto solo aparece en el panel de detalle.
    expect(content).toMatch(/complaint-contact/);
    expect(content).toMatch(/complaint-detail/);
  });

  it("admin.ts no se importa desde páginas use client", () => {
    for (const page of MIGRATED_B45) {
      const content = read(page);
      expect(content, page).not.toMatch(/@\/lib\/supabase\/admin/);
      expect(content, page).not.toMatch(/SUPABASE_SECRET_KEY/);
      expect(content, page).not.toMatch(/NOM035_TOKEN_PEPPER|NOM035_SESSION_PEPPER|NOM035_RATE_LIMIT_PEPPER/);
    }
  });

  it("evidencias no permiten SVG/HTML/octet-stream", () => {
    const validator = read("src/lib/nom035/server/evidence-file-validator.ts");
    expect(validator).toMatch(/application\/pdf/);
    expect(validator).toMatch(/image\/jpeg/);
    expect(validator).toMatch(/image\/png/);
    expect(validator).not.toMatch(/image\/svg/);
    expect(validator).not.toMatch(/text\/html/);
    expect(validator).not.toMatch(/octet-stream/);
  });

  it("migración 004 crea bucket privado", () => {
    const mig = read("supabase/migrations/004_secondary_modules_and_storage.sql");
    expect(mig).toMatch(/nom035-evidence/);
    expect(mig).toMatch(/public\s*=\s*false/);
    expect(mig).toMatch(/15728640/);
    expect(mig).not.toMatch(/signed_url/);
    expect(mig).not.toMatch(/file_url/);
  });

  it("RPCs B4.5 solo service_role (REVOKE anon/authenticated)", () => {
    const mig = read("supabase/migrations/004_secondary_modules_and_storage.sql");
    expect(mig).toMatch(/public_submit_confidential_complaint/);
    expect(mig).toMatch(/admin_generate_suggested_action_plans/);
    expect(mig).toMatch(/GRANT EXECUTE[\s\S]*service_role/);
  });

  it("endpoints evidence no usan cliente browser de supabase", () => {
    for (const file of walk(join(ROOT, "src/app/api/admin/nom035/evidence"))) {
      const content = readFileSync(file, "utf8");
      expect(content, file).not.toMatch(/@\/lib\/supabase\/client/);
      expect(content, file).not.toMatch(/createBrowserClient/);
    }
  });

  it("servicios B4.5 son server-only", () => {
    for (const rel of [
      "src/lib/nom035/server/action-plan-service.ts",
      "src/lib/nom035/server/evidence-service.ts",
      "src/lib/nom035/server/evidence-file-validator.ts",
      "src/lib/nom035/server/evidence-storage-service.ts",
      "src/lib/nom035/server/complaint-service.ts",
      "src/lib/nom035/server/policy-service.ts",
    ]) {
      expect(read(rel), rel).toMatch(/import "server-only"/);
    }
  });

  it("no se persiste URL firmada en servicios de evidencia", () => {
    const svc = read("src/lib/nom035/server/evidence-service.ts");
    expect(svc).toMatch(/evidence\.downloaded/);
    expect(svc).not.toMatch(/signedUrl.*insert|insert.*signedUrl/i);
    expect(svc).not.toMatch(/base64/);
  });
});
