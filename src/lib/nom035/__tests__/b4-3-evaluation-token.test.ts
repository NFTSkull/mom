import { createHmac, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Pruebas del modelo de token. Configura peppers antes de importar el módulo
 * server-only (validación diferida de env).
 */
beforeAll(() => {
  process.env.NOM035_PUBLIC_EVALUATION_BACKEND = "supabase";
  process.env.NOM035_TOKEN_PEPPER = "test-token-pepper-" + randomBytes(16).toString("hex");
  process.env.NOM035_SESSION_PEPPER = "test-session-pepper-" + randomBytes(16).toString("hex");
  process.env.NOM035_RATE_LIMIT_PEPPER = "test-rate-pepper-" + randomBytes(16).toString("hex");
  process.env.NOM035_EVALUATION_SESSION_MINUTES = "120";
});

describe("B4.3 · evaluation-token", () => {
  it("genera tokens con prefijo, longitud y entropía estructural", async () => {
    const mod = await import("@/lib/nom035/server/evaluation-token");
    const a = mod.generateEvaluationToken();
    const b = mod.generateEvaluationToken();
    expect(a.token.startsWith(mod.EVALUATION_TOKEN_PREFIX)).toBe(true);
    expect(a.token.length).toBeGreaterThanOrEqual(mod.EVALUATION_TOKEN_MIN_LENGTH);
    expect(a.token.length).toBeLessThanOrEqual(mod.EVALUATION_TOKEN_MAX_LENGTH);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
    expect(a.tokenLast4).toHaveLength(4);
    expect(a.token).toContain(a.tokenLast4);
  });

  it("hash determinístico con el mismo pepper; distinto con peppers distintos", async () => {
    const mod = await import("@/lib/nom035/server/evaluation-token");
    const token = `ev_${randomBytes(32).toString("base64url")}`;
    const h1 = mod.hashEvaluationToken(token);
    const h2 = mod.hashEvaluationToken(token);
    expect(h1).toBe(h2);

    const pepper = process.env.NOM035_TOKEN_PEPPER!;
    process.env.NOM035_TOKEN_PEPPER = "otro-pepper-distinto-" + randomBytes(8).toString("hex");
    const h3 = mod.hashEvaluationToken(token);
    process.env.NOM035_TOKEN_PEPPER = pepper;
    expect(h3).not.toBe(h1);
  });

  it("no contiene workerId ni campaignId; valida forma", async () => {
    const mod = await import("@/lib/nom035/server/evaluation-token");
    const { token } = mod.generateEvaluationToken();
    expect(token).not.toMatch(/worker/i);
    expect(token).not.toMatch(/campaign/i);
    expect(mod.isWellFormedEvaluationToken(token)).toBe(true);
    expect(mod.isWellFormedEvaluationToken("corto")).toBe(false);
    expect(mod.isWellFormedEvaluationToken("xx_" + "a".repeat(80))).toBe(false);
    expect(mod.isWellFormedEvaluationToken("ev_" + "a".repeat(200))).toBe(false);
  });

  it("no usa Math.random (el hash coincide con HMAC-SHA-256 del pepper)", async () => {
    const mod = await import("@/lib/nom035/server/evaluation-token");
    const token = `ev_${randomBytes(32).toString("base64url")}`;
    const expected = createHmac("sha256", process.env.NOM035_TOKEN_PEPPER!)
      .update(token, "utf8")
      .digest("hex");
    expect(mod.hashEvaluationToken(token)).toBe(expected);
  });
});

describe("B4.3 · evaluation-session cookie", () => {
  it("cookie HttpOnly, SameSite Strict, Secure en producción, expiración", async () => {
    const mod = await import("@/lib/nom035/server/evaluation-session");
    const session = mod.generateEvaluationSession();
    expect(session.session.startsWith(mod.EVALUATION_SESSION_PREFIX)).toBe(true);
    expect(session.sessionHash).toHaveLength(64);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const opts = mod.buildSessionCookieOptions(session.expiresAt);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("strict");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBeGreaterThan(0);

    // Secure / nombre de cookie dependen de NODE_ENV (propiedad de solo lectura en tipos).
    // Verificamos el contrato de los builders de limpieza y los nombres exportados.
    expect(mod.EVALUATION_SESSION_COOKIE_PROD).toBe("__Host-nom035_eval_session");
    expect(mod.EVALUATION_SESSION_COOKIE_DEV).toBe("nom035_eval_session");
    expect(mod.buildClearedSessionCookieOptions().maxAge).toBe(0);
    expect(mod.buildClearedSessionCookieOptions().httpOnly).toBe(true);
    expect(mod.buildClearedSessionCookieOptions().sameSite).toBe("strict");
    // En el entorno de prueba (no production) Secure debe ser false.
    expect(opts.secure).toBe(process.env.NODE_ENV === "production");
    expect(mod.getSessionCookieName()).toBe(
      process.env.NODE_ENV === "production"
        ? mod.EVALUATION_SESSION_COOKIE_PROD
        : mod.EVALUATION_SESSION_COOKIE_DEV
    );
  });
});
