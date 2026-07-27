import { buildGuiaIIGroupsFromManifest } from "@/data/nom035/guia-ii-manifest";

export interface GuiaIIDimensionGroup {
  name: string;
  questions: number[];
}

export interface GuiaIIDomainGroup {
  name: string;
  dimensions: GuiaIIDimensionGroup[];
}

export interface GuiaIICategoryGroup {
  name: string;
  domains: GuiaIIDomainGroup[];
}

/** Derivado del manifiesto canónico (Tabla 3). */
export const GUIA_II_GROUPS: GuiaIICategoryGroup[] = buildGuiaIIGroupsFromManifest();
