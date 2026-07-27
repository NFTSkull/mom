export type QuestionnaireType = "GUIA_I" | "GUIA_II" | "GUIA_III";
export type QuestionnaireCode = QuestionnaireType;

export type WorkerStatus = "ACTIVE" | "INACTIVE";

export interface CompanyConfig {
  id: string;
  legalName: string;
  commercialName: string;
  rfc: string;
  address?: string;
  phone?: string;
  mainActivity?: string;
  workplaceCount: number;
  employeeCount: number;
}

export interface Worker {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  phone?: string;
  department: string;
  position: string;
  shift?: string;
  branch?: string;
  directManager?: string;
  seniority?: string;
  status: WorkerStatus;
}

export interface Campaign {
  id: string;
  name: string;
  startsAtISO: string;
  endsAtISO: string;
  questionnaireTypes: QuestionnaireType[];
  workerIds: string[];
}

export type AnswerValue = 0 | 1 | 2 | 3 | 4;
export type YesNoAnswerValue = 0 | 1;
export type GuiaIILikertAnswer =
  | "siempre"
  | "casi_siempre"
  | "algunas_veces"
  | "casi_nunca"
  | "nunca";
export type GuiaIIGateAnswer = "si" | "no";
export type RiskLevelNom035 = "nulo" | "bajo" | "medio" | "alto" | "muy_alto";

export interface Nom035Question {
  id: string;
  questionnaireCode: QuestionnaireCode;
  section: "I" | "II" | "III" | "IV";
  sectionTitle: string;
  text: string;
  responseType: "yes_no";
  order: number;
}

export interface EvaluationResponse {
  questionId: string;
  value: AnswerValue;
}

export interface GuiaIResult {
  questionnaireCode: "GUIA_I";
  traumaticEvent: boolean;
  sectionIIScore: number;
  sectionIIIScore: number;
  sectionIVScore: number;
  requiresClinicalAttention: boolean;
  riskLabel: "sin_alerta" | "requiere_seguimiento_confidencial";
  alerts: string[];
  scoringVersion?: string;
  questionnaireVersion?: string;
  calculatedAt?: string;
  validationWarnings?: string[];
}

export interface GuiaIIQuestion {
  id: string;
  questionnaireCode: "GUIA_II";
  questionNumber: number;
  text: string;
  responseType: "likert";
  order: number;
}

export interface GuiaIIGateQuestion {
  id: "guia_ii_gate_clientes" | "guia_ii_gate_jefe";
  questionnaireCode: "GUIA_II";
  text: string;
  responseType: "yes_no";
  order: number;
  controlsQuestions: number[];
}

export interface GuiaIIThresholds {
  bajoMin: number;
  medioMin: number;
  altoMin: number;
  muyAltoMin: number;
}

export interface GuiaIIResult {
  questionnaireCode: "GUIA_II";
  finalScore: number;
  finalRiskLevel: RiskLevelNom035;
  categoryScores: Record<string, { score: number; riskLevel: RiskLevelNom035 }>;
  domainScores: Record<string, { score: number; riskLevel: RiskLevelNom035 }>;
  dimensionScores: Record<string, { score: number }>;
  skippedQuestions: number[];
  alerts: string[];
  scoringVersion?: string;
  questionnaireVersion?: string;
  calculatedAt?: string;
  validationWarnings?: string[];
}

export interface GuiaIIAnswers {
  gateClientes: GuiaIIGateAnswer;
  gateJefe: GuiaIIGateAnswer;
  responses: Partial<Record<number, GuiaIILikertAnswer>>;
}

export interface EvaluationRecord {
  id: string;
  campaignId: string;
  workerId: string;
  token: string;
  questionnaireType: QuestionnaireType;
  responses: EvaluationResponse[];
  submittedAtISO: string | null;
  calculated: GuiaIResult | null;
  status: "pending" | "in_progress" | "completed";
  completedAt: string | null;
  guiaIAnswers: EvaluationResponse[];
  guiaIIAnswers: GuiaIIAnswers | null;
  guiaIResult: GuiaIResult | null;
  guiaIIResult: GuiaIIResult | null;
}

export interface WorkerEvaluationLink {
  workerId: string;
  campaignId: string;
  token: string;
  url: string;
}

export interface CampaignAssignment {
  id: string;
  campaignId: string;
  workerId: string;
  token: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionPlanItem {
  id: string;
  campaignId: string;
  area: string;
  riskFactor: string;
  riskLevel: RiskLevelNom035;
  actionLevel: "primer_nivel" | "segundo_nivel" | "tercer_nivel";
  actionType: "organizacional" | "grupal" | "individual_confidencial";
  description: string;
  responsible: string;
  dueDate: string;
  status: "pendiente" | "en_proceso" | "completada" | "cancelada";
  followUpNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceItem {
  id: string;
  campaignId?: string;
  title: string;
  evidenceType:
    | "politica"
    | "difusion"
    | "resultados"
    | "reporte"
    | "capacitacion"
    | "plan_accion"
    | "quejas"
    | "canalizacion"
    | "otro";
  description: string;
  fileName?: string;
  fileUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfidentialComplaint {
  id: string;
  folio: string;
  complaintType:
    | "violencia_laboral"
    | "entorno_organizacional"
    | "factores_riesgo_psicosocial"
    | "otro";
  description: string;
  isAnonymous: boolean;
  reporterName?: string;
  reporterContact?: string;
  status: "recibida" | "en_revision" | "resuelta" | "cerrada";
  assignedTo?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  content: string;
  version: string;
  status: "borrador" | "publicada";
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
