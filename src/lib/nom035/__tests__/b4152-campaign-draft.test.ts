import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("B4.15.3 — UI awaiting_campaign", () => {
  const src = readFileSync(resolve("src/app/trabajador/page.tsx"), "utf8");

  it("muestra título y mensaje de evaluación asignada pendiente", () => {
    expect(src).toMatch(/awaiting_campaign/);
    expect(src).toMatch(/Evaluación asignada/);
    expect(src).toMatch(
      /Tu evaluación ya fue asignada\. Podrás comenzar cuando la campaña sea iniciada\./
    );
    expect(src).toMatch(/data-testid="worker-awaiting-campaign"/);
  });

  it("no ofrece botón Comenzar en awaiting_campaign", () => {
    const block = src.match(
      /\{status === "awaiting_campaign" \? \([\s\S]*?\) : null\}/
    )?.[0];
    expect(block).toBeTruthy();
    expect(block).not.toMatch(/Comenzar evaluación/);
    expect(block).not.toMatch(/href="\/trabajador\/evaluacion"/);
    expect(block).not.toMatch(/No tienes una evaluación activa/);
  });

  it("conserva mensaje propio sin assignment", () => {
    expect(src).toMatch(/No tienes una evaluación activa/);
  });

  it("conserva flujo pending/in_progress/completed", () => {
    expect(src).toMatch(/Comenzar evaluación/);
    expect(src).toMatch(/Continuar evaluación/);
    expect(src).toMatch(/enviada correctamente/);
  });

  it("permite cerrar sesión", () => {
    expect(src).toMatch(/Cerrar sesión/);
  });
});
