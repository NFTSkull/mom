/**
 * Saludo del hub `/trabajador`.
 * Trabajadores reales: «Hola, {nombre}».
 * Cuenta sintética de prueba: «BIENVENIDO!» (sin nombre).
 */

const PRUEBA_USERNAMES = new Set(["prueba.trabajador", "trabajador.prueba"]);
const PRUEBA_EXTERNAL_REFS = new Set(["SYN-PRUEBA-LOGIN", "TST-0001"]);

export type PortalGreetingInput = {
  account?: { username?: string | null } | null;
  worker?: {
    nombre?: string | null;
    externalReference?: string | null;
  } | null;
};

export function isPruebaWorkerPortal(state: PortalGreetingInput): boolean {
  const username = state.account?.username?.trim().toLowerCase() ?? "";
  if (username && PRUEBA_USERNAMES.has(username)) return true;
  const ref = state.worker?.externalReference?.trim().toUpperCase() ?? "";
  if (ref && PRUEBA_EXTERNAL_REFS.has(ref)) return true;
  return false;
}

export function workerPortalGreeting(state: PortalGreetingInput): string {
  if (isPruebaWorkerPortal(state)) return "BIENVENIDO!";
  const nombre = state.worker?.nombre?.trim();
  return nombre ? `Hola, ${nombre}` : "Hola";
}
