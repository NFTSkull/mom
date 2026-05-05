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

export const GUIA_II_GROUPS: GuiaIICategoryGroup[] = [
  {
    name: "Ambiente de trabajo",
    domains: [
      {
        name: "Condiciones en el ambiente de trabajo",
        dimensions: [
          { name: "Condiciones peligrosas e inseguras", questions: [2] },
          { name: "Condiciones deficientes e insalubres", questions: [1] },
          { name: "Trabajos peligrosos", questions: [3] },
        ],
      },
    ],
  },
  {
    name: "Factores propios de la actividad",
    domains: [
      {
        name: "Carga de trabajo",
        dimensions: [
          { name: "Cargas cuantitativas", questions: [4, 9] },
          { name: "Ritmos de trabajo acelerado", questions: [5, 6] },
          { name: "Carga mental", questions: [7, 8] },
          { name: "Cargas psicologicas emocionales", questions: [41, 42, 43] },
          { name: "Cargas de alta responsabilidad", questions: [10, 11] },
          { name: "Cargas contradictorias o inconsistentes", questions: [12, 13] },
        ],
      },
      {
        name: "Falta de control sobre el trabajo",
        dimensions: [
          { name: "Falta de control y autonomia sobre el trabajo", questions: [20, 21, 22] },
          { name: "Limitada o nula posibilidad de desarrollo", questions: [18, 19] },
          { name: "Limitada o inexistente capacitacion", questions: [26, 27] },
        ],
      },
    ],
  },
  {
    name: "Organizacion del tiempo de trabajo",
    domains: [
      {
        name: "Jornada de trabajo",
        dimensions: [{ name: "Jornadas de trabajo extensas", questions: [14, 15] }],
      },
      {
        name: "Interferencia en la relacion trabajo-familia",
        dimensions: [
          { name: "Influencia del trabajo fuera del centro laboral", questions: [16] },
          { name: "Influencia de las responsabilidades familiares", questions: [17] },
        ],
      },
    ],
  },
  {
    name: "Liderazgo y relaciones en el trabajo",
    domains: [
      {
        name: "Liderazgo",
        dimensions: [
          { name: "Escasa claridad de funciones", questions: [23, 24, 25] },
          { name: "Caracteristicas del liderazgo", questions: [28, 29] },
        ],
      },
      {
        name: "Relaciones en el trabajo",
        dimensions: [
          { name: "Relaciones sociales en el trabajo", questions: [30, 31, 32] },
          { name: "Deficiente relacion con los colaboradores que supervisa", questions: [44, 45, 46] },
        ],
      },
      {
        name: "Violencia",
        dimensions: [{ name: "Violencia laboral", questions: [33, 34, 35, 36, 37, 38, 39, 40] }],
      },
    ],
  },
];
