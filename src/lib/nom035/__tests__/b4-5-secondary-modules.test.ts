import { describe, expect, it } from "vitest";
import {
  buildStoragePath,
  computeSha256,
  matchesMagicBytes,
  sanitizeFileName,
  validateEvidenceFile,
} from "@/lib/nom035/server/evidence-file-validator";
import {
  actionPlanCreateSchema,
  actionPlanGenerateSchema,
  actionPlanStatusSchema,
} from "@/lib/nom035/server/action-plan-service";
import {
  publicComplaintSchema,
  complaintAssignSchema,
} from "@/lib/nom035/server/complaint-service";
import {
  policyDraftCreateSchema,
} from "@/lib/nom035/server/policy-service";
import { evidenceExternalSchema as evExt } from "@/lib/nom035/server/evidence-service";
import { evaluateAdminAccess } from "@/lib/nom035/server/admin-access-guard";
import { getEvidenceStorageEnv, getPublicComplaintEnv } from "@/lib/env";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

describe("B4.5 · evidence-file-validator", () => {
  it("acepta PDF con magic bytes %PDF-", () => {
    expect(matchesMagicBytes("application/pdf", PDF)).toBe(true);
    const r = validateEvidenceFile({
      originalFileName: "reporte.pdf",
      declaredMime: "application/pdf",
      bytes: PDF,
      maxBytes: 15_728_640,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sha256).toHaveLength(64);
      expect(r.safeFileName).toMatch(/\.pdf$/);
    }
  });

  it("acepta JPEG y PNG por magic bytes", () => {
    expect(matchesMagicBytes("image/jpeg", JPEG)).toBe(true);
    expect(matchesMagicBytes("image/png", PNG)).toBe(true);
  });

  it("rechaza SVG aunque se declare como png", () => {
    const r = validateEvidenceFile({
      originalFileName: "x.png",
      declaredMime: "image/png",
      bytes: SVG,
      maxBytes: 15_728_640,
    });
    expect(r).toEqual({ ok: false, code: "magic_bytes_mismatch" });
  });

  it("rechaza MIME no permitido", () => {
    const r = validateEvidenceFile({
      originalFileName: "x.svg",
      declaredMime: "image/svg+xml",
      bytes: SVG,
      maxBytes: 15_728_640,
    });
    expect(r).toEqual({ ok: false, code: "mime_not_allowed" });
  });

  it("rechaza MIME/extensión incompatibles", () => {
    const r = validateEvidenceFile({
      originalFileName: "foto.jpg",
      declaredMime: "application/pdf",
      bytes: PDF,
      maxBytes: 15_728_640,
    });
    expect(r).toEqual({ ok: false, code: "mime_extension_mismatch" });
  });

  it("rechaza doble extensión sospechosa", () => {
    const r = validateEvidenceFile({
      originalFileName: "reporte.exe.pdf",
      declaredMime: "application/pdf",
      bytes: PDF,
      maxBytes: 15_728_640,
    });
    expect(r).toEqual({ ok: false, code: "double_extension" });
  });

  it("rechaza path traversal y archivo vacío/grande", () => {
    expect(
      validateEvidenceFile({
        originalFileName: "../etc/passwd.pdf",
        declaredMime: "application/pdf",
        bytes: PDF,
        maxBytes: 15_728_640,
      }).ok
    ).toBe(false);
    expect(
      validateEvidenceFile({
        originalFileName: "a.pdf",
        declaredMime: "application/pdf",
        bytes: new Uint8Array(),
        maxBytes: 15_728_640,
      })
    ).toEqual({ ok: false, code: "empty_file" });
    expect(
      validateEvidenceFile({
        originalFileName: "a.pdf",
        declaredMime: "application/pdf",
        bytes: PDF,
        maxBytes: 4,
      })
    ).toEqual({ ok: false, code: "file_too_large" });
  });

  it("sanitiza nombre y genera path server-only", () => {
    const safe = sanitizeFileName("Mi Reporte!!!.PDF", "application/pdf");
    expect(safe).toMatch(/\.pdf$/);
    expect(safe).not.toMatch(/!/);
    const path = buildStoragePath(safe);
    expect(path).toMatch(/^company\/evidence\/\d{4}\/\d{2}\/[0-9a-f-]{36}\//);
    expect(path).not.toMatch(/\.\./);
  });

  it("SHA-256 estable", () => {
    expect(computeSha256(PDF)).toBe(computeSha256(PDF));
    expect(computeSha256(PDF)).toHaveLength(64);
  });
});

const SAMPLE_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("B4.5 · action-plan schemas", () => {
  it("valida creación manual", () => {
    const r = actionPlanCreateSchema.safeParse({
      campaignId: SAMPLE_UUID,
      area: "RH",
      riskFactor: "Carga",
      riskLevel: "alto",
      actionLevel: "primer_nivel",
      actionType: "organizacional",
      description: "Revisar cargas",
      responsible: "RH",
      dueDate: "2026-08-01",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza campos desconocidos", () => {
    const r = actionPlanCreateSchema.safeParse({
      campaignId: SAMPLE_UUID,
      area: "RH",
      riskFactor: "Carga",
      riskLevel: "alto",
      actionLevel: "primer_nivel",
      actionType: "organizacional",
      description: "x",
      responsible: "RH",
      secret: "no",
    });
    expect(r.success).toBe(false);
  });

  it("valida generación y estados", () => {
    expect(
      actionPlanGenerateSchema.safeParse({
        campaignId: SAMPLE_UUID,
      }).success
    ).toBe(true);
    expect(actionPlanStatusSchema.safeParse({ status: "completada" }).success).toBe(true);
    expect(actionPlanStatusSchema.safeParse({ status: "bogus" }).success).toBe(false);
  });
});

describe("B4.5 · complaint schemas", () => {
  it("acepta anónima válida", () => {
    const r = publicComplaintSchema.safeParse({
      complaintType: "violencia_laboral",
      description: "Descripción suficientemente larga para el mínimo.",
      isAnonymous: true,
      reporterName: null,
      reporterContact: null,
      confirm: true,
      website: "",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza anónima con contacto", () => {
    const r = publicComplaintSchema.safeParse({
      complaintType: "otro",
      description: "Descripción suficientemente larga para el mínimo.",
      isAnonymous: true,
      reporterName: "Ana",
      reporterContact: null,
      confirm: true,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza identificada sin datos", () => {
    const r = publicComplaintSchema.safeParse({
      complaintType: "otro",
      description: "Descripción suficientemente larga para el mínimo.",
      isAnonymous: false,
      reporterName: null,
      reporterContact: null,
      confirm: true,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza campos administrativos desconocidos", () => {
    const r = publicComplaintSchema.safeParse({
      complaintType: "otro",
      description: "Descripción suficientemente larga para el mínimo.",
      isAnonymous: true,
      confirm: true,
      folio: "NOM035-Q-2026-000001",
      status: "cerrada",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza honeypot no vacío vía schema website max 0", () => {
    const r = publicComplaintSchema.safeParse({
      complaintType: "otro",
      description: "Descripción suficientemente larga para el mínimo.",
      isAnonymous: true,
      confirm: true,
      website: "http://spam",
    });
    expect(r.success).toBe(false);
  });

  it("assign exige etiqueta", () => {
    expect(complaintAssignSchema.safeParse({ assignedLabel: "RH" }).success).toBe(true);
    expect(complaintAssignSchema.safeParse({ assignedLabel: "" }).success).toBe(false);
  });
});

describe("B4.5 · policy + evidence external", () => {
  it("política rechaza HTML", () => {
    expect(
      policyDraftCreateSchema.safeParse({
        title: "Política <script>",
        content: "texto",
      }).success
    ).toBe(false);
    expect(
      policyDraftCreateSchema.safeParse({
        title: "Política OK",
        content: "Contenido plano válido.",
      }).success
    ).toBe(true);
  });

  it("evidencia externa exige HTTPS", () => {
    expect(
      evExt.safeParse({
        title: "Difusión",
        evidenceType: "difusion",
        externalUrl: "http://inseguro.local/a.pdf",
      }).success
    ).toBe(false);
    expect(
      evExt.safeParse({
        title: "Difusión",
        evidenceType: "difusion",
        externalUrl: "https://ejemplo.local/a.pdf",
      }).success
    ).toBe(true);
  });
});

describe("B4.5 · env + admin guard", () => {
  it("evidence env respeta rangos por defecto", () => {
    const e = getEvidenceStorageEnv();
    expect(e.bucket).toBe("nom035-evidence");
    expect(e.maxBytes).toBeGreaterThanOrEqual(1_048_576);
    expect(e.maxBytes).toBeLessThanOrEqual(15_728_640);
    expect(e.signedDownloadSeconds).toBeGreaterThanOrEqual(30);
    expect(e.signedDownloadSeconds).toBeLessThanOrEqual(300);
  });

  it("complaint env tiene rate limit", () => {
    const prev = process.env.NOM035_RATE_LIMIT_PEPPER;
    process.env.NOM035_RATE_LIMIT_PEPPER = "test-pepper-not-secret";
    try {
      const c = getPublicComplaintEnv();
      expect(c.rateLimitMax).toBeGreaterThanOrEqual(1);
      expect(c.rateLimitWindowMinutes).toBeGreaterThanOrEqual(1);
    } finally {
      if (prev === undefined) delete process.env.NOM035_RATE_LIMIT_PEPPER;
      else process.env.NOM035_RATE_LIMIT_PEPPER = prev;
    }
  });

  it("admin guard exige auth_rbac", () => {
    const d = evaluateAdminAccess({
      method: "GET",
      hostname: "localhost",
      origin: null,
      backendMode: "local_supabase",
      allowedOrigins: ["http://localhost:3000"],
    });
    expect(d).toEqual({ allowed: false, reason: "backend_disabled" });
  });
});
