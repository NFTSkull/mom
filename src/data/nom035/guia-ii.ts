import type { GuiaIIGateQuestion, GuiaIIQuestion } from "@/types/nom035";

export const GUIA_II_GATES: GuiaIIGateQuestion[] = [
  {
    id: "guia_ii_gate_clientes",
    questionnaireCode: "GUIA_II",
    text: "En mi trabajo debo brindar servicio a clientes o usuarios:",
    responseType: "yes_no",
    order: 40.5,
    controlsQuestions: [41, 42, 43],
  },
  {
    id: "guia_ii_gate_jefe",
    questionnaireCode: "GUIA_II",
    text: "Soy jefe de otros trabajadores:",
    responseType: "yes_no",
    order: 43.5,
    controlsQuestions: [44, 45, 46],
  },
];

export const GUIA_II_QUESTIONS: GuiaIIQuestion[] = [
  { id: "guia_ii_1", questionnaireCode: "GUIA_II", questionNumber: 1, text: "Mi trabajo me exige hacer mucho esfuerzo fisico", responseType: "likert", order: 1 },
  { id: "guia_ii_2", questionnaireCode: "GUIA_II", questionNumber: 2, text: "Me preocupa sufrir un accidente en mi trabajo", responseType: "likert", order: 2 },
  { id: "guia_ii_3", questionnaireCode: "GUIA_II", questionNumber: 3, text: "Considero que las actividades que realizo son peligrosas", responseType: "likert", order: 3 },
  { id: "guia_ii_4", questionnaireCode: "GUIA_II", questionNumber: 4, text: "Por la cantidad de trabajo que tengo debo quedarme tiempo adicional a mi turno", responseType: "likert", order: 4 },
  { id: "guia_ii_5", questionnaireCode: "GUIA_II", questionNumber: 5, text: "Por la cantidad de trabajo que tengo debo trabajar sin parar", responseType: "likert", order: 5 },
  { id: "guia_ii_6", questionnaireCode: "GUIA_II", questionNumber: 6, text: "Considero que es necesario mantener un ritmo de trabajo acelerado", responseType: "likert", order: 6 },
  { id: "guia_ii_7", questionnaireCode: "GUIA_II", questionNumber: 7, text: "Mi trabajo exige que este muy concentrado", responseType: "likert", order: 7 },
  { id: "guia_ii_8", questionnaireCode: "GUIA_II", questionNumber: 8, text: "Mi trabajo requiere que memorice mucha informacion", responseType: "likert", order: 8 },
  { id: "guia_ii_9", questionnaireCode: "GUIA_II", questionNumber: 9, text: "Mi trabajo exige que atienda varios asuntos al mismo tiempo", responseType: "likert", order: 9 },
  { id: "guia_ii_10", questionnaireCode: "GUIA_II", questionNumber: 10, text: "En mi trabajo soy responsable de cosas de mucho valor", responseType: "likert", order: 10 },
  { id: "guia_ii_11", questionnaireCode: "GUIA_II", questionNumber: 11, text: "Respondo ante mi jefe por los resultados de toda mi area de trabajo", responseType: "likert", order: 11 },
  { id: "guia_ii_12", questionnaireCode: "GUIA_II", questionNumber: 12, text: "En mi trabajo me dan ordenes contradictorias", responseType: "likert", order: 12 },
  { id: "guia_ii_13", questionnaireCode: "GUIA_II", questionNumber: 13, text: "Considero que en mi trabajo me piden hacer cosas innecesarias", responseType: "likert", order: 13 },
  { id: "guia_ii_14", questionnaireCode: "GUIA_II", questionNumber: 14, text: "Trabajo horas extras mas de tres veces a la semana", responseType: "likert", order: 14 },
  { id: "guia_ii_15", questionnaireCode: "GUIA_II", questionNumber: 15, text: "Mi trabajo me exige laborar en dias de descanso, festivos o fines de semana", responseType: "likert", order: 15 },
  { id: "guia_ii_16", questionnaireCode: "GUIA_II", questionNumber: 16, text: "Considero que el tiempo en el trabajo es mucho y perjudica mis actividades familiares o personales", responseType: "likert", order: 16 },
  { id: "guia_ii_17", questionnaireCode: "GUIA_II", questionNumber: 17, text: "Pienso en las actividades familiares o personales cuando estoy en mi trabajo", responseType: "likert", order: 17 },
  { id: "guia_ii_18", questionnaireCode: "GUIA_II", questionNumber: 18, text: "Mi trabajo permite que desarrolle nuevas habilidades", responseType: "likert", order: 18 },
  { id: "guia_ii_19", questionnaireCode: "GUIA_II", questionNumber: 19, text: "En mi trabajo puedo aspirar a un mejor puesto", responseType: "likert", order: 19 },
  { id: "guia_ii_20", questionnaireCode: "GUIA_II", questionNumber: 20, text: "Durante mi jornada de trabajo puedo tomar pausas cuando las necesito", responseType: "likert", order: 20 },
  { id: "guia_ii_21", questionnaireCode: "GUIA_II", questionNumber: 21, text: "Puedo decidir la velocidad a la que realizo mis actividades en mi trabajo", responseType: "likert", order: 21 },
  { id: "guia_ii_22", questionnaireCode: "GUIA_II", questionNumber: 22, text: "Puedo cambiar el orden de las actividades que realizo en mi trabajo", responseType: "likert", order: 22 },
  { id: "guia_ii_23", questionnaireCode: "GUIA_II", questionNumber: 23, text: "Me informan con claridad cuales son mis funciones", responseType: "likert", order: 23 },
  { id: "guia_ii_24", questionnaireCode: "GUIA_II", questionNumber: 24, text: "Me explican claramente los resultados que debo obtener en mi trabajo", responseType: "likert", order: 24 },
  { id: "guia_ii_25", questionnaireCode: "GUIA_II", questionNumber: 25, text: "Me informan con quien puedo resolver problemas o asuntos de trabajo", responseType: "likert", order: 25 },
  { id: "guia_ii_26", questionnaireCode: "GUIA_II", questionNumber: 26, text: "Me permiten asistir a capacitaciones relacionadas con mi trabajo", responseType: "likert", order: 26 },
  { id: "guia_ii_27", questionnaireCode: "GUIA_II", questionNumber: 27, text: "Recibo capacitacion util para hacer mi trabajo", responseType: "likert", order: 27 },
  { id: "guia_ii_28", questionnaireCode: "GUIA_II", questionNumber: 28, text: "Mi jefe tiene en cuenta mis puntos de vista y opiniones", responseType: "likert", order: 28 },
  { id: "guia_ii_29", questionnaireCode: "GUIA_II", questionNumber: 29, text: "Mi jefe ayuda a solucionar los problemas que se presentan en el trabajo", responseType: "likert", order: 29 },
  { id: "guia_ii_30", questionnaireCode: "GUIA_II", questionNumber: 30, text: "Puedo confiar en mis companeros de trabajo", responseType: "likert", order: 30 },
  { id: "guia_ii_31", questionnaireCode: "GUIA_II", questionNumber: 31, text: "Cuando tenemos que realizar trabajo de equipo los companeros colaboran", responseType: "likert", order: 31 },
  { id: "guia_ii_32", questionnaireCode: "GUIA_II", questionNumber: 32, text: "Mis companeros de trabajo me ayudan cuando tengo dificultades", responseType: "likert", order: 32 },
  { id: "guia_ii_33", questionnaireCode: "GUIA_II", questionNumber: 33, text: "En mi trabajo puedo expresarme libremente sin interrupciones", responseType: "likert", order: 33 },
  { id: "guia_ii_34", questionnaireCode: "GUIA_II", questionNumber: 34, text: "Recibo criticas constantes a mi persona y/o trabajo", responseType: "likert", order: 34 },
  { id: "guia_ii_35", questionnaireCode: "GUIA_II", questionNumber: 35, text: "Recibo burlas, calumnias, difamaciones, humillaciones o ridiculizaciones", responseType: "likert", order: 35 },
  { id: "guia_ii_36", questionnaireCode: "GUIA_II", questionNumber: 36, text: "Se ignora mi presencia o se me excluye de las reuniones de trabajo y en la toma de decisiones", responseType: "likert", order: 36 },
  { id: "guia_ii_37", questionnaireCode: "GUIA_II", questionNumber: 37, text: "Se manipulan las situaciones de trabajo para hacerme parecer un mal trabajador", responseType: "likert", order: 37 },
  { id: "guia_ii_38", questionnaireCode: "GUIA_II", questionNumber: 38, text: "Se ignoran mis exitos laborales y se atribuyen a otros trabajadores", responseType: "likert", order: 38 },
  { id: "guia_ii_39", questionnaireCode: "GUIA_II", questionNumber: 39, text: "Me bloquean o impiden las oportunidades que tengo para obtener ascenso o mejora en mi trabajo", responseType: "likert", order: 39 },
  { id: "guia_ii_40", questionnaireCode: "GUIA_II", questionNumber: 40, text: "He presenciado actos de violencia en mi centro de trabajo", responseType: "likert", order: 40 },
  { id: "guia_ii_41", questionnaireCode: "GUIA_II", questionNumber: 41, text: "Atiendo clientes o usuarios muy enojados", responseType: "likert", order: 41 },
  { id: "guia_ii_42", questionnaireCode: "GUIA_II", questionNumber: 42, text: "Mi trabajo me exige atender personas muy necesitadas de ayuda o enfermas", responseType: "likert", order: 42 },
  { id: "guia_ii_43", questionnaireCode: "GUIA_II", questionNumber: 43, text: "Para hacer mi trabajo debo demostrar sentimientos distintos a los mios", responseType: "likert", order: 43 },
  { id: "guia_ii_44", questionnaireCode: "GUIA_II", questionNumber: 44, text: "Comunican tarde los asuntos de trabajo", responseType: "likert", order: 44 },
  { id: "guia_ii_45", questionnaireCode: "GUIA_II", questionNumber: 45, text: "Dificultan el logro de los resultados del trabajo", responseType: "likert", order: 45 },
  { id: "guia_ii_46", questionnaireCode: "GUIA_II", questionNumber: 46, text: "Ignoran las sugerencias para mejorar su trabajo", responseType: "likert", order: 46 },
];

export const GUIA_II_REVERSE_SCORED_ITEMS = new Set([
  18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
]);

export const GUIA_II_DIRECT_SCORED_ITEMS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 34, 35, 36, 37, 38, 39, 40, 41,
  42, 43, 44, 45, 46,
]);
