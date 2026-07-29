/**
 * Guardas compartidas: abortar mutaciones "staging" si el proyecto remoto
 * ya se llama nom035-production (mismo ref promovido).
 */
import { execFileSync } from "node:child_process";

export const STAGING_LOGICAL_NAME = "nom035-staging";
export const PRODUCTION_LOGICAL_NAME = "nom035-production";

export function assertRemoteIsStagingNotProduction(projectRef: string): void {
  const token =
    process.env.SUPABASE_ACCESS_TOKEN ||
    (() => {
      try {
        return execFileSync(
          "security",
          ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
          { encoding: "utf8" }
        ).trim();
      } catch {
        return "";
      }
    })();

  if (!token) {
    // En CI sin Management API: exigir señal explícita de allowlist
    if (process.env.ALLOW_STAGING_SEED_WITHOUT_NAME_CHECK === "1") {
      if (process.env.STAGING_PROJECT_NAME === PRODUCTION_LOGICAL_NAME) {
        throw new Error("ABORT: proyecto promovido a production");
      }
      return;
    }
    throw new Error(
      "ABORT: no se puede verificar nombre remoto; no se permiten seeds staging"
    );
  }

  const raw = execFileSync(
    "curl",
    [
      "-sS",
      "-A",
      "Mozilla/5.0",
      "-H",
      `Authorization: Bearer ${token}`,
      "https://api.supabase.com/v1/projects",
    ],
    { encoding: "utf8" }
  );
  const projects = JSON.parse(raw) as Array<{ id: string; name: string }>;
  const me = projects.find((p) => p.id === projectRef);
  if (!me) throw new Error("ABORT: project ref no encontrado en Management API");
  if (me.name === PRODUCTION_LOGICAL_NAME) {
    throw new Error(
      "ABORT: el proyecto fue promovido a nom035-production; seeds staging prohibidos"
    );
  }
  if (me.name !== STAGING_LOGICAL_NAME) {
    throw new Error(`ABORT: nombre remoto inesperado: ${me.name}`);
  }
}
