import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVE_REPOSITORY_MODE } from "../repository";
import {
  GUIA_II_MANIFEST,
  GUIA_II_DIRECT_SCORED_ITEMS,
  GUIA_II_REVERSE_SCORED_ITEMS,
  NOM035_SCORING_VERSION,
} from "@/data/nom035/guia-ii-manifest";

const ROOT = path.resolve(__dirname, "../../../..");
const SOURCE = path.join(ROOT, "docs/source/NOM-035-STPS-2018-oficial.txt");
const EXPECTED_SHA =
  "8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76";

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe("B4.2 · secretos fuera del cliente", () => {
  const appFiles = walk(path.join(ROOT, "src/app"));
  const componentFiles = walk(path.join(ROOT, "src/components"));
  const clientFiles = [...appFiles, ...componentFiles];

  it("SUPABASE_SECRET_KEY no aparece en src/app ni src/components", () => {
    for (const file of clientFiles) {
      expect(readFileSync(file, "utf8").includes("SUPABASE_SECRET_KEY")).toBe(false);
    }
  });

  it("NOM035_TOKEN_PEPPER no aparece en el cliente", () => {
    for (const file of clientFiles) {
      expect(readFileSync(file, "utf8").includes("NOM035_TOKEN_PEPPER")).toBe(false);
    }
  });

  it("ningún componente importa el cliente service role (admin.ts)", () => {
    for (const file of clientFiles) {
      // B4.6: Route Handlers de aprovisionamiento pueden usar admin server-only.
      if (file.includes(`${path.sep}api${path.sep}`)) continue;
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/supabase\/admin/);
      expect(content).not.toMatch(/createSupabaseAdminClient/);
    }
  });

  it("ninguna página/componente existente accede todavía a Supabase", () => {
    for (const file of clientFiles) {
      if (file.includes(`${path.sep}api${path.sep}`)) continue;
      if (file.includes(`${path.sep}login${path.sep}`)) continue;
      if (file.includes(`${path.sep}auth${path.sep}`)) continue;
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/@\/lib\/supabase\//);
      expect(content).not.toMatch(/@supabase\//);
    }
  });

  it("no se expone secret key ni pepper con prefijo NEXT_PUBLIC", () => {
    const env = readFileSync(path.join(ROOT, "src/lib/env.ts"), "utf8");
    expect(env).not.toMatch(/NEXT_PUBLIC_SUPABASE_SECRET/);
    expect(env).not.toMatch(/NEXT_PUBLIC_NOM035_TOKEN_PEPPER/);
  });
});

describe("B4.2 · repository sigue local", () => {
  it("ACTIVE_REPOSITORY_MODE es local", () => {
    expect(ACTIVE_REPOSITORY_MODE).toBe("local");
  });
});

describe("B4.2 · B4.1 intacto (scoring + fuente + manifiesto)", () => {
  it("la versión de scoring certificada no cambió", () => {
    expect(NOM035_SCORING_VERSION).toBe("nom035-stps-2018-guia-i-ii-v1");
  });

  it("la fuente canónica conserva tamaño y SHA-256", () => {
    expect(existsSync(SOURCE)).toBe(true);
    expect(statSync(SOURCE).size).toBe(220837);
    const hash = createHash("sha256").update(readFileSync(SOURCE)).digest("hex");
    expect(hash).toBe(EXPECTED_SHA);
  });

  it("el manifiesto Guía II no fue alterado (46 = 30 directos + 16 invertidos)", () => {
    expect(GUIA_II_MANIFEST.length).toBe(46);
    expect(GUIA_II_DIRECT_SCORED_ITEMS.size).toBe(30);
    expect(GUIA_II_REVERSE_SCORED_ITEMS.size).toBe(16);
    expect(GUIA_II_MANIFEST.filter((i) => i.gate).length).toBe(6);
  });
});
