import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertAvanceCountsMatch,
  buildAvanceExcelRows,
  respondioFromAssignmentStatus,
} from "../avance-excel";

describe("B4.23 close + exclude test metrics", () => {
  it("test workers se excluyen del Excel de avance", () => {
    const built = buildAvanceExcelRows([
      {
        nombre: "Real",
        username: "001",
        assignmentStatus: "completed",
      },
      {
        nombre: "Prueba",
        username: "prueba.trabajador",
        assignmentStatus: "completed",
        synthetic: true,
      },
    ]);
    expect(built.rows).toHaveLength(1);
    expect(built.rows[0]?.usuario).toBe("001");
    expect(built.si).toBe(1);
  });

  it("completed conserva Sí; pending No", () => {
    expect(respondioFromAssignmentStatus("completed")).toBe("Sí");
    expect(respondioFromAssignmentStatus("pending")).toBe("No");
  });

  it("conteos 83 con completed parcial coinciden", () => {
    const rows = Array.from({ length: 83 }, (_, i) => ({
      nombre: `W${i}`,
      username: String(i + 1).padStart(3, "0"),
      assignmentStatus: (i < 80 ? "completed" : "pending") as
        | "completed"
        | "pending",
    }));
    const built = buildAvanceExcelRows(rows);
    expect(
      assertAvanceCountsMatch({
        total: built.total,
        si: built.si,
        no: built.no,
        dashboardCompleted: 80,
      }).ok
    ).toBe(true);
  });

  it("login post-cierre usa evaluation_unavailable", () => {
    const route = readFileSync(
      "src/app/api/trabajador/login/route.ts",
      "utf8"
    );
    expect(route).toMatch(/evaluation_unavailable/);
    expect(route).toMatch(/La evaluación ya no está disponible/);
    expect(route).toMatch(/isNom035CampaignClosed/);
  });

  it("migración 013 define is_test y filtra métricas", () => {
    const mig = readFileSync(
      "supabase/migrations/013_is_test_exclude_metrics.sql",
      "utf8"
    );
    expect(mig).toMatch(/add column if not exists is_test/);
    expect(mig).toMatch(/coalesce\(w\.is_test, false\) = false/);
    expect(mig).toMatch(/REAL_WORKERS_MARKED_TEST/);
    expect(mig).toMatch(/admin_dashboard_summary/);
    expect(mig).toMatch(/admin_reports_summary/);
    expect(mig).toMatch(/admin_export_nom035_avance/);
  });

  it("script de cierre no borra answers/results", () => {
    const script = readFileSync("scripts/b423-close-campaign.ts", "utf8");
    expect(script).toMatch(/B423_EXECUTE/);
    expect(script).toMatch(/answersDeleted/);
    expect(script).toMatch(/is_active = false/);
    expect(script).not.toMatch(/delete from public\.evaluation_answers/i);
    expect(script).not.toMatch(/delete from public\.evaluation_results/i);
  });
});
