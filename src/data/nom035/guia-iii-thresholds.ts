import type { GuiaIIThresholds } from "@/types/nom035";
import {
  GUIA_III_CATEGORY_THRESHOLDS as MANIFEST_CATEGORY,
  GUIA_III_DOMAIN_THRESHOLDS as MANIFEST_DOMAIN,
  GUIA_III_FINAL_THRESHOLDS as MANIFEST_FINAL,
} from "@/data/nom035/guia-iii-manifest";

export const GUIA_III_FINAL_THRESHOLDS: GuiaIIThresholds = MANIFEST_FINAL;
export const GUIA_III_CATEGORY_THRESHOLDS: Record<string, GuiaIIThresholds> = MANIFEST_CATEGORY;
export const GUIA_III_DOMAIN_THRESHOLDS: Record<string, GuiaIIThresholds> = MANIFEST_DOMAIN;
