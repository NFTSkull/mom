import type { GuiaIILikertAnswer, RiskLevelNom035 } from "@/types/nom035";

/**
 * Versión certificada del motor Guía III.
 * Fuente: NOM-035-STPS-2018 Guía de Referencia III (Tablas 5, 6 y 7).
 * SHA-256 fuente txt: 8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76
 * SHA-256 Word MAT: 3eedb20e4362458f9159ecb6ee4a1a6688728ea789f2a42f9598700554e1d936
 */
export const NOM035_GUIA_III_SCORING_VERSION = "nom035-stps-2018-guia-iii-v1";
export const NOM035_GUIA_III_QUESTIONNAIRE_VERSION =
  "nom035-stps-2018-guia-referencia-iii";

/** Assignment combinado Guía I + Guía III (>50 trabajadores). */
export const NOM035_I_III_QUESTIONNAIRE_VERSION =
  "nom035-stps-2018-guias-referencia-i-iii";
export const NOM035_I_III_SCORING_VERSION = "nom035-stps-2018-guia-i-iii-v1";

export const NOM035_SOURCE_SHA256 =
  "8d5c2c63e703e7d6154a7f71a1aec9ec1741f25a7bbc6eec4303cbe8a38d7a76";

export type GuiaIIIScoringDirection = "direct" | "reverse";
export type GuiaIIIGateKind = "clientes" | "jefe" | null;

export interface GuiaIIIManifestItem {
  questionNumber: number;
  id: string;
  text: string;
  scoring: GuiaIIIScoringDirection;
  category: string;
  domain: string;
  dimension: string;
  gate: GuiaIIIGateKind;
}

export const GUIA_III_LIKERT_VALUES: GuiaIILikertAnswer[] = [
  "siempre",
  "casi_siempre",
  "algunas_veces",
  "casi_nunca",
  "nunca",
];

export const GUIA_III_GATE_CLIENTES_TEXT =
  "En mi trabajo debo brindar servicio a clientes o usuarios:";
export const GUIA_III_GATE_JEFE_TEXT = "Soy jefe de otros trabajadores:";

/**
 * Manifiesto canónico Guía III (72 reactivos + Tabla 5 scoring + Tabla 6 agrupación).
 * Reactivos condicionales: 65–68 (clientes), 69–72 (jefe).
 */
export const GUIA_III_MANIFEST: GuiaIIIManifestItem[] = [
  { questionNumber: 1, id: "guia_iii_1", text: "El espacio donde trabajo me permite realizar mis actividades de manera segura e higiénica", scoring: "reverse", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Condiciones peligrosas e inseguras", gate: null },
  { questionNumber: 2, id: "guia_iii_2", text: "Mi trabajo me exige hacer mucho esfuerzo físico", scoring: "direct", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Condiciones deficientes e insalubres", gate: null },
  { questionNumber: 3, id: "guia_iii_3", text: "Me preocupa sufrir un accidente en mi trabajo", scoring: "direct", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Condiciones peligrosas e inseguras", gate: null },
  { questionNumber: 4, id: "guia_iii_4", text: "Considero que en mi trabajo se aplican las normas de seguridad y salud en el trabajo", scoring: "reverse", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Condiciones deficientes e insalubres", gate: null },
  { questionNumber: 5, id: "guia_iii_5", text: "Considero que las actividades que realizo son peligrosas", scoring: "direct", category: "Ambiente de trabajo", domain: "Condiciones en el ambiente de trabajo", dimension: "Trabajos peligrosos", gate: null },
  { questionNumber: 6, id: "guia_iii_6", text: "Por la cantidad de trabajo que tengo debo quedarme tiempo adicional a mi turno", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas cuantitativas", gate: null },
  { questionNumber: 7, id: "guia_iii_7", text: "Por la cantidad de trabajo que tengo debo trabajar sin parar", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Ritmos de trabajo acelerado", gate: null },
  { questionNumber: 8, id: "guia_iii_8", text: "Considero que es necesario mantener un ritmo de trabajo acelerado", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Ritmos de trabajo acelerado", gate: null },
  { questionNumber: 9, id: "guia_iii_9", text: "Mi trabajo exige que esté muy concentrado", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Carga mental", gate: null },
  { questionNumber: 10, id: "guia_iii_10", text: "Mi trabajo requiere que memorice mucha información", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Carga mental", gate: null },
  { questionNumber: 11, id: "guia_iii_11", text: "En mi trabajo tengo que tomar decisiones difíciles muy rápido", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Carga mental", gate: null },
  { questionNumber: 12, id: "guia_iii_12", text: "Mi trabajo exige que atienda varios asuntos al mismo tiempo", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas cuantitativas", gate: null },
  { questionNumber: 13, id: "guia_iii_13", text: "En mi trabajo soy responsable de cosas de mucho valor", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas de alta responsabilidad", gate: null },
  { questionNumber: 14, id: "guia_iii_14", text: "Respondo ante mi jefe por los resultados de toda mi área de trabajo", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas de alta responsabilidad", gate: null },
  { questionNumber: 15, id: "guia_iii_15", text: "En el trabajo me dan órdenes contradictorias", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas contradictorias o inconsistentes", gate: null },
  { questionNumber: 16, id: "guia_iii_16", text: "Considero que en mi trabajo me piden hacer cosas innecesarias", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas contradictorias o inconsistentes", gate: null },
  { questionNumber: 17, id: "guia_iii_17", text: "Trabajo horas extras más de tres veces a la semana", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Jornada de trabajo", dimension: "Jornadas de trabajo extensas", gate: null },
  { questionNumber: 18, id: "guia_iii_18", text: "Mi trabajo me exige laborar en días de descanso, festivos o fines de semana", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Jornada de trabajo", dimension: "Jornadas de trabajo extensas", gate: null },
  { questionNumber: 19, id: "guia_iii_19", text: "Considero que el tiempo en el trabajo es mucho y perjudica mis actividades familiares o personales", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Interferencia en la relación trabajo-familia", dimension: "Influencia del trabajo fuera del centro laboral", gate: null },
  { questionNumber: 20, id: "guia_iii_20", text: "Debo atender asuntos de trabajo cuando estoy en casa", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Interferencia en la relación trabajo-familia", dimension: "Influencia del trabajo fuera del centro laboral", gate: null },
  { questionNumber: 21, id: "guia_iii_21", text: "Pienso en las actividades familiares o personales cuando estoy en mi trabajo", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Interferencia en la relación trabajo-familia", dimension: "Influencia de las responsabilidades familiares", gate: null },
  { questionNumber: 22, id: "guia_iii_22", text: "Pienso que mis responsabilidades familiares afectan mi trabajo", scoring: "direct", category: "Organización del tiempo de trabajo", domain: "Interferencia en la relación trabajo-familia", dimension: "Influencia de las responsabilidades familiares", gate: null },
  { questionNumber: 23, id: "guia_iii_23", text: "Mi trabajo permite que desarrolle nuevas habilidades", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o nula posibilidad de desarrollo", gate: null },
  { questionNumber: 24, id: "guia_iii_24", text: "En mi trabajo puedo aspirar a un mejor puesto", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o nula posibilidad de desarrollo", gate: null },
  { questionNumber: 25, id: "guia_iii_25", text: "Durante mi jornada de trabajo puedo tomar pausas cuando las necesito", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Falta de control y autonomía sobre el trabajo", gate: null },
  { questionNumber: 26, id: "guia_iii_26", text: "Puedo decidir cuánto trabajo realizo durante la jornada laboral", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Falta de control y autonomía sobre el trabajo", gate: null },
  { questionNumber: 27, id: "guia_iii_27", text: "Puedo decidir la velocidad a la que realizo mis actividades en mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Falta de control y autonomía sobre el trabajo", gate: null },
  { questionNumber: 28, id: "guia_iii_28", text: "Puedo cambiar el orden de las actividades que realizo en mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Falta de control y autonomía sobre el trabajo", gate: null },
  { questionNumber: 29, id: "guia_iii_29", text: "Los cambios que se presentan en mi trabajo dificultan mi labor", scoring: "direct", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Insuficiente participación y manejo del cambio", gate: null },
  { questionNumber: 30, id: "guia_iii_30", text: "Cuando se presentan cambios en mi trabajo se tienen en cuenta mis ideas o aportaciones", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Insuficiente participación y manejo del cambio", gate: null },
  { questionNumber: 31, id: "guia_iii_31", text: "Me informan con claridad cuáles son mis funciones", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Escasa claridad de funciones", gate: null },
  { questionNumber: 32, id: "guia_iii_32", text: "Me explican claramente los resultados que debo obtener en mi trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Escasa claridad de funciones", gate: null },
  { questionNumber: 33, id: "guia_iii_33", text: "Me explican claramente los objetivos de mi trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Escasa claridad de funciones", gate: null },
  { questionNumber: 34, id: "guia_iii_34", text: "Me informan con quién puedo resolver problemas o asuntos de trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Escasa claridad de funciones", gate: null },
  { questionNumber: 35, id: "guia_iii_35", text: "Me permiten asistir a capacitaciones relacionadas con mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o inexistente capacitación", gate: null },
  { questionNumber: 36, id: "guia_iii_36", text: "Recibo capacitación útil para hacer mi trabajo", scoring: "reverse", category: "Factores propios de la actividad", domain: "Falta de control sobre el trabajo", dimension: "Limitada o inexistente capacitación", gate: null },
  { questionNumber: 37, id: "guia_iii_37", text: "Mi jefe ayuda a organizar mejor el trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Características del liderazgo", gate: null },
  { questionNumber: 38, id: "guia_iii_38", text: "Mi jefe tiene en cuenta mis puntos de vista y opiniones", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Características del liderazgo", gate: null },
  { questionNumber: 39, id: "guia_iii_39", text: "Mi jefe me comunica a tiempo la información relacionada con el trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Características del liderazgo", gate: null },
  { questionNumber: 40, id: "guia_iii_40", text: "La orientación que me da mi jefe me ayuda a realizar mejor mi trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Características del liderazgo", gate: null },
  { questionNumber: 41, id: "guia_iii_41", text: "Mi jefe ayuda a solucionar los problemas que se presentan en el trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Liderazgo", dimension: "Características del liderazgo", gate: null },
  { questionNumber: 42, id: "guia_iii_42", text: "Puedo confiar en mis compañeros de trabajo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 43, id: "guia_iii_43", text: "Entre compañeros solucionamos los problemas de trabajo de forma respetuosa", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 44, id: "guia_iii_44", text: "En mi trabajo me hacen sentir parte del grupo", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 45, id: "guia_iii_45", text: "Cuando tenemos que realizar trabajo de equipo los compañeros colaboran", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 46, id: "guia_iii_46", text: "Mis compañeros de trabajo me ayudan cuando tengo dificultades", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Relaciones sociales en el trabajo", gate: null },
  { questionNumber: 47, id: "guia_iii_47", text: "Me informan sobre lo que hago bien en mi trabajo", scoring: "reverse", category: "Entorno organizacional", domain: "Reconocimiento del desempeño", dimension: "Escasa o nula retroalimentación del desempeño", gate: null },
  { questionNumber: 48, id: "guia_iii_48", text: "La forma como evalúan mi trabajo en mi centro de trabajo me ayuda a mejorar mi desempeño", scoring: "reverse", category: "Entorno organizacional", domain: "Reconocimiento del desempeño", dimension: "Escasa o nula retroalimentación del desempeño", gate: null },
  { questionNumber: 49, id: "guia_iii_49", text: "En mi centro de trabajo me pagan a tiempo mi salario", scoring: "reverse", category: "Entorno organizacional", domain: "Reconocimiento del desempeño", dimension: "Escaso o nulo reconocimiento y compensación", gate: null },
  { questionNumber: 50, id: "guia_iii_50", text: "El pago que recibo es el que merezco por el trabajo que realizo", scoring: "reverse", category: "Entorno organizacional", domain: "Reconocimiento del desempeño", dimension: "Escaso o nulo reconocimiento y compensación", gate: null },
  { questionNumber: 51, id: "guia_iii_51", text: "Si obtengo los resultados esperados en mi trabajo me recompensan o reconocen", scoring: "reverse", category: "Entorno organizacional", domain: "Reconocimiento del desempeño", dimension: "Escaso o nulo reconocimiento y compensación", gate: null },
  { questionNumber: 52, id: "guia_iii_52", text: "Las personas que hacen bien el trabajo pueden crecer laboralmente", scoring: "reverse", category: "Entorno organizacional", domain: "Reconocimiento del desempeño", dimension: "Escaso o nulo reconocimiento y compensación", gate: null },
  { questionNumber: 53, id: "guia_iii_53", text: "Considero que mi trabajo es estable", scoring: "reverse", category: "Entorno organizacional", domain: "Insuficiente sentido de pertenencia e inestabilidad", dimension: "Inestabilidad laboral", gate: null },
  { questionNumber: 54, id: "guia_iii_54", text: "En mi trabajo existe continua rotación de personal", scoring: "direct", category: "Entorno organizacional", domain: "Insuficiente sentido de pertenencia e inestabilidad", dimension: "Inestabilidad laboral", gate: null },
  { questionNumber: 55, id: "guia_iii_55", text: "Siento orgullo de laborar en este centro de trabajo", scoring: "reverse", category: "Entorno organizacional", domain: "Insuficiente sentido de pertenencia e inestabilidad", dimension: "Limitado sentido de pertenencia", gate: null },
  { questionNumber: 56, id: "guia_iii_56", text: "Me siento comprometido con mi trabajo", scoring: "reverse", category: "Entorno organizacional", domain: "Insuficiente sentido de pertenencia e inestabilidad", dimension: "Limitado sentido de pertenencia", gate: null },
  { questionNumber: 57, id: "guia_iii_57", text: "En mi trabajo puedo expresarme libremente sin interrupciones", scoring: "reverse", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 58, id: "guia_iii_58", text: "Recibo críticas constantes a mi persona y/o trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 59, id: "guia_iii_59", text: "Recibo burlas, calumnias, difamaciones, humillaciones o ridiculizaciones", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 60, id: "guia_iii_60", text: "Se ignora mi presencia o se me excluye de las reuniones de trabajo y en la toma de decisiones", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 61, id: "guia_iii_61", text: "Se manipulan las situaciones de trabajo para hacerme parecer un mal trabajador", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 62, id: "guia_iii_62", text: "Se ignoran mis éxitos laborales y se atribuyen a otros trabajadores", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 63, id: "guia_iii_63", text: "Me bloquean o impiden las oportunidades que tengo para obtener ascenso o mejora en mi trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 64, id: "guia_iii_64", text: "He presenciado actos de violencia en mi centro de trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Violencia", dimension: "Violencia laboral", gate: null },
  { questionNumber: 65, id: "guia_iii_65", text: "Atiendo clientes o usuarios muy enojados", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas psicológicas emocionales", gate: "clientes" },
  { questionNumber: 66, id: "guia_iii_66", text: "Mi trabajo me exige atender personas muy necesitadas de ayuda o enfermas", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas psicológicas emocionales", gate: "clientes" },
  { questionNumber: 67, id: "guia_iii_67", text: "Para hacer mi trabajo debo demostrar sentimientos distintos a los míos", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas psicológicas emocionales", gate: "clientes" },
  { questionNumber: 68, id: "guia_iii_68", text: "Mi trabajo me exige atender situaciones de violencia", scoring: "direct", category: "Factores propios de la actividad", domain: "Carga de trabajo", dimension: "Cargas psicológicas emocionales", gate: "clientes" },
  { questionNumber: 69, id: "guia_iii_69", text: "Comunican tarde los asuntos de trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Deficiente relación con los colaboradores que supervisa", gate: "jefe" },
  { questionNumber: 70, id: "guia_iii_70", text: "Dificultan el logro de los resultados del trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Deficiente relación con los colaboradores que supervisa", gate: "jefe" },
  { questionNumber: 71, id: "guia_iii_71", text: "Cooperan poco cuando se necesita", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Deficiente relación con los colaboradores que supervisa", gate: "jefe" },
  { questionNumber: 72, id: "guia_iii_72", text: "Ignoran las sugerencias para mejorar su trabajo", scoring: "direct", category: "Liderazgo y relaciones en el trabajo", domain: "Relaciones en el trabajo", dimension: "Deficiente relación con los colaboradores que supervisa", gate: "jefe" },
];

export const GUIA_III_MANIFEST_BY_NUMBER = new Map(
  GUIA_III_MANIFEST.map((item) => [item.questionNumber, item])
);

export const GUIA_III_REVERSE_SCORED_ITEMS = new Set(
  GUIA_III_MANIFEST.filter((i) => i.scoring === "reverse").map((i) => i.questionNumber)
);

export const GUIA_III_DIRECT_SCORED_ITEMS = new Set(
  GUIA_III_MANIFEST.filter((i) => i.scoring === "direct").map((i) => i.questionNumber)
);

export interface GuiaIIIThresholdsCanon {
  bajoMin: number;
  medioMin: number;
  altoMin: number;
  muyAltoMin: number;
}

/** Política: inferior inclusivo, superior exclusivo, último >= (docs/SCORING_BOUNDARY_POLICY.md). */
export const GUIA_III_FINAL_THRESHOLDS: GuiaIIIThresholdsCanon = {
  bajoMin: 50,
  medioMin: 75,
  altoMin: 99,
  muyAltoMin: 140,
};

export const GUIA_III_CATEGORY_THRESHOLDS: Record<string, GuiaIIIThresholdsCanon> = {
  "Ambiente de trabajo": { bajoMin: 5, medioMin: 9, altoMin: 11, muyAltoMin: 14 },
  "Factores propios de la actividad": { bajoMin: 15, medioMin: 30, altoMin: 45, muyAltoMin: 60 },
  "Organización del tiempo de trabajo": { bajoMin: 5, medioMin: 7, altoMin: 10, muyAltoMin: 13 },
  "Liderazgo y relaciones en el trabajo": { bajoMin: 14, medioMin: 29, altoMin: 42, muyAltoMin: 58 },
  "Entorno organizacional": { bajoMin: 10, medioMin: 14, altoMin: 18, muyAltoMin: 23 },
};

export const GUIA_III_DOMAIN_THRESHOLDS: Record<string, GuiaIIIThresholdsCanon> = {
  "Condiciones en el ambiente de trabajo": { bajoMin: 5, medioMin: 9, altoMin: 11, muyAltoMin: 14 },
  "Carga de trabajo": { bajoMin: 15, medioMin: 21, altoMin: 27, muyAltoMin: 37 },
  "Falta de control sobre el trabajo": { bajoMin: 11, medioMin: 16, altoMin: 21, muyAltoMin: 25 },
  "Jornada de trabajo": { bajoMin: 1, medioMin: 2, altoMin: 4, muyAltoMin: 6 },
  "Interferencia en la relación trabajo-familia": { bajoMin: 4, medioMin: 6, altoMin: 8, muyAltoMin: 10 },
  Liderazgo: { bajoMin: 9, medioMin: 12, altoMin: 16, muyAltoMin: 20 },
  "Relaciones en el trabajo": { bajoMin: 10, medioMin: 13, altoMin: 17, muyAltoMin: 21 },
  Violencia: { bajoMin: 7, medioMin: 10, altoMin: 13, muyAltoMin: 16 },
  "Reconocimiento del desempeño": { bajoMin: 6, medioMin: 10, altoMin: 14, muyAltoMin: 18 },
  "Insuficiente sentido de pertenencia e inestabilidad": {
    bajoMin: 4,
    medioMin: 6,
    altoMin: 8,
    muyAltoMin: 10,
  },
};

export const GUIA_III_ACTION_BY_LEVEL: Record<RiskLevelNom035, string> = {
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

export function buildGuiaIIIGroupsFromManifest() {
  type Dim = { name: string; questions: number[] };
  type Dom = { name: string; dimensions: Dim[] };
  type Cat = { name: string; domains: Dom[] };

  const categories: Cat[] = [];
  const catMap = new Map<string, Cat>();
  const domMap = new Map<string, Dom>();
  const dimMap = new Map<string, Dim>();

  for (const item of GUIA_III_MANIFEST) {
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
