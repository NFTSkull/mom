"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GUIA_I_QUESTIONS, GUIA_I_SECTION_I_ID } from "@/data/nom035/guia-i";
import { NOM035_QUESTIONNAIRE_VERSION } from "@/data/nom035/guia-ii-manifest";
import { NOM035_I_III_QUESTIONNAIRE_VERSION } from "@/data/nom035/guia-iii-manifest";
import {
  clearSession,
  fetchSessionContext,
  saveDraft,
  startEvaluation,
  submitEvaluation,
} from "@/lib/nom035/client/public-evaluation-api";
import {
  buildFrpBlocks,
  buildFrpQuestionMap,
  clearGateAnswers,
  frpGateTexts,
  frpRadioNamePrefix,
  frpStageName,
  type FrpKind,
} from "@/lib/nom035/frp-ui-blocks";
import { resolveFrpInstrument } from "@/lib/nom035/resolve-questionnaire-version";
import { getSkippedQuestionNumbers, validateGuiaIIAnswers } from "@/lib/nom035/validate-guia-ii";
import {
  assertValidGuiaIIIAnswers,
  getGuiaIIISkippedQuestionNumbers,
} from "@/lib/nom035/validate-guia-iii";
import type { GuiaIIGateAnswer, GuiaIILikertAnswer } from "@/types/nom035";

const OPTIONS = [
  { value: 1, label: "Sí" },
  { value: 0, label: "No" },
] as const;

const LIKERT_OPTIONS: Array<{ value: GuiaIILikertAnswer; label: string }> = [
  { value: "siempre", label: "Siempre" },
  { value: "casi_siempre", label: "Casi siempre" },
  { value: "algunas_veces", label: "Algunas veces" },
  { value: "casi_nunca", label: "Casi nunca" },
  { value: "nunca", label: "Nunca" },
];

const LIKERT_LABEL: Record<GuiaIILikertAnswer, string> = {
  siempre: "Siempre",
  casi_siempre: "Casi siempre",
  algunas_veces: "Algunas veces",
  casi_nunca: "Casi nunca",
  nunca: "Nunca",
};

type FlowStage =
  | "loading"
  | "welcome"
  | "guia_i"
  | "guia_ii"
  | "guia_iii"
  | "review"
  | "session_error";
type SaveState = "idle" | "saving" | "saved" | "error";

function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sub_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function skippedFor(kind: FrpKind, gateClientes: GuiaIIGateAnswer, gateJefe: GuiaIIGateAnswer) {
  if (kind === "GUIA_III") {
    return getGuiaIIISkippedQuestionNumbers({ gateClientes, gateJefe });
  }
  return getSkippedQuestionNumbers({ gateClientes, gateJefe });
}

export default function EvaluacionContestarPage() {
  const router = useRouter();
  const [stage, setStage] = useState<FlowStage>("loading");
  const [sessionMessage, setSessionMessage] = useState("");
  const [workerName, setWorkerName] = useState<string | undefined>();
  const [questionnaireVersion, setQuestionnaireVersion] = useState(NOM035_QUESTIONNAIRE_VERSION);
  const [guiaIAnswers, setGuiaIAnswers] = useState<Record<string, number>>({});
  const [guiaIError, setGuiaIError] = useState("");
  const [frpAnswers, setFrpAnswers] = useState<Record<number, GuiaIILikertAnswer>>({});
  const [frpError, setFrpError] = useState("");
  const [frpStep, setFrpStep] = useState(0);
  const [gateClientes, setGateClientes] = useState<GuiaIIGateAnswer | undefined>();
  const [gateJefe, setGateJefe] = useState<GuiaIIGateAnswer | undefined>();
  const [showFullInstructions, setShowFullInstructions] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const draftUpdatedAtRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveSeqRef = useRef(0);
  const submissionIdRef = useRef(newSubmissionId());
  const errorFocusRef = useRef<HTMLParagraphElement | null>(null);

  const frpKind: FrpKind = resolveFrpInstrument(questionnaireVersion) ?? "GUIA_II";
  const frpBlocks = useMemo(() => buildFrpBlocks(frpKind), [frpKind]);
  const frpQuestionMap = useMemo(() => buildFrpQuestionMap(frpKind), [frpKind]);
  const gateTexts = useMemo(() => frpGateTexts(frpKind), [frpKind]);
  const radioPrefix = frpRadioNamePrefix(frpKind);
  const frpStage = frpStageName(frpKind);
  const frpLabel = frpKind === "GUIA_III" ? "Guía III" : "Guía II";

  const orderedQuestions = [...GUIA_I_QUESTIONS].sort((a, b) => a.order - b.order);
  const sectionIQuestions = orderedQuestions.filter((q) => q.section === "I");
  const remainingQuestions = orderedQuestions.filter((q) => q.section !== "I");
  const hasTraumaticEvent = guiaIAnswers[GUIA_I_SECTION_I_ID] === 1;
  const visibleQuestions = hasTraumaticEvent ? orderedQuestions : sectionIQuestions;
  const currentFrpBlock = frpBlocks[frpStep];
  const frpProgress = Math.round(((frpStep + 1) / frpBlocks.length) * 100);

  function restoreDraft(draft: Record<string, unknown> | null | undefined) {
    if (!draft || typeof draft !== "object") return;
    const stageDraft = typeof draft.stage === "string" ? draft.stage : undefined;
    const guiaI = draft.guiaI as { responses?: Record<string, number> } | undefined;
    if (guiaI?.responses) setGuiaIAnswers(guiaI.responses);

    const frpDraft =
      (draft.guiaIII as Record<string, unknown> | undefined) ??
      (draft.guiaII as Record<string, unknown> | undefined);
    if (frpDraft) {
      if (frpDraft.gateClientes === "si" || frpDraft.gateClientes === "no") {
        setGateClientes(frpDraft.gateClientes);
      }
      if (frpDraft.gateJefe === "si" || frpDraft.gateJefe === "no") {
        setGateJefe(frpDraft.gateJefe);
      }
      const responses = frpDraft.responses as Record<string, GuiaIILikertAnswer> | undefined;
      if (responses) {
        const mapped: Record<number, GuiaIILikertAnswer> = {};
        for (const [k, v] of Object.entries(responses)) mapped[Number(k)] = v;
        setFrpAnswers(mapped);
      }
      if (typeof frpDraft.step === "number") setFrpStep(frpDraft.step);
    }

    if (
      stageDraft === "guia_i" ||
      stageDraft === "guia_ii" ||
      stageDraft === "guia_iii" ||
      stageDraft === "review"
    ) {
      setStage(stageDraft);
    } else if (guiaI?.responses && Object.keys(guiaI.responses).length > 0) {
      setStage("guia_i");
    } else {
      setStage("welcome");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const session = await fetchSessionContext();
      if (cancelled) return;
      if (!session.ok) {
        setSessionMessage(session.message);
        setStage("session_error");
        return;
      }
      setWorkerName(session.data.context.workerName);
      const version =
        session.data.context.questionnaireVersion ?? NOM035_QUESTIONNAIRE_VERSION;
      setQuestionnaireVersion(version);
      restoreDraft(session.data.context.draft as Record<string, unknown> | null);
      if (!session.data.context.draft) setStage("welcome");
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (guiaIError || frpError || reviewError) {
      errorFocusRef.current?.focus();
    }
  }, [guiaIError, frpError, reviewError]);

  const buildDraftPayload = useCallback(
    (nextStage: FlowStage) => {
      const skipped = new Set(
        skippedFor(frpKind, gateClientes ?? "no", gateJefe ?? "no")
      );
      const responses: Record<number, GuiaIILikertAnswer> = {};
      for (const [k, v] of Object.entries(frpAnswers)) {
        const n = Number(k);
        if (skipped.has(n)) continue;
        responses[n] = v;
      }
      const frpPayload = {
        gateClientes: gateClientes ?? null,
        gateJefe: gateJefe ?? null,
        responses,
        step: frpStep,
      };
      return {
        stage: nextStage,
        questionnaireVersion,
        guiaI: { responses: guiaIAnswers },
        ...(frpKind === "GUIA_III"
          ? { guiaIII: frpPayload }
          : { guiaII: frpPayload }),
      };
    },
    [
      frpKind,
      gateClientes,
      gateJefe,
      guiaIAnswers,
      frpAnswers,
      frpStep,
      questionnaireVersion,
    ]
  );

  const persistDraft = useCallback(
    (nextStage: FlowStage) => {
      const seq = ++saveSeqRef.current;
      setSaveState("saving");
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          const result = await saveDraft(buildDraftPayload(nextStage), draftUpdatedAtRef.current);
          if (seq !== saveSeqRef.current) return;
          if (!result.ok) {
            if (
              result.code === "session_expired" ||
              result.code === "session_revoked" ||
              result.code === "no_session"
            ) {
              setSessionMessage(result.message);
              setStage("session_error");
            }
            setSaveState("error");
            return;
          }
          draftUpdatedAtRef.current = String(result.data.updatedAt);
          setSaveState("saved");
        })
        .catch(() => {
          if (seq === saveSeqRef.current) setSaveState("error");
        });
      return saveQueueRef.current;
    },
    [buildDraftPayload]
  );

  function onSelect(questionId: string, value: number): void {
    setGuiaIError("");
    setGuiaIAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function onStart(): Promise<void> {
    const started = await startEvaluation();
    if (!started.ok) {
      setSessionMessage(started.message);
      setStage("session_error");
      return;
    }
    setStage("guia_i");
    void persistDraft("guia_i");
  }

  function buildFrpPayload() {
    const skipped = new Set(skippedFor(frpKind, gateClientes ?? "no", gateJefe ?? "no"));
    const responses: Record<number, GuiaIILikertAnswer> = {};
    for (const [key, value] of Object.entries(frpAnswers)) {
      const n = Number(key);
      if (skipped.has(n)) continue;
      responses[n] = value;
    }
    return {
      gateClientes: (gateClientes ?? "no") as GuiaIIGateAnswer,
      gateJefe: (gateJefe ?? "no") as GuiaIIGateAnswer,
      responses,
    };
  }

  function validateFrpComplete(): string | null {
    const payload = buildFrpPayload();
    if (frpKind === "GUIA_III") {
      try {
        assertValidGuiaIIIAnswers(payload);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Hay respuestas incompletas o inválidas.";
      }
    }
    const validation = validateGuiaIIAnswers(payload);
    return validation.valid ? null : (validation.errors[0] ?? "Hay respuestas incompletas o inválidas.");
  }

  async function onSubmitGuiaI(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const hasMissing = visibleQuestions.some((q) => guiaIAnswers[q.id] === undefined);
    if (hasMissing) {
      setGuiaIError("Debes responder todas las preguntas visibles antes de continuar.");
      return;
    }
    if (gateClientes && gateJefe && !validateFrpComplete()) {
      setStage("review");
      await persistDraft("review");
      return;
    }
    setFrpStep(0);
    setStage(frpStage);
    await persistDraft(frpStage);
  }

  function updateFrpAnswer(questionNumber: number, value: GuiaIILikertAnswer): void {
    setFrpError("");
    setFrpAnswers((prev) => ({ ...prev, [questionNumber]: value }));
  }

  function getCurrentGateValue(): GuiaIIGateAnswer | undefined {
    if (!currentFrpBlock?.gate) return undefined;
    return currentFrpBlock.gate === "clientes" ? gateClientes : gateJefe;
  }

  function setCurrentGateValue(value: GuiaIIGateAnswer): void {
    setFrpError("");
    if (currentFrpBlock?.gate === "clientes") {
      setGateClientes(value);
      setFrpAnswers((prev) =>
        clearGateAnswers(prev, frpKind, "clientes", value) as Record<number, GuiaIILikertAnswer>
      );
    }
    if (currentFrpBlock?.gate === "jefe") {
      setGateJefe(value);
      setFrpAnswers((prev) =>
        clearGateAnswers(prev, frpKind, "jefe", value) as Record<number, GuiaIILikertAnswer>
      );
    }
  }

  function validateCurrentFrpBlock(): boolean {
    if (!currentFrpBlock) return false;
    const gateValue = getCurrentGateValue();
    if (currentFrpBlock.gate && !gateValue) {
      setFrpError("Debes responder la pregunta de compuerta para continuar.");
      return false;
    }
    if (currentFrpBlock.gate && gateValue === "no") return true;
    const missing = currentFrpBlock.questionNumbers.some((n) => frpAnswers[n] === undefined);
    if (missing) {
      setFrpError("Debes responder todas las preguntas visibles del bloque actual.");
      return false;
    }
    return true;
  }

  function onPreviousFrpBlock(): void {
    setFrpError("");
    setFrpStep((prev) => Math.max(0, prev - 1));
  }

  async function onNextFrpBlock(): Promise<void> {
    if (!validateCurrentFrpBlock()) return;
    setFrpStep((prev) => Math.min(frpBlocks.length - 1, prev + 1));
    await persistDraft(frpStage);
  }

  async function onFinishFrp(): Promise<void> {
    if (!validateCurrentFrpBlock()) return;
    const err = validateFrpComplete();
    if (err) {
      setFrpError(err);
      return;
    }
    setReviewConfirmed(false);
    setReviewError("");
    setStage("review");
    await persistDraft("review");
  }

  async function onConfirmFinalSubmit(): Promise<void> {
    if (isSubmitting) return;
    if (!reviewConfirmed) {
      setReviewError("Debes confirmar que revisaste tus respuestas antes de enviar.");
      return;
    }
    if (!navigator.onLine) {
      setReviewError("Sin conexión. No se puede enviar hasta recuperar la red.");
      return;
    }
    setIsSubmitting(true);
    setReviewError("");
    try {
      await saveQueueRef.current;
      const frpPayload = buildFrpPayload();
      const result = await submitEvaluation({
        submissionId: submissionIdRef.current,
        guiaI: {
          responses: Object.fromEntries(
            visibleQuestions.map((q) => [q.id, guiaIAnswers[q.id] ?? 0])
          ),
        },
        ...(frpKind === "GUIA_III"
          ? {
              guiaIII: {
                gateClientes: frpPayload.gateClientes,
                gateJefe: frpPayload.gateJefe,
                responses: frpPayload.responses,
              },
            }
          : {
              guiaII: {
                gateClientes: frpPayload.gateClientes,
                gateJefe: frpPayload.gateJefe,
                responses: frpPayload.responses,
              },
            }),
      });
      if (!result.ok) {
        setIsSubmitting(false);
        if (
          result.code === "session_expired" ||
          result.code === "session_revoked" ||
          result.code === "no_session"
        ) {
          setSessionMessage(result.message);
          setStage("session_error");
          return;
        }
        setReviewError(result.message);
        return;
      }
      setGuiaIAnswers({});
      setFrpAnswers({});
      setGateClientes(undefined);
      setGateJefe(undefined);
      await clearSession();
      router.replace("/evaluacion/gracias");
    } catch {
      setIsSubmitting(false);
      setReviewError("No se pudo enviar la evaluación. Intenta de nuevo.");
    }
  }

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <main className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6">
          <p role="status">Cargando evaluación…</p>
        </main>
      </div>
    );
  }

  if (stage === "session_error") {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <main className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">Sesión no disponible</h1>
          <p className="mt-3 text-sm text-slate-700">
            {sessionMessage || "Abre nuevamente el enlace que te compartió tu organización."}
          </p>
        </main>
      </div>
    );
  }

  const isFrpStage = stage === "guia_ii" || stage === "guia_iii";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <main className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <header className="space-y-2 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Evaluación NOM-035</h1>
          <p className="text-sm text-slate-700">
            Estás por responder una evaluación confidencial sobre factores psicosociales en el trabajo.
          </p>
          {workerName ? (
            <p className="text-sm text-slate-600">Participante: {workerName}</p>
          ) : null}
          <p className="text-sm text-slate-700">No hay respuestas correctas o incorrectas.</p>
          <p className="text-sm text-slate-700">Tus respuestas serán tratadas con confidencialidad.</p>
          <p className="text-xs text-slate-500" aria-live="polite">
            {saveState === "saving"
              ? "Guardando…"
              : saveState === "saved"
                ? "Progreso guardado"
                : saveState === "error"
                  ? "No se pudo guardar (puedes continuar; el envío final sí requiere conexión)"
                  : null}
          </p>
        </header>

        {stage === "welcome" ? (
          <section className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              Objetivo: identificar factores de riesgo psicosocial y, en su caso, acontecimientos
              traumáticos severos, para mejorar el ambiente de trabajo. Tus respuestas son
              confidenciales y no hay respuestas correctas o incorrectas.
            </p>
            <p className="text-sm text-slate-700">
              Contesta el cuestionario completo, con sinceridad y considerando las condiciones de
              los dos últimos meses. Tiempo estimado: 15 a 25 minutos.
            </p>
            <p className="text-sm text-slate-600">
              Instrumentos de esta evaluación: Guía I y {frpLabel}.
            </p>
            <button
              type="button"
              onClick={() => setShowFullInstructions((prev) => !prev)}
              className="text-sm font-medium text-slate-900 underline"
            >
              {showFullInstructions ? "Ocultar indicaciones completas" : "Leer indicaciones completas"}
            </button>
            {showFullInstructions ? (
              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <p>
                  La información se usa exclusivamente para mejorar el ambiente de trabajo. Puedes
                  solicitar aclaración al responsable aplicador si tienes dudas.
                </p>
                <p>
                  Debes concentrarte al responder, completar todas las preguntas aplicables y evitar
                  dejar reactivos en blanco.
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void onStart()}
              className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
            >
              Iniciar evaluación
            </button>
          </section>
        ) : null}

        {stage === "guia_i" ? (
          <form className="mt-5 space-y-4" onSubmit={(e) => void onSubmitGuiaI(e)}>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Guía I (Paso 1 de 2) · luego {frpLabel}
            </div>
            {visibleQuestions.map((question, index) => {
              const previousSection = index > 0 ? visibleQuestions[index - 1]?.section : null;
              const showSectionHeader = question.section !== previousSection;
              return (
                <div key={question.id} className="space-y-3">
                  {showSectionHeader ? (
                    <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Sección {question.section}: {question.sectionTitle}
                      </p>
                    </div>
                  ) : null}
                  <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                    <legend className="font-medium leading-6 text-slate-900">{question.text}</legend>
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
                </div>
              );
            })}
            {guiaIAnswers[GUIA_I_SECTION_I_ID] === 1 && remainingQuestions.length > 0 ? (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Detectamos respuesta afirmativa en la sección I. Debes contestar las secciones II, III y IV.
              </p>
            ) : null}
            {guiaIAnswers[GUIA_I_SECTION_I_ID] === 0 ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Respondiste NO en sección I. Puedes continuar con el siguiente paso.
              </p>
            ) : null}
            {guiaIError ? (
              <p
                ref={errorFocusRef}
                tabIndex={-1}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {guiaIError}
              </p>
            ) : null}
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
            >
              Continuar a {frpLabel}
            </button>
          </form>
        ) : null}

        {isFrpStage && currentFrpBlock ? (
          <section className="mt-5 space-y-4" data-testid={`frp-stage-${frpKind}`}>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {frpLabel} - Paso {frpStep + 1} de {frpBlocks.length}
              </p>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-slate-700" style={{ width: `${frpProgress}%` }} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">{currentFrpBlock.title}</h2>
              <p className="mt-1 text-sm text-slate-700">{currentFrpBlock.description}</p>
            </div>
            {currentFrpBlock.gate ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">
                  {currentFrpBlock.gate === "clientes" ? gateTexts.clientes : gateTexts.jefe}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(["si", "no"] as const).map((value) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                    >
                      <input
                        type="radio"
                        name={`gate-${currentFrpBlock.gate}`}
                        checked={getCurrentGateValue() === value}
                        onChange={() => setCurrentGateValue(value)}
                        className="accent-slate-700"
                      />
                      {value === "si" ? "Sí" : "No"}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {(!currentFrpBlock.gate || getCurrentGateValue() === "si") &&
              currentFrpBlock.questionNumbers.map((questionNumber) => {
                const question = frpQuestionMap.get(questionNumber);
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
                            name={`${radioPrefix}${question.questionNumber}`}
                            checked={frpAnswers[question.questionNumber] === option.value}
                            onChange={() => updateFrpAnswer(question.questionNumber, option.value)}
                            className="accent-slate-700"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            {currentFrpBlock.gate && getCurrentGateValue() === "no" ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Este bloque se marcará como no aplicable según la compuerta seleccionada.
              </p>
            ) : null}
            {frpError ? (
              <p
                ref={errorFocusRef}
                tabIndex={-1}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {frpError}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onPreviousFrpBlock}
                disabled={frpStep === 0}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              {frpStep < frpBlocks.length - 1 ? (
                <button
                  type="button"
                  onClick={() => void onNextFrpBlock()}
                  className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onFinishFrp()}
                  className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
                >
                  Finalizar bloque y revisar
                </button>
              )}
            </div>
          </section>
        ) : null}

        {stage === "review" ? (
          <section className="mt-5 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">Revisar respuestas</h2>
              <p className="mt-1 text-sm text-slate-700">
                Verifica cada respuesta. No se muestran puntajes, niveles de riesgo ni interpretaciones.
              </p>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">Guía I</h3>
              {visibleQuestions.map((question) => (
                <div key={question.id} className="border-t border-slate-100 pt-2 text-sm">
                  <p className="text-slate-800">{question.text}</p>
                  <p className="mt-1 font-medium text-slate-900">
                    Respuesta: {guiaIAnswers[question.id] === 1 ? "Sí" : "No"}
                  </p>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setStage("guia_i")}
                className="mt-2 text-sm font-medium text-slate-900 underline"
              >
                Editar Guía I
              </button>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">{frpLabel}</h3>
              <p className="text-sm text-slate-700">
                {gateTexts.clientes} {gateClientes === "si" ? "Sí" : "No"}
              </p>
              <p className="text-sm text-slate-700">
                {gateTexts.jefe} {gateJefe === "si" ? "Sí" : "No"}
              </p>
              {[...frpQuestionMap.values()].map((question) => {
                const skipped = skippedFor(
                  frpKind,
                  gateClientes ?? "no",
                  gateJefe ?? "no"
                ).includes(question.questionNumber);
                const answer = frpAnswers[question.questionNumber];
                return (
                  <div key={question.id} className="border-t border-slate-100 pt-2 text-sm">
                    <p className="text-slate-800">
                      {question.questionNumber}. {question.text}
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {skipped
                        ? "No aplicable"
                        : `Respuesta: ${answer ? LIKERT_LABEL[answer] : "Sin respuesta"}`}
                    </p>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setFrpStep(0);
                  setStage(frpStage);
                }}
                className="mt-2 text-sm font-medium text-slate-900 underline"
              >
                Editar {frpLabel}
              </button>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(event) => {
                  setReviewConfirmed(event.target.checked);
                  setReviewError("");
                }}
                className="mt-1 accent-slate-700"
              />
              Confirmo que revisé mis respuestas. Después de enviar ya no podré modificarlas.
            </label>
            {reviewError ? (
              <p
                ref={errorFocusRef}
                tabIndex={-1}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {reviewError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void onConfirmFinalSubmit()}
              className="rounded-md bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Enviando…" : "Enviar evaluación definitivamente"}
            </button>
          </section>
        ) : null}
      </main>
      <span className="sr-only" data-questionnaire-version={questionnaireVersion}>
        {questionnaireVersion === NOM035_I_III_QUESTIONNAIRE_VERSION
          ? "instrumento-i-iii"
          : "instrumento-i-ii"}
      </span>
    </div>
  );
}
