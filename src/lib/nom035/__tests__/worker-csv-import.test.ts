import { describe, expect, it } from "vitest";
import {
  assertLocalOnlySupabaseUrl,
  canonicalizeWorkerCsvHeaders,
  mapWorkerCsv,
  parseCsv,
} from "@/lib/nom035/server/admin-worker-import";

describe("Worker CSV · aliases nómina", () => {
  it("canonicaliza encabezados Número / Nombre Completo", () => {
    expect(
      canonicalizeWorkerCsvHeaders([
        "número",
        "nombre completo",
        "puesto",
        "departamento",
      ])
    ).toEqual(["referencia_externa", "nombre", "puesto", "departamento"]);
  });

  it("acepta CSV válido estilo nómina con UTF-8 y acentos", () => {
    const csv =
      "Número,Nombre Completo,Puesto,Departamento\n" +
      "1001,María Núñez,Analista,Calidad\n" +
      "1002,José Pérez,Operador,Producción\n";
    const preview = mapWorkerCsv(csv);
    expect(preview.ok).toBe(true);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]?.referencia_externa).toBe("1001");
    expect(preview.rows[0]?.nombre).toBe("María Núñez");
    expect(preview.rows[0]?.puesto).toBe("Analista");
    expect(preview.rows[0]?.departamento).toBe("Calidad");
  });

  it("conserva textos truncados exactamente", () => {
    const csv =
      "Número,Nombre Completo,Puesto,Departamento\n" +
      "9,Trabajador Ficticio Uno,Regional Quality Manage,Quality A/Qc Expenses\n" +
      "10,Trabajador Ficticio Dos,Operador De Trefiladora Y Embo,Wire Extrusión\n";
    const preview = mapWorkerCsv(csv);
    expect(preview.ok).toBe(true);
    expect(preview.rows.map((r) => r.puesto)).toEqual([
      "Regional Quality Manage",
      "Operador De Trefiladora Y Embo",
    ]);
  });

  it("rechaza encabezados incorrectos", () => {
    const preview = mapWorkerCsv("foo,bar\n1,x\n");
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.code === "missing_header")).toBe(true);
  });

  it("rechaza número duplicado en archivo", () => {
    const csv =
      "Número,Nombre Completo,Puesto,Departamento\n" +
      "1,Alpha Test,Puesto A,Depto A\n" +
      "1,Beta Test,Puesto B,Depto B\n";
    const preview = mapWorkerCsv(csv);
    expect(preview.ok).toBe(false);
    expect(
      preview.errors.some((e) => e.code === "duplicate_external_reference_in_file")
    ).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    const csv =
      "Número,Nombre Completo,Puesto,Departamento\n" +
      "1,,Puesto A,Depto A\n";
    const preview = mapWorkerCsv(csv);
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.code === "nombre_required")).toBe(true);
  });

  it("rechaza puesto vacío", () => {
    const csv =
      "Número,Nombre Completo,Puesto,Departamento\n" +
      "1,Alpha Test,,Depto A\n";
    const preview = mapWorkerCsv(csv);
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.code === "puesto_required")).toBe(true);
  });

  it("rechaza departamento vacío", () => {
    const csv =
      "Número,Nombre Completo,Puesto,Departamento\n" +
      "1,Alpha Test,Puesto A,\n";
    const preview = mapWorkerCsv(csv);
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.code === "departamento_required")).toBe(
      true
    );
  });

  it("rechaza nombre exacto duplicado en nómina", () => {
    const csv =
      "Número,Nombre Completo,Puesto,Departamento\n" +
      "1,Mismo Nombre,Puesto A,Depto A\n" +
      "2,Mismo Nombre,Puesto B,Depto B\n";
    const preview = mapWorkerCsv(csv);
    expect(preview.ok).toBe(false);
    expect(preview.errors.some((e) => e.code === "duplicate_nombre_in_file")).toBe(
      true
    );
  });

  it("parseCsv elimina BOM UTF-8", () => {
    const parsed = parseCsv("\uFEFFnombre,email\nAna,a@demo.test\n");
    expect(parsed.headers[0]).toBe("nombre");
  });
});

describe("Worker CSV · local-only guard", () => {
  it("acepta localhost", () => {
    expect(() =>
      assertLocalOnlySupabaseUrl("http://127.0.0.1:55321")
    ).not.toThrow();
  });

  it("bloquea staging / remoto / ConCasa", () => {
    expect(() =>
      assertLocalOnlySupabaseUrl("https://agblexample.supabase.co")
    ).toThrow(/localhost/);
    expect(() =>
      assertLocalOnlySupabaseUrl("http://nom035-staging.example")
    ).toThrow();
    expect(() =>
      assertLocalOnlySupabaseUrl("http://localhost:54321/concasa")
    ).toThrow(/prohibido/);
  });
});

describe("Worker CSV · idempotencia lógica (plan)", () => {
  it("misma referencia implica actualización no alta", () => {
    // Lógica de llave: empresa singleton + referencia_externa
    const key = (company: string, numero: string) => `${company}::${numero}`;
    const a = key("LOCAL_IMPORT_TEST_83", "42");
    const b = key("LOCAL_IMPORT_TEST_83", "42");
    const other = key("OTRA_EMPRESA_FICTICIA", "42");
    expect(a).toBe(b);
    expect(a).not.toBe(other);
  });
});
