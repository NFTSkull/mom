import type { GuiaIILikertAnswer, RiskLevelNom035 } from "@/types/nom035";

/** Versión certificada del motor (fuente: NOM-035-STPS-2018, Guías I y II). */
export const NOM035_SCORING_VERSION = "nom035-stps-2018-guia-i-ii-v1";
export const NOM035_QUESTIONNAIRE_VERSION = "nom035-stps-2018-guias-referencia-i-ii";

export type GuiaIIScoringDirection = "direct" | "reverse";
export type GuiaIIGateKind = "clientes" | "jefe" | null;

export interface GuiaIIManifestItem {
  questionNumber: number;
  id: string;
  text: string;
  scoring: GuiaIIScoringDirection;
  category: string;
  domain: string;
  dimension: string;
  gate: GuiaIIGateKind;
}

export const GUIA_II_LIKERT_VALUES: GuiaIILikertAnswer[] = [
  "siempre",
  "casi_siempre",
  "algunas_veces",
  "casi_nunca",
  "nunca",
];

export const GUIA_II_GATE_CLIENTES_TEXT =
  "En mi trabajo debo brindar servicio a clientes o usuarios:";
export const GUIA_II_GATE_JEFE_TEXT = "Soy jefe de otros trabajadores:";

/**
 * Manifiesto canónico Guía II (Tabla 2 + Tabla 3 + reactivos del cuestionario).
 * Fuente única para textos, dirección de scoring, agrupación y condicionalidad.
 */
export const GUIA_II_MANIFEST: GuiaIIManifestItem[] = [
  { questionNumber: 1, id: "guia_ii_1", text: "Mi trabajo me exige hacer mucho esfuerzo físico", scoring: "direct", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Condiciones deficientes e insalubres", gate: null },
  { questionNumber: 2, id: "guia_ii_2", text: "Me preocupa sufrir un accidente en mi trabajo", scoring: "direct", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Condiciones peligrosas e inseguras", gate: null },
  { questionNumber: 3, id: "guia_ii_3", text: "Considero que las actividades que realizo son peligrosas", scoring: "direct", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Trabajos peligrosos", gate: null },
  { questionNumber: 4, id: "guia_ii_4", text: "Por la cantidad de trabajo que tengo debo quedarme tiempo adicional a mi turno", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas cuantitativas", gate: null },
  { questionNumber: 5, id: "guia_ii_5", text: "Por la cantidad de trabajo que tengo debo trabajar sin parar", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Ritmos de trabajo acelerado", gate: null },
  { questionNumber: 6, id: "guia_ii_6", text: "Considero que es necesario mantener un ritmo de trabajo acelerado", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Ritmos de trabajo acelerado", gate: null },
  { questionNumber: 7, id: "guia_ii_7", text: "Mi trabajo exige que esté muy concentrado", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Carga mental", gate: null },
  { questionNumber: 8, id: "guia_ii_8", text: "Mi trabajo requiere que memorice mucha información", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Carga mental", gate: null },
  { questionNumber: 9, id: "guia_ii_9", text: "Mi trabajo exige que atienda varios asuntos al mismo tiempo", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas cuantitativas", gate: null },
  { questionNumber: 10, id: "guia_ii_10", text: "En mi trabajo soy responsable de cosas de mucho valor", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas de alta responsabilidad", gate: null },
  { questionNumber: 11, id: "guia_ii_11", text: "Respondo ante mi jefe por los resultados de toda mi área de trabajo", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas de alta responsabilidad", gate: null },
  { questionNumber: 12, id: "guia_ii_12", text: "En mi trabajo me dan órdenes contradictorias", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas contradictorias o inconsistentes", gate: null },
  { questionNumber: 13, id: "guia_ii_13", text: "Considero que en mi trabajo me piden hacer cosas innecesarias", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas contradictorias o inconsistentes", gate: null },
  { questionNumber: 14, id: "guia_ii_14", text: "Trabajo horas extras más de tres veces a la semana", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Jornada de trabajo", dimension: "Jornadas de trabajo extensas", gate: null },
  { questionNumber: 15, id: "guia_ii_15", text: "Mi trabajo me exige laborar en días de descanso, festivos o fines de semana", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Jornada de trabajo", dimension: "Jornadas de trabajo extensas", gate: null },
  { questionNumber: 16, id: "guia_ii_16", text: "Considero que el tiempo en el trabajo es mucho y perjudica mis actividades familiares o personales", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Interferencia en la relación trabajo-familia", dimension: "Influencia del trabajo fuera del centro laboral", gate: null },
  { questionNumber: 17, id: "guia_ii_17", text: "Pienso en las actividades familiares o personales cuando estoy en mi trabajo", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Interferencia en la relación trabajo-familia", dimension: "Influencia de las responsabilidades familiares", gate: null },
  { questionNumber: 18, id: "guia_ii_18", text: "Mi trabajo permite que desarrolle nuevas habilidades", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o nula posibilidad de desarrollo", gate: null },
  { questionNumber: 19, id: "guia_ii_19", text: "En mi trabajo puedo aspirar a un mejor puesto", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o nula posibilidad de desarrollo", gate: null },
  { questionNumber: 20, id: "guia_ii_20", text: "Durante mi jornada de trabajo puedo tomar pausas cuando las necesito", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Falta de control y autonomía sobre el trabajo", gate: null },
  { questionNumber: 21, id: "guia_ii_21", text: "Puedo decidir la velocidad a la que realizo mis actividades en mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Falta de control y autonomía sobre el trabajo", gate: null },
  { questionNumber: 22, id: "guia_ii_22", text: "Puedo cambiar el orden de las actividades que realizo en mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Falta de control y autonomía sobre el trabajo", gate: null },
  { questionNumber: 23, id: "guia_ii_23", text: "Me informan con claridad cuáles son mis funciones", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Escasa claridad de funciones", gate: null },
  { questionNumber: 24, id: "guia_ii_24", text: "Me explican claramente los resultados que debo obtener en mi trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Escasa claridad de funciones", gate: null },
  { questionNumber: 25, id: "guia_ii_25", text: "Me informan con quién puedo resolver problemas o asuntos de trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Escasa claridad de funciones", gate: null },
  { questionNumber: 26, id: "guia_ii_26", text: "Me permiten asistir a capacitaciones relacionadas con mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o inexistente capacitación", gate: null },
  { questionNumber: 27, id: "guia_ii_27", text: "Recibo capacitación útil para hacer mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o inexistente capacitación", gate: null },
  { questionNumber: 28, id: "guia_ii_28", text: "Mi jefe tiene en cuenta mis puntos de vista y opiniones", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Características del liderazgo", gate: null },
  { questionNumber: 29, id: "guia_ii_29", text: "Mi jefe ayuda a solucionar los problemas que se presentan en el trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Características del liderazgo", gate: null },
  { questionNumber: 30, id: "guia_ii_30", text: "Puedo confiar en mis compañeros de trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 31, id: "guia_ii_31", text: "Cuando tenemos que realizar trabajo de equipo los compañeros colaboran", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 32, id: "guia_ii_32", text: "Mis compañeros de trabajo me ayudan cuando tengo dificultades", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 33, id: "guia_ii_33", text: "En mi trabajo puedo expresarme libremente sin interrupciones", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 34, id: "guia_ii_34", text: "Recibo críticas constantes a mi persona y/o trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 35, id: "guia_ii_35", text: "Recibo burlas, calumnias, difamaciones, humillaciones o ridiculizaciones", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 36, id: "guia_ii_36", text: "Se ignora mi presencia o se me excluye de las reuniones de trabajo y en la toma de decisiones", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 37, id: "guia_ii_37", text: "Se manipulan las situaciones de trabajo para hacerme parecer un mal trabajador", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 38, id: "guia_ii_38", text: "Se ignoran mis éxitos laborales y se atribuyen a otros trabajadores", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 39, id: "guia_ii_39", text: "Me bloquean o impiden las oportunidades que tengo para obtener ascenso o mejora en mi trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 40, id: "guia_ii_40", text: "He presenciado actos de violencia en mi centro de trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 41, id: "guia_ii_41", text: "Atiendo clientes o usuarios muy enojados", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas psicológicas emocionales", gate: "clientes" },
  { questionNumber: 42, id: "guia_ii_42", text: "Mi trabajo me exige atender personas muy necesitadas de ayuda o enfermas", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas psicológicas emocionales", gate: "clientes" },
  { questionNumber: 43, id: "guia_ii_43", text: "Para hacer mi trabajo debo demostrar sentimientos distintos a los míos", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas psicológicas emocionales", gate: "clientes" },
  { questionNumber: 44, id: "guia_ii_44", text: "Comunican tarde los asuntos de trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Deficiente relación con los colaboradores que supervisa", gate: "jefe" },
  { questionNumber: 45, id: "guia_ii_45", text: "Dificultan el logro de los resultados del trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Deficiente relación con los colaboradores que supervisa", gate: "jefe" },
  { questionNumber: 46, id: "guia_ii_46", text: "Ignoran las sugerencias para mejorar su trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Deficiente relación con los colaboradores que supervisa", gate: "jefe" },
];

export const GUIA_II_MANIFEST_BY_NUMBER = new Map(
  GUIA_II_MANIFEST.map((item) => [item.questionNumber, item])
);

export const GUIA_II_REVERSE_SCORED_ITEMS = new Set(
  GUIA_II_MANIFEST.filter((item) => item.scoring === "reverse").map((item) => item.questionNumber)
);

export const GUIA_II_DIRECT_SCORED_ITEMS = new Set(
  GUIA_II_MANIFEST.filter((item) => item.scoring === "direct").map((item) => item.questionNumber)
);

export interface GuiaIIThresholdsCanon {
  bajoMin: number;
  medioMin: number;
  altoMin: number;
  muyAltoMin: number;
}

/** Umbrales operativos: límite inferior inclusivo, superior exclusivo; último nivel >=. */
export const GUIA_II_FINAL_THRESHOLDS: GuiaIIThresholdsCanon = {
  bajoMin: 20,
  medioMin: 45,
  altoMin: 70,
  muyAltoMin: 90,
};

export const GUIA_II_CATEGORY_THRESHOLDS: Record<string, GuiaIIThresholdsCanon> = {
  "Ambiente de trabajo": { bajoMin: 3, medioMin: 5, altoMin: 7, muyAltoMin: 9 },
  "Factores propios de la actividad": { bajoMin: 10, medioMin: 20, altoMin: 30, muyAltoMin: 40 },
  "Organización del tiempo de trabajo": { bajoMin: 4, medioMin: 6, altoMin: 9, muyAltoMin: 12 },
  "Liderazgo y relaciones en el trabajo": { bajoMin: 10, medioMin: 18, altoMin: 28, muyAltoMin: 38 },
};

export const GUIA_II_DOMAIN_THRESHOLDS: Record<string, GuiaIIThresholdsCanon> = {
  "Condiciones en el ambiente de trabajo": { bajoMin: 3, medioMin: 5, altoMin: 7, muyAltoMin: 9 },
  "Carga de trabajo": { bajoMin: 12, medioMin: 16, altoMin: 20, muyAltoMin: 24 },
  "Falta de control sobre el trabajo": { bajoMin: 5, medioMin: 8, altoMin: 11, muyAltoMin: 14 },
  "Jornada de trabajo": { bajoMin: 1, medioMin: 2, altoMin: 4, muyAltoMin: 6 },
  "Interferencia en la relación trabajo-familia": { bajoMin: 1, medioMin: 2, altoMin: 4, muyAltoMin: 6 },
  Liderazgo: { bajoMin: 3, medioMin: 5, altoMin: 8, muyAltoMin: 11 },
  "Relaciones en el trabajo": { bajoMin: 5, medioMin: 8, altoMin: 11, muyAltoMin: 14 },
  Violencia: { bajoMin: 7, medioMin: 10, altoMin: 13, muyAltoMin: 16 },
};

export type ActionNeedLevel = RiskLevelNom035;

/** Criterios Tabla 4 (acciones por nivel) — texto normativo resumido para documentación/motor. */
export const GUIA_II_ACTION_BY_LEVEL: Record<ActionNeedLevel, string> = {
  muy_alto:
    "Se requiere análisis de cada categoría y dominio e intervención con evaluaciones específicas, campañas de sensibilización y refuerzo de política/programas.",
  alto:
    "Se requiere análisis de cada categoría y dominio e intervención (puede incluir evaluación específica), sensibilización y refuerzo de política/programas.",
  medio:
    "Se requiere revisar y reforzar política y programas de prevención mediante un Programa de intervención.",
  bajo:
    "Es necesaria mayor difusión de la política y programas de prevención.",
  nulo: "El riesgo resulta despreciable; no se requieren medidas adicionales.",
};

export function buildGuiaIIGroupsFromManifest() {
  type Dim = { name: string; questions: number[] };
  type Dom = { name: string; dimensions: Dim[] };
  type Cat = { name: string; domains: Dom[] };

  const categories: Cat[] = [];
  const catMap = new Map<string, Cat>();
  const domMap = new Map<string, Dom>();
  const dimMap = new Map<string, Dim>();

  for (const item of GUIA_II_MANIFEST) {
    let cat = catMap.get(item.category);
    if (!cat) {
      cat = { name: item.category, domains: [] };
      catMap.set(item.category, cat);
      categories.push(cat);
    }
    const domKey = `${item.category}::${item.domain}`;
    let dom = domMap.get(domKey);
    if (!dom) {
      dom = { name: item.domain, dimensions: [] };
      domMap.set(domKey, dom);
      cat.domains.push(dom);
    }
    const dimKey = `${domKey}::${item.dimension}`;
    let dim = dimMap.get(dimKey);
    if (!dim) {
      dim = { name: item.dimension, questions: [] };
      dimMap.set(dimKey, dim);
      dom.dimensions.push(dim);
    }
    dim.questions.push(item.questionNumber);
  }

  return categories;
}
