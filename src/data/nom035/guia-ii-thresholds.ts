import type { GuiaIIThresholds } from "@/types/nom035";

export const GUIA_II_FINAL_THRESHOLDS: GuiaIIThresholds = {
  bajoMin: 20,
  medioMin: 45,
  altoMin: 70,
  muyAltoMin: 90,
};

export const GUIA_II_CATEGORY_THRESHOLDS: Record<string, GuiaIIThresholds> = {
  "Ambiente de trabajo": { bajoMin: 3, medioMin: 5, altoMin: 7, muyAltoMin: 9 },
  "Factores propios de la actividad": { bajoMin: 10, medioMin: 20, altoMin: 30, muyAltoMin: 40 },
  "Organizacion del tiempo de trabajo": { bajoMin: 4, medioMin: 6, altoMin: 9, muyAltoMin: 12 },
  "Liderazgo y relaciones en el trabajo": { bajoMin: 10, medioMin: 18, altoMin: 28, muyAltoMin: 38 },
};

export const GUIA_II_DOMAIN_THRESHOLDS: Record<string, GuiaIIThresholds> = {
  "Condiciones en el ambiente de trabajo": { bajoMin: 3, medioMin: 5, altoMin: 7, muyAltoMin: 9 },
  "Carga de trabajo": { bajoMin: 12, medioMin: 16, altoMin: 20, muyAltoMin: 24 },
  "Falta de control sobre el trabajo": { bajoMin: 5, medioMin: 8, altoMin: 11, muyAltoMin: 14 },
  "Jornada de trabajo": { bajoMin: 1, medioMin: 2, altoMin: 4, muyAltoMin: 6 },
  "Interferencia en la relacion trabajo-familia": { bajoMin: 1, medioMin: 2, altoMin: 4, muyAltoMin: 6 },
  Liderazgo: { bajoMin: 3, medioMin: 5, altoMin: 8, muyAltoMin: 11 },
  "Relaciones en el trabajo": { bajoMin: 5, medioMin: 8, altoMin: 11, muyAltoMin: 14 },
  Violencia: { bajoMin: 7, medioMin: 10, altoMin: 13, muyAltoMin: 16 },
};
