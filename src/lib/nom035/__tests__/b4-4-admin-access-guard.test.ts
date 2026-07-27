import { describe, expect, it } from "vitest";
import {
  evaluateAdminAccess,
  extractRequestHostname,
  isLoopbackHostname,
  parseAllowedOrigins,
} from "@/lib/nom035/server/admin-access-guard";

describe("B4.6 · admin-access-guard (auth_rbac)", () => {
  const allowed = ["http://localhost:3000", "http://127.0.0.1:3000"];

  it("permite GET con backend auth_rbac sin Origin", () => {
    const d = evaluateAdminAccess({
      method: "GET",
      hostname: "localhost",
      origin: null,
      backendMode: "auth_rbac",
      allowedOrigins: allowed,
    });
    expect(d).toEqual({ allowed: true });
  });

  it("permite host no-loopback: Auth/RBAC es la barrera (no localhost-only)", () => {
    const d = evaluateAdminAccess({
      method: "GET",
      hostname: "app.example.com",
      origin: null,
      backendMode: "auth_rbac",
      allowedOrigins: allowed,
    });
    expect(d).toEqual({ allowed: true });
  });

  it("rechaza Origin externo en mutaciones", () => {
    const d = evaluateAdminAccess({
      method: "POST",
      hostname: "localhost",
      origin: "https://evil.example.com",
      backendMode: "auth_rbac",
      allowedOrigins: allowed,
    });
    expect(d).toEqual({ allowed: false, reason: "origin_rejected" });
  });

  it("rechaza Origin ausente en mutaciones", () => {
    const d = evaluateAdminAccess({
      method: "PUT",
      hostname: "localhost",
      origin: null,
      backendMode: "auth_rbac",
      allowedOrigins: allowed,
    });
    expect(d).toEqual({ allowed: false, reason: "origin_missing" });
  });

  it("permite mutación con Origin permitido", () => {
    const d = evaluateAdminAccess({
      method: "POST",
      hostname: "localhost",
      origin: "http://localhost:3000",
      backendMode: "auth_rbac",
      allowedOrigins: allowed,
    });
    expect(d).toEqual({ allowed: true });
  });

  it("rechaza backend distinto de auth_rbac", () => {
    const d = evaluateAdminAccess({
      method: "GET",
      hostname: "localhost",
      origin: null,
      backendMode: "local_supabase",
      allowedOrigins: allowed,
    });
    expect(d).toEqual({ allowed: false, reason: "backend_disabled" });
  });

  it("extractRequestHostname ignora X-Forwarded-Host (solo Host)", () => {
    const req = new Request("http://localhost:3000/api/admin/nom035/dashboard", {
      headers: {
        Host: "localhost:3000",
        "X-Forwarded-Host": "evil.example.com",
      },
    });
    expect(extractRequestHostname(req)).toBe("localhost");
    expect(isLoopbackHostname(extractRequestHostname(req))).toBe(true);
  });

  it("parseAllowedOrigins normaliza CSV", () => {
    expect(parseAllowedOrigins("http://localhost:3000, http://127.0.0.1:3000")).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });
});
