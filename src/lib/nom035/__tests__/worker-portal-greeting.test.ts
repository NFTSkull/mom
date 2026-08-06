import { describe, expect, it } from "vitest";
import {
  isPruebaWorkerPortal,
  workerPortalGreeting,
} from "../worker-portal-greeting";

describe("workerPortalGreeting", () => {
  it("saluda con nombre a trabajadores reales", () => {
    expect(
      workerPortalGreeting({
        account: { username: "empleado.0003" },
        worker: { nombre: "Ana Pérez", externalReference: "0003" },
      })
    ).toBe("Hola, Ana Pérez");
  });

  it("Hola sin nombre si falta", () => {
    expect(
      workerPortalGreeting({
        account: { username: "empleado.0003" },
        worker: { nombre: "  " },
      })
    ).toBe("Hola");
  });

  it("prueba.trabajador → BIENVENIDO!", () => {
    expect(
      workerPortalGreeting({
        account: { username: "prueba.trabajador" },
        worker: {
          nombre: "Trabajador Prueba Portal",
          externalReference: "SYN-PRUEBA-LOGIN",
        },
      })
    ).toBe("BIENVENIDO!");
  });

  it("trabajador.prueba local → BIENVENIDO!", () => {
    expect(
      workerPortalGreeting({
        account: { username: "trabajador.prueba" },
        worker: { nombre: "Trabajador Prueba NOM035", externalReference: "TST-0001" },
      })
    ).toBe("BIENVENIDO!");
  });

  it("detecta prueba solo por externalReference", () => {
    expect(
      isPruebaWorkerPortal({
        account: { username: "otro.usuario" },
        worker: { externalReference: "SYN-PRUEBA-LOGIN" },
      })
    ).toBe(true);
  });

  it("no marca empleados reales como prueba", () => {
    expect(
      isPruebaWorkerPortal({
        account: { username: "empleado.0012" },
        worker: { nombre: "Juan", externalReference: "0012" },
      })
    ).toBe(false);
  });
});
