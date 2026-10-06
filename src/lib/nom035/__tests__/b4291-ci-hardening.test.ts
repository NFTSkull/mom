import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  overrides: Record<string, unknown>;
};
const m016 = readFileSync(
  "supabase/migrations/016_admin_list_results_single_signature.sql",
  "utf8"
);
const SIG8 = "public.admin_list_results(uuid, uuid, text, text, text, integer, integer, text)";

describe("B4.29.1 CI verde: dependencias y admin_list_results", () => {
  it("Next en parche seguro de la serie 16; React sin cambios", () => {
    expect(pkg.dependencies.next).toBe("16.3.8");
    expect(pkg.devDependencies["eslint-config-next"]).toBe("16.3.8");
    expect(pkg.dependencies.react).toBe("19.2.4");
    expect(pkg.dependencies["react-dom"]).toBe("19.2.4");
  });

  it("sharp solo transitivo (override parcheado), no dependencia directa", () => {
    expect(pkg.dependencies.sharp).toBeUndefined();
    expect(pkg.devDependencies.sharp).toBeUndefined();
    expect(pkg.overrides.sharp).toBe("0.35.5");
  });

  it("overrides de transitivas vulnerables", () => {
    expect(pkg.overrides["brace-expansion"]).toBe("5.0.12");
    expect(pkg.overrides["source-map-js"]).toBe("1.2.2");
    expect(pkg.overrides["@next/eslint-plugin-next"]).toEqual({
      "fast-glob": "npm:tinyglobby@0.2.17",
    });
  });

  it("016 elimina solo la firma legacy exacta de 7 args", () => {
    expect(m016).toMatch(
      /drop function if exists public\.admin_list_results\(uuid, uuid, text, text, text, integer, integer\);/
    );
    expect(m016.match(/drop function/gi)).toHaveLength(1);
  });

  it("016 conserva p_sort con default name_asc y las 4 variantes", () => {
    expect(m016).toMatch(/p_sort\s+text default 'name_asc'/);
    for (const s of ["name_asc", "name_desc", "recent", "oldest"]) {
      expect(m016).toContain(`'${s}'`);
    }
    expect(m016).toMatch(/coalesce\(w\.is_test, false\) = false/);
    expect(m016).toMatch(/require_admin_permission\('results\.aggregate\.read'/);
  });

  it("016 preserva el orden de la página (ordinal) sin exponerlo", () => {
    expect(m016).toMatch(/jsonb_agg\(to_jsonb\(t\) - 'sortOrdinal' order by t\."sortOrdinal"\)/);
    expect(m016).not.toMatch(/order by t\."sortKey", t\.id/);
    expect(m016).toMatch(/row_number\(\) over \(/);
  });

  it("016 retira EXECUTE a PUBLIC/anon y lo mantiene a authenticated/service_role", () => {
    expect(m016).toContain(`revoke all on function ${SIG8} from public;`);
    expect(m016).toContain(`revoke all on function ${SIG8} from anon;`);
    expect(m016).toContain(`grant execute on function ${SIG8} to authenticated, service_role;`);
  });

  it("el único llamador envía p_sort y los tipos generados lo incluyen", () => {
    const svc = readFileSync("src/lib/nom035/server/admin-core-service.ts", "utf8");
    expect(svc).toMatch(/rpc\("admin_list_results", \{[\s\S]*?p_sort: params\.sort \?\? "name_asc"/);
    const types = readFileSync("src/types/database.generated.ts", "utf8");
    expect(types).toMatch(/admin_list_results: \{\s*Args: \{[\s\S]*?p_sort\?: string[\s\S]*?\}\s*Returns: Json/);
  });

  it("pgTAP cubre firma única, grants y orden real de las 4 variantes", () => {
    const t = readFileSync("supabase/tests/database/006_admin_core_backend.test.sql", "utf8");
    for (const label of [
      "admin_list_results: una sola firma (sin overload legacy)",
      "PUBLIC sin EXECUTE en admin_list_results",
      "name_desc: Z→A",
      "recent: más reciente primero",
      "oldest: más antiguo primero",
      "default sort = name_asc",
    ]) {
      expect(t).toContain(label);
    }
  });
});
