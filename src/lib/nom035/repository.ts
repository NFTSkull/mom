import { localRepository } from "./local-repository";
import type { Nom035Repository, RepositoryMode } from "./repository-types";

export type { Nom035Repository, RepositoryMode } from "./repository-types";
export { localRepository } from "./local-repository";

/**
 * Modo activo del repositorio.
 * B4.0: fijo en "local". No se permite conmutar a Supabase hasta
 * implementación completa + pruebas en un bloque posterior.
 */
export const ACTIVE_REPOSITORY_MODE: RepositoryMode = "local";

export function getNom035Repository(): Nom035Repository {
  if (ACTIVE_REPOSITORY_MODE !== "local") {
    throw new Error(
      "Modo de repositorio no soportado todavía. ACTIVE_REPOSITORY_MODE debe ser 'local' hasta completar la migración a Supabase."
    );
  }
  return localRepository;
}
