import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ADMIN_ENDPOINT_PERMISSIONS,
  findEndpointPermission,
  normalizeAdminApiPath,
} from "@/lib/nom035/auth/endpoint-permissions";
import {
  APP_PERMISSIONS,
  permissionRequiresAal2,
  SENSITIVE_PERMISSIONS,
} from "@/lib/nom035/auth/permissions";
import { evaluateAdminAccess } from "@/lib/nom035/server/admin-access-guard";

function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkRoutes(full, acc);
    else if (name === "route.ts") acc.push(full);
  }
  return acc;
}

describe("B4.6 auth RBAC static", () => {
  it("manifiesto cubre todos los route handlers admin", () => {
    const root = "src/app/api/admin/nom035";
    const files = walkRoutes(root);
    expect(files.length).toBeGreaterThan(40);

    const methodsByFile = new Map<string, string[]>();
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) =>
        new RegExp(`export async function ${m}\\b`).test(content)
      );
      const rel = file
        .replace(/\\/g, "/")
        .replace(/^.*?src\/app/, "")
        .replace(/\/route\.ts$/, "");
      methodsByFile.set(rel, methods);
      expect(content).toMatch(/requireAdminApiAuth|requirePermission/);
      expect(content).not.toMatch(/getSession\(/);
    }

    for (const [path, methods] of methodsByFile) {
      for (const method of methods) {
        const rule = findEndpointPermission(method, path);
        expect(rule, `${method} ${path} sin manifiesto`).toBeTruthy();
      }
    }
  });

  it("permisos sensibles y AAL2 están tipados", () => {
    expect(APP_PERMISSIONS.length).toBe(31);
    expect(SENSITIVE_PERMISSIONS.has("results.individual.read")).toBe(true);
    expect(permissionRequiresAal2("users.manage")).toBe(true);
    expect(permissionRequiresAal2("dashboard.view")).toBe(false);
  });

  it("normalizeAdminApiPath sustituye UUIDs", () => {
    expect(
      normalizeAdminApiPath(
        "/api/admin/nom035/workers/11111111-1111-4111-8111-111111111111"
      )
    ).toBe("/api/admin/nom035/workers/[id]");
  });

  it("evaluateAdminAccess exige auth_rbac y Origin en mutaciones", () => {
    expect(
      evaluateAdminAccess({
        method: "GET",
        hostname: "example.com",
        origin: null,
        backendMode: "auth_rbac",
      }).allowed
    ).toBe(true);

    expect(
      evaluateAdminAccess({
        method: "POST",
        hostname: "example.com",
        origin: "http://localhost:3000",
        backendMode: "auth_rbac",
        allowedOrigins: ["http://localhost:3000"],
      }).allowed
    ).toBe(true);

    expect(
      evaluateAdminAccess({
        method: "POST",
        hostname: "example.com",
        origin: "https://evil.example",
        backendMode: "auth_rbac",
        allowedOrigins: ["http://localhost:3000"],
      }).allowed
    ).toBe(false);

    expect(
      evaluateAdminAccess({
        method: "GET",
        hostname: "localhost",
        origin: null,
        backendMode: "local_supabase",
      }).allowed
    ).toBe(false);
  });

  it("proxy usa getClaims y no getSession", () => {
    const proxy = readFileSync("src/lib/supabase/proxy.ts", "utf8");
    expect(proxy).toMatch(/getClaims/);
    expect(proxy).not.toMatch(/getSession/);
    const rootProxy = readFileSync("src/proxy.ts", "utf8");
    expect(rootProxy).toMatch(/updateSession/);
    expect(rootProxy).not.toMatch(/getSession/);
  });

  it("require-admin-auth no usa getSession como autoridad", () => {
    const content = readFileSync("src/lib/nom035/server/require-admin-auth.ts", "utf8");
    expect(content).toMatch(/getClaims|getVerifiedClaims/);
    expect(content).not.toMatch(/\.getSession\s*\(/);
  });

  it("no hay signup público en UI login", () => {
    const login = readFileSync("src/app/login/page.tsx", "utf8");
    expect(login.toLowerCase()).not.toMatch(/sign\s*up|registrarse|crear cuenta/);
    expect(login).toMatch(/No hay registro público/);
  });

  it("manifiesto no está vacío y incluye users/audit", () => {
    expect(ADMIN_ENDPOINT_PERMISSIONS.length).toBeGreaterThan(50);
    expect(
      ADMIN_ENDPOINT_PERMISSIONS.some((r) => r.pathPattern.includes("/users"))
    ).toBe(true);
    expect(
      ADMIN_ENDPOINT_PERMISSIONS.some((r) => r.pathPattern.includes("/audit"))
    ).toBe(true);
  });

  it("servicios ordinarios no importan admin client (allowlist)", () => {
    const allow = new Set([
      "src/lib/nom035/server/evidence-storage-service.ts",
      "src/lib/nom035/server/public-evaluation-backend.ts",
      "src/lib/nom035/server/public-rate-limit.ts",
      "src/lib/supabase/admin.ts",
      "src/lib/nom035/server/complaint-service.ts", // public_submit
    ]);
    for (const file of [
      "src/lib/nom035/server/admin-core-service.ts",
      "src/lib/nom035/server/admin-campaign-service.ts",
      "src/lib/nom035/server/action-plan-service.ts",
      "src/lib/nom035/server/policy-service.ts",
      "src/lib/nom035/server/evidence-service.ts",
    ]) {
      const content = readFileSync(file, "utf8");
      expect(content).toMatch(/createSupabaseServerClient/);
      expect(content).not.toMatch(/createSupabaseAdminClient/);
    }
    for (const file of allow) {
      expect(readFileSync(file, "utf8")).toMatch(/createSupabaseAdminClient/);
    }
  });
});
