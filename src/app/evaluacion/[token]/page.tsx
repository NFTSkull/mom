"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { GUIA_I_QUESTIONS, GUIA_I_SECTION_I_ID } from "@/data/nom035/guia-i";
import { GUIA_II_QUESTIONS } from "@/data/nom035/guia-ii";
import { getRequiredQuestionnaires } from "@/lib/nom035/get-required-questionnaires";
import { calculateGuiaIIResult, calculateGuiaIResult } from "@/lib/nom035/scoring-engine";
import {
  finalizeCompleteEvaluationByTokenLocal,
  getCompanyConfigLocal,
  saveGuiaIProgressByTokenLocal,
  saveGuiaIIProgressByTokenLocal,
  seedNom035LocalData,
} from "@/lib/nom035/storage-local";
import type { GuiaIIGateAnswer, GuiaIILikertAnswer } from "@/types/nom035";

const OPTIONS = [
  { value: 1, label: "Si" },
  { value: 0, label: "No" },
] as const;

const LIKERT_OPTIONS: Array<{ value: GuiaIILikertAnswer; label: string }> = [
  { value: "siempre", label: "Siempre" },
  { value: "casi_siempre", label: "Casi siempre" },
  { value: "algunas_veces", label: "Algunas veces" },
  { value: "casi_nunca", label: "Casi nunca" },
  { value: "nunca", label: "Nunca" },
];

type FlowStage = "welcome" | "guia_i" | "guia_ii";

interface GuiaIIBlock {
  id: string;
  title: string;
  description: string;
  questionNumbers: number[];
  gate?: "clientes" | "jefe";
}

const GUIA_II_BLOCKS: GuiaIIBlock[] = [
  {
    id: "guia-ii-b1",
    title: "Guia II - Bloque 1",
    description: "Condiciones iniciales de trabajo.",
    questionNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: "guia-ii-b2",
    title: "Guia II - Bloque 2",
    description: "Demandas y tiempo de trabajo.",
    questionNumbers: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  },
  {
    id: "guia-ii-b3",
    title: "Guia II - Bloque 3",
    description: "Control, desarrollo y funciones.",
    questionNumbers: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  },
  {
    id: "guia-ii-b4",
    title: "Guia II - Bloque 4",
    description: "Relaciones y violencia laboral.",
    questionNumbers: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
  },
  {
    id: "guia-ii-b5",
    title: "Guia II - Atencion a clientes o usuarios",
    description: "Primero responde la compuerta y despues, si aplica, las preguntas de esta seccion.",
    questionNumbers: [41, 42, 43],
    gate: "clientes",
  },
  {
    id: "guia-ii-b6",
    title: "Guia II - Supervisión de personal",
    description: "Primero responde la compuerta y despues, si aplica, las preguntas de esta seccion.",
    questionNumbers: [44, 45, 46],
    gate: "jefe",
  },
];

export default function EvaluacionPorTokenPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [stage, setStage] = useState<FlowStage>("welcome");
  const [guiaIAnswers, setGuiaIAnswers] = useState<Record<string, number>>({});
  const [guiaIError, setGuiaIError] = useState<string>("");
  const [guiaIIAnswers, setGuiaIIAnswers] = useState<Record<number, GuiaIILikertAnswer>>({});
  const [guiaIIError, setGuiaIIError] = useState<string>("");
  const [guiaIIStep, setGuiaIIStep] = useState<number>(0);
  const [gateClientes, setGateClientes] = useState<GuiaIIGateAnswer | undefined>(undefined);
  const [gateJefe, setGateJefe] = useState<GuiaIIGateAnswer | undefined>(undefined);

  seedNom035LocalData();
  const company = getCompanyConfigLocal();
  const requiredQuestionnaires = getRequiredQuestionnaires(company.employeeCount);
  const shouldApplyGuiaII = company.employeeCount >= 16 && company.employeeCount <= 50;
  const guiaIIQuestionMap = new Map(GUIA_II_QUESTIONS.map((question) => [question.questionNumber, question]));

  const orderedQuestions = [...GUIA_I_QUESTIONS].sort((a, b) => a.order - b.order);
  const sectionIQuestions = orderedQuestions.filter((question) => question.section === "I");
  const remainingQuestions = orderedQuestions.filter((question) => question.section !== "I");

  const hasTraumaticEvent = guiaIAnswers[GUIA_I_SECTION_I_ID] === 1;
  const visibleQuestions = hasTraumaticEvent
    ? orderedQuestions
    : sectionIQuestions;
  const currentGuiaIIBlock = GUIA_II_BLOCKS[guiaIIStep];
  const guiaIIProgress = Math.round(((guiaIIStep + 1) / GUIA_II_BLOCKS.length) * 100);

  function onSelect(questionId: string, value: number): void {
    setGuiaIError("");
    setGuiaIAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function onSubmitGuiaI(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const resolvedToken = params.token;

    const hasMissingAnswers = visibleQuestions.some((question) => guiaIAnswers[question.id] === undefined);
    if (hasMissingAnswers) {
      setGuiaIError("Debes responder todas las preguntas visibles antes de continuar.");
      return;
    }

    const responses = visibleQuestions.map((question) => ({
      questionId: question.id,
      value: (guiaIAnswers[question.id] ?? 0) as 0 | 1,
    }));

    saveGuiaIProgressByTokenLocal(resolvedToken, responses);
    const guiaIResult = calculateGuiaIResult(responses);

    if (shouldApplyGuiaII) {
      setStage("guia_ii");
      return;
    }

    finalizeCompleteEvaluationByTokenLocal(resolvedToken, {
      guiaIAnswers: responses,
      guiaIIAnswers: null,
      guiaIResult,
      guiaIIResult: null,
    });
    router.push(`/evaluacion/${resolvedToken}/gracias`);
  }

  function updateGuiaIIAnswer(questionNumber: number, value: GuiaIILikertAnswer): void {
    setGuiaIIError("");
    setGuiaIIAnswers((prev) => ({ ...prev, [questionNumber]: value }));
  }

  function getCurrentGateValue(): GuiaIIGateAnswer | undefined {
    if (!currentGuiaIIBlock.gate) return undefined;
    if (currentGuiaIIBlock.gate === "clientes") return gateClientes;
    return gateJefe;
  }

  function setCurrentGateValue(value: GuiaIIGateAnswer): void {
    setGuiaIIError("");
    if (currentGuiaIIBlock.gate === "clientes") setGateClientes(value);
    if (currentGuiaIIBlock.gate === "jefe") setGateJefe(value);
  }

  function validateCurrentGuiaIIBlock(): boolean {
    const gateValue = getCurrentGateValue();
    if (currentGuiaIIBlock.gate && !gateValue) {
      setGuiaIIError("Debes responder la pregunta de compuerta para continuar.");
      return false;
    }

    if (currentGuiaIIBlock.gate && gateValue === "no") return true;

    const missing = currentGuiaIIBlock.questionNumbers.some(
      (questionNumber) => guiaIIAnswers[questionNumber] === undefined
    );
    if (missing) {
      setGuiaIIError("Debes responder todas las preguntas visibles del bloque actual.");
      return false;
    }
    return true;
  }

  function onPreviousGuiaIIBlock(): void {
    setGuiaIIError("");
    setGuiaIIStep((prev) => Math.max(0, prev - 1));
  }

  function onNextGuiaIIBlock(): void {
    if (!validateCurrentGuiaIIBlock()) return;
    saveGuiaIIProgressByTokenLocal(params.token, {
      gateClientes: gateClientes ?? "no",
      gateJefe: gateJefe ?? "no",
      responses: guiaIIAnswers,
    });
    setGuiaIIStep((prev) => Math.min(GUIA_II_BLOCKS.length - 1, prev + 1));
  }

  async function onFinishGuiaII(): Promise<void> {
    if (!validateCurrentGuiaIIBlock()) return;

    const resolvedToken = params.token;
    const guiaIResponses = visibleQuestions.map((question) => ({
      questionId: question.id,
      value: (guiaIAnswers[question.id] ?? 0) as 0 | 1,
    }));
    const guiaIResult = calculateGuiaIResult(guiaIResponses);
    const guiaIIPayload = {
      gateClientes: gateClientes ?? "no",
      gateJefe: gateJefe ?? "no",
      responses: guiaIIAnswers,
    };
    const guiaIIResult = calculateGuiaIIResult(guiaIIPayload);

    finalizeCompleteEvaluationByTokenLocal(resolvedToken, {
      guiaIAnswers: guiaIResponses,
      guiaIIAnswers: guiaIIPayload,
      guiaIResult,
      guiaIIResult,
    });
    router.push(`/evaluacion/${resolvedToken}/gracias`);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <main className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <header className="space-y-2 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Evaluacion NOM-035</h1>
          <p className="text-sm text-slate-700">
            Estas por responder una evaluacion confidencial sobre factores psicosociales en el trabajo.
          </p>
          <p className="text-sm text-slate-700">No hay respuestas correctas o incorrectas.</p>
          <p className="text-sm text-slate-700">Tus respuestas seran tratadas con confidencialidad.</p>
          {requiredQuestionnaires.includes("GUIA_III") ? (
            <p className="text-xs text-slate-500">
              Nota interna: Guia III pendiente de integracion en este MVP.
            </p>
          ) : null}
        </header>

        {stage === "welcome" ? (
          <section className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              Iniciaras con Guia I y, segun el tamano de la empresa, se continuara con Guia II.
            </p>
            <button
              type="button"
              onClick={() => setStage("guia_i")}
              className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
            >
              Iniciar evaluacion
            </button>
          </section>
        ) : null}

        {stage === "guia_i" ? (
          <form className="mt-5 space-y-4" onSubmit={onSubmitGuiaI}>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Guia I {shouldApplyGuiaII ? "(Paso 1 de 2)" : ""}
            </div>

            {visibleQuestions.map((question) => (
              <fieldset
                key={question.id}
                className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
              >
                <legend className="font-medium leading-6 text-slate-900">{question.text}</legend>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Seccion {question.section}: {question.sectionTitle}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.value}
                        checked={guiaIAnswers[question.id] === option.value}
                        onChange={() => onSelect(question.id, option.value)}
                        className="accent-slate-700"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            {guiaIAnswers[GUIA_I_SECTION_I_ID] === 1 && remainingQuestions.length > 0 ? (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Detectamos respuesta afirmativa en la seccion I. Debes contestar las secciones II, III y IV.
              </p>
            ) : null}

            {guiaIAnswers[GUIA_I_SECTION_I_ID] === 0 ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Respondiste NO en seccion I. Puedes continuar con el siguiente paso.
              </p>
            ) : null}

            {guiaIError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {guiaIError}
              </p>
            ) : null}

            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
            >
              {shouldApplyGuiaII ? "Continuar a Guia II" : "Finalizar evaluacion"}
            </button>
          </form>
        ) : null}

        {stage === "guia_ii" ? (
          <section className="mt-5 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Guia II - Paso {guiaIIStep + 1} de {GUIA_II_BLOCKS.length}
              </p>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-slate-700"
                  style={{ width: `${guiaIIProgress}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">{currentGuiaIIBlock.title}</h2>
              <p className="mt-1 text-sm text-slate-700">{currentGuiaIIBlock.description}</p>
            </div>

            {currentGuiaIIBlock.gate ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">
                  {currentGuiaIIBlock.gate === "clientes"
                    ? "En mi trabajo debo brindar servicio a clientes o usuarios:"
                    : "Soy jefe de otros trabajadores:"}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(["si", "no"] as const).map((value) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                    >
                      <input
                        type="radio"
                        name={`gate-${currentGuiaIIBlock.gate}`}
                        checked={getCurrentGateValue() === value}
                        onChange={() => setCurrentGateValue(value)}
                        className="accent-slate-700"
                      />
                      {value === "si" ? "Si" : "No"}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {(!currentGuiaIIBlock.gate || getCurrentGateValue() === "si") &&
              currentGuiaIIBlock.questionNumbers.map((questionNumber) => {
                const question = guiaIIQuestionMap.get(questionNumber);
                if (!question) return null;

                return (
                  <fieldset
                    key={question.id}
                    className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <legend className="font-medium leading-6 text-slate-900">
                      {question.questionNumber}. {question.text}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {LIKERT_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                        >
                          <input
                            type="radio"
                            name={`guia-ii-${question.questionNumber}`}
                            checked={guiaIIAnswers[question.questionNumber] === option.value}
                            onChange={() => updateGuiaIIAnswer(question.questionNumber, option.value)}
                            className="accent-slate-700"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}

            {currentGuiaIIBlock.gate && getCurrentGateValue() === "no" ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Este bloque se marcara como no aplicable segun la compuerta seleccionada.
              </p>
            ) : null}

            {guiaIIError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {guiaIIError}
              </p>
            ) : null}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onPreviousGuiaIIBlock}
                disabled={guiaIIStep === 0}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              {guiaIIStep < GUIA_II_BLOCKS.length - 1 ? (
                <button
                  type="button"
                  onClick={onNextGuiaIIBlock}
                  className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onFinishGuiaII}
                  className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
                >
                  Finalizar evaluacion
                </button>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
