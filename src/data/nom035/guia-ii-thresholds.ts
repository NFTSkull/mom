import type { GuiaIIThresholds } from "@/types/nom035";
import {
  GUIA_II_CATEGORY_THRESHOLDS as MANIFEST_CATEGORY,
  GUIA_II_DOMAIN_THRESHOLDS as MANIFEST_DOMAIN,
  GUIA_II_FINAL_THRESHOLDS as MANIFEST_FINAL,
} from "@/data/nom035/guia-ii-manifest";

/** Reexporta umbrales del manifiesto (política operativa de fronteras). */
export const GUIA_II_FINAL_THRESHOLDS: GuiaIIThresholds = MANIFEST_FINAL;
export const GUIA_II_CATEGORY_THRESHOLDS: Record<string, GuiaIIThresholds> = MANIFEST_CATEGORY;
export const GUIA_II_DOMAIN_THRESHOLDS: Record<string, GuiaIIThresholds> = MANIFEST_DOMAIN;
