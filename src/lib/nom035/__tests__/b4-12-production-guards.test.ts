import { afterEach, describe, expect, it } from "vitest";
import {
  ALLOW_PRODUCTION_PILOT_VALUE,
  assertAllowProductionPilot,
  assertProductionPilotGuards,
  assertRefsMatch,
  extractProjectRefFromUrl,
  sanitizeRef,
} from "../../../../scripts/lib/assert-production-only";
import {
  assertCleanupTarget,
  assertExactPilotCampaign,
  assertExactPilotWorkerRef,
  assertLogHasNoSecrets,
  assertNoCsvImport,
  assertNotMassOperation,
  assertSinglePilotCount,
  assertTempCredsAbsent,
  isPilotDryRun,
  redactSecretsFromText,
} from "../../../../scripts/lib/b412-pilot-policy";
import {
  B412_PILOT_CAMPAIGN,
  B412_PILOT_REF,
} from "../../../../scripts/lib/b412-pilot-constants";

const FAKE_EXPECTED = "agblxxxxxxxxxxxxkubf";

function pilotEnv(extra: Record<string, string> = {}) {
  return {
    ALLOW_PRODUCTION_PILOT: ALLOW_PRODUCTION_PILOT_VALUE,
    EXPECTED_SUPABASE_PROJECT_REF: FAKE_EXPECTED,
    CONFIRM_SUPABASE_PROJECT_REF: FAKE_EXPECTED,
    NOM035_TARGET_ENV: "production",
    ...extra,
  };
}

afterEach(() => {
  delete process.env.ALLOW_PRODUCTION_PILOT;
  delete process.env.EXPECTED_SUPABASE_PROJECT_REF;
  delete process.env.CONFIRM_SUPABASE_PROJECT_REF;
  delete process.env.NOM035_TARGET_ENV;
  delete process.env.B412_PILOT_DRY_RUN;
  delete process.env.WORKERS_CSV;
});

describe("B4.12.1 production pilot guards", () => {
  it("1. rechaza localhost en modo Production", () => {
    expect(() =>
      assertProductionPilotGuards({
        url: "http://127.0.0.1:54321",
        env: pilotEnv(),
      })
    ).toThrow(/localhost/);
  });

  it("2. rechaza ConCasa", () => {
    const concasaRef = "fvtqxxxxxxxxxxxxvwzy";
    expect(() =>
      assertRefsMatch({
        urlRef: concasaRef,
        expected: concasaRef,
        confirmed: concasaRef,
      })
    ).toThrow(/ConCasa|no autorizado|prohibido/);
    expect(() =>
      extractProjectRefFromUrl("https://xxx.concasa.example/supabase")
    ).toThrow(/ConCasa|ajeno|supabase\.co/);
  });

  it("3. rechaza Project ref incorrecto", () => {
    expect(() =>
      assertProductionPilotGuards({
        url: `https://${FAKE_EXPECTED}.supabase.co`,
        env: pilotEnv({ CONFIRM_SUPABASE_PROJECT_REF: "agblyyyywrongkkubf" }),
      })
    ).toThrow(/CONFIRM|EXPECTED|≠/);
  });

  it("4. rechaza confirmación ausente", () => {
    expect(() =>
      assertProductionPilotGuards({
        url: `https://${FAKE_EXPECTED}.supabase.co`,
        env: pilotEnv({ CONFIRM_SUPABASE_PROJECT_REF: "" }),
      })
    ).toThrow(/CONFIRM_SUPABASE_PROJECT_REF/);
  });

  it("5. rechaza confirmación genérica", () => {
    expect(() => assertAllowProductionPilot({ ALLOW_PRODUCTION_PILOT: "yes" })).toThrow(
      /B412_PILOT_ONLY/
    );
    expect(() => assertAllowProductionPilot({ ALLOW_PRODUCTION_PILOT: "true" })).toThrow(
      /B412_PILOT_ONLY/
    );
    expect(() =>
      assertRefsMatch({
        urlRef: FAKE_EXPECTED,
        expected: FAKE_EXPECTED,
        confirmed: "YES",
      })
    ).toThrow(/genérica/);
  });

  it("6. rechaza operación masiva", () => {
    expect(() => assertNotMassOperation(83, 1)).toThrow(/masiva/);
  });

  it("7. rechaza trabajador no sintético", () => {
    expect(() => assertExactPilotWorkerRef("0003")).toThrow(/piloto|sintético/);
    expect(() => assertSinglePilotCount(["0003"])).toThrow(/no sintético/);
  });

  it("8. rechaza más de un piloto", () => {
    expect(() =>
      assertSinglePilotCount(["TST-PROD-PILOT-001", "TST-PROD-PILOT-002"])
    ).toThrow(/más de un piloto/);
  });

  it("9. dry-run no escribe (flag)", () => {
    expect(isPilotDryRun({ B412_PILOT_DRY_RUN: "1" })).toBe(true);
    expect(isPilotDryRun({})).toBe(false);
  });

  it("10. cleanup solo elimina el piloto (marcadores exactos)", () => {
    expect(() => assertCleanupTarget({ workerRef: "0001" })).toThrow(/ajen/);
    expect(() => assertCleanupTarget({ campaignName: "REAL" })).toThrow(/ajen/);
    expect(() =>
      assertCleanupTarget({
        workerRef: B412_PILOT_REF,
        campaignName: B412_PILOT_CAMPAIGN,
      })
    ).not.toThrow();
  });

  it("11. segunda validación de marcadores es idempotente", () => {
    assertExactPilotWorkerRef(B412_PILOT_REF);
    assertExactPilotWorkerRef(B412_PILOT_REF);
    assertExactPilotCampaign(B412_PILOT_CAMPAIGN);
    assertExactPilotCampaign(B412_PILOT_CAMPAIGN);
  });

  it("12. cero secretos en stdout/stderr", () => {
    expect(() =>
      assertLogHasNoSecrets('{"ok":true,"password":"Nom035-Pilot#abc"}')
    ).toThrow(/password/);
    expect(() => assertLogHasNoSecrets("token ghp_" + "a".repeat(36))).toThrow(/token/);
    expect(() => assertLogHasNoSecrets('{"ok":true,"passwordPrinted":false}')).not.toThrow();
  });

  it("13-14. credenciales temporales deben ausentarse al finalizar", () => {
    expect(() => assertTempCredsAbsent(true)).toThrow(/temporales/);
    expect(() => assertTempCredsAbsent(false)).not.toThrow();
  });

  it("15. error intermedio: CSV y allow ausente abortan antes de mutar", () => {
    expect(() => assertNoCsvImport({ WORKERS_CSV: "/tmp/x.csv" })).toThrow(/CSV/);
    expect(() => assertAllowProductionPilot({})).toThrow(/ALLOW_PRODUCTION_PILOT/);
  });

  it("acepta identidad válida (sin Cloud)", () => {
    const r = assertProductionPilotGuards({
      url: `https://${FAKE_EXPECTED}.supabase.co`,
      env: pilotEnv(),
    });
    expect(r.sanitized).toBe("agbl…kubf");
    expect(sanitizeRef(FAKE_EXPECTED)).toBe("agbl…kubf");
  });

  it("redacta JWT en texto", () => {
    const header = "eyJ" + "hbGciOiJIUzI1NiJ9";
    const payload = "eyJ" + "zdWIiOiIxIn0";
    const jwt = `${header}.${payload}.sig`;
    expect(redactSecretsFromText(`Bearer ${jwt}`)).toContain("[REDACTED_JWT]");
  });

  it("rechaza campaña ajena", () => {
    expect(() => assertExactPilotCampaign("CAMPANA_REAL")).toThrow(/piloto/);
  });
});
