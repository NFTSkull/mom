import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AVANCE_ALLOWED_HEADERS,
  AVANCE_EXPECTED_ROWS,
  assertAvanceCountsMatch,
  assertExportHasNoSensitiveKeys,
  buildAvanceExcelRows,
  isRealAvanceUsername,
  respondioFromAssignmentStatus,
  respondioFromGuideProgress,
  type AvanceSourceRow,
} from "../avance-excel";
import { buildAvanceXlsxBuffer, isLikelyXlsx } from "../avance-excel-xlsx";
import { findEndpointPermission } from "../auth/endpoint-permissions";
import { permissionRequiresAal2 } from "../auth/permissions";

function pad83(overrides: Partial<AvanceSourceRow>[] = []): AvanceSourceRow[] {
  const byUser = new Map<string, AvanceSourceRow>();
  for (let i = 1; i <= 83; i += 1) {
    const u = String(i).padStart(3, "0");
    byUser.set(u, {
      nombre: `Trabajador ${u}`,
      username: u,
      assignmentStatus: "pending",
    });
  }
  for (const o of overrides) {
    const u = o.username!;
    byUser.set(u, { ...byUser.get(u)!, ...o });
  }
  return [...byUser.values()];
}

describe("B4.22 avance excel", () => {
  it("pending → No; in_progress/draft → No; completed → Sí", () => {
    expect(respondioFromAssignmentStatus("pending")).toBe("No");
    expect(respondioFromAssignmentStatus("in_progress")).toBe("No");
    expect(respondioFromAssignmentStatus("draft" as never)).toBe("No");
    expect(respondioFromAssignmentStatus("completed")).toBe("Sí");
  });

  it("Guía I sola no cuenta; assignment completed sí", () => {
    expect(
      respondioFromGuideProgress({
        assignmentStatus: "in_progress",
        guiaIStatus: "completed",
        guiaIIIStatus: "pending",
      })
    ).toBe("No");
    expect(
      respondioFromGuideProgress({
        assignmentStatus: "completed",
        guiaIStatus: "completed",
        guiaIIIStatus: "completed",
      })
    ).toBe("Sí");
  });

  it("exporta 83, excluye synthetic/legacy/revoked, conserva 001/083", () => {
    const sources = [
      ...pad83([
        { username: "001", assignmentStatus: "completed", nombre: "A" },
        { username: "042", assignmentStatus: "in_progress", nombre: "B" },
        { username: "083", assignmentStatus: "pending", nombre: "C" },
      ]),
      {
        nombre: "Synth",
        username: "999",
        assignmentStatus: "completed",
        synthetic: true,
      },
      {
        nombre: "Legacy",
        username: "050",
        assignmentStatus: "completed",
        legacyCampaign: true,
      },
      {
        nombre: "Rev",
        username: "051",
        assignmentStatus: "revoked",
        revoked: true,
      },
    ];
    const built = buildAvanceExcelRows(sources);
    expect(built.total).toBe(83);
    expect(built.rows[0]?.usuario).toBe("001");
    expect(built.rows[0]?.respondio).toBe("Sí");
    expect(built.rows[82]?.usuario).toBe("083");
    expect(built.rows[82]?.respondio).toBe("No");
    expect(built.si + built.no).toBe(83);
    expect(isRealAvanceUsername("001")).toBe(true);
    expect(isRealAvanceUsername("1")).toBe(false);
  });

  it("Sí + No = 83 y coincide con dashboard completed", () => {
    const sources = pad83(
      Array.from({ length: 27 }, (_, i) => ({
        username: String(i + 1).padStart(3, "0"),
        assignmentStatus: "completed" as const,
      }))
    );
    const built = buildAvanceExcelRows(sources);
    expect(built.si).toBe(27);
    expect(built.no).toBe(56);
    expect(
      assertAvanceCountsMatch({
        total: built.total,
        si: built.si,
        no: built.no,
        dashboardCompleted: 27,
      }).ok
    ).toBe(true);
    expect(
      assertAvanceCountsMatch({
        total: built.total,
        si: built.si,
        no: built.no,
        dashboardCompleted: 26,
      }).ok
    ).toBe(false);
  });

  it("XLSX válido sin scores/answers/passwords", async () => {
    const built = buildAvanceExcelRows(
      pad83([{ username: "001", assignmentStatus: "completed" }])
    );
    const buf = await buildAvanceXlsxBuffer(built.rows);
    expect(isLikelyXlsx(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    const asText = buf.toString("utf8");
    expect(asText).not.toMatch(/password/i);
    expect(asText.toLowerCase()).not.toContain("score");
    expect(assertExportHasNoSensitiveKeys({ rows: built.rows })).toBe(true);
    expect(AVANCE_ALLOWED_HEADERS).toEqual(["Nombre", "Usuario", "Respondió"]);
    expect(AVANCE_EXPECTED_ROWS).toBe(83);
  });

  it("endpoint protegido con dashboard.view y sin AAL2", () => {
    const rule = findEndpointPermission(
      "GET",
      "/api/admin/nom035/campaigns/avance-excel"
    );
    expect(rule?.permission).toBe("dashboard.view");
    expect(rule?.requiresAal2).toBe(false);
    expect(permissionRequiresAal2("dashboard.view")).toBe(false);
    expect(permissionRequiresAal2("results.individual.read")).toBe(false);
    expect(permissionRequiresAal2("complaints.detail")).toBe(true);

    const route = readFileSync(
      "src/app/api/admin/nom035/campaigns/avance-excel/route.ts",
      "utf8"
    );
    expect(route).toMatch(/requireAdminApiAuth/);
    expect(route).toMatch(/avance-nom035-2026\.xlsx|AVANCE_EXCEL_FILENAME/);
  });

  it("UI tiene botón de descarga", () => {
    const page = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(page).toMatch(/Descargar Excel de respuestas/);
    expect(page).toMatch(/download-avance-excel/);
  });
});
