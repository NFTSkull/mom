import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildIndividualReportXlsxBuffer } from "@/lib/nom035/individual-report-xlsx";
import {
  mapResultDetail,
  splitAnswersByGuide,
} from "@/lib/nom035/server/admin-result-mapper";
import {
  individualReportFilename,
  type ReportWorkerRow,
} from "@/lib/nom035/report-data";
import { renderIndividualCharts } from "@/lib/nom035/report-charts";
import { getCompanySettings } from "@/lib/nom035/server/admin-core-service";
import { riskChartHex } from "@/lib/nom035/risk-palette";

export type IndividualReportExportOk = {
  ok: true;
  buffer: Buffer;
  filename: string;
  generationMs: number;
};

export type IndividualReportExportErr = {
  ok: false;
  code: string;
  message: string;
};

function mapDetailToWorker(
  detail: NonNullable<ReturnType<typeof mapResultDetail>>
): ReportWorkerRow | null {
  const username = detail.username?.trim();
  if (!username) return null;

  const allAnswers = [...detail.guiaIAnswers, ...detail.guiaIIIAnswers];
  const { guiaI, guiaIII } = splitAnswersByGuide(allAnswers);
  const answers = [...guiaI, ...guiaIII].map((a) => ({
    questionnaireCode: a.questionnaireCode,
    questionId: a.questionId,
    answerText: a.answerText,
    answerValue: a.answerValue as string | number | null,
  }));

  const categoryScores: ReportWorkerRow["categoryScores"] = {};
  if (detail.categoryScores && typeof detail.categoryScores === "object") {
    for (const [key, val] of Object.entries(
      detail.categoryScores as Record<string, { score: number; riskLevel: string }>
    )) {
      categoryScores[key] = {
        score: Number(val.score),
        riskLevel: val.riskLevel as ReportWorkerRow["categoryScores"][string]["riskLevel"],
      };
    }
  }

  const domainScores: ReportWorkerRow["domainScores"] = {};
  if (detail.domainScores && typeof detail.domainScores === "object") {
    for (const [key, val] of Object.entries(
      detail.domainScores as Record<string, { score: number; riskLevel: string }>
    )) {
      domainScores[key] = {
        score: Number(val.score),
        riskLevel: val.riskLevel as ReportWorkerRow["domainScores"][string]["riskLevel"],
      };
    }
  }

  return {
    resultId: detail.id,
    username,
    nombre: detail.worker.nombre,
    puesto: detail.worker.puesto,
    departamento: detail.worker.departamento,
    status: detail.status,
    startedAt: detail.startedAt,
    completedAt: detail.completedAt,
    guiaIStatus: guiaI.length > 0 ? "submitted" : null,
    guiaIIIStatus: guiaIII.length > 0 ? "submitted" : null,
    finalScore: detail.finalScore,
    finalRiskLevel: detail.finalRiskLevel,
    categoryScores,
    domainScores,
    guiaIRequiresClinicalAttention: detail.guiaIRequiresClinicalAttention,
    guiaIRiskLabel: detail.guiaIRiskLabel,
    scoringVersion: detail.scoringVersion,
    questionnaireVersion: detail.questionnaireVersion,
    answers,
  };
}

export async function exportNom035IndividualReportExcel(
  resultId: string
): Promise<IndividualReportExportOk | IndividualReportExportErr> {
  const started = Date.now();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("admin_get_result_detail", {
    p_result_id: resultId,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("forbidden") || msg.includes("unauthorized")) {
      return { ok: false, code: "forbidden", message: "Sin permiso." };
    }
    return { ok: false, code: "internal_error", message: "No se pudo exportar." };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, code: "internal_error", message: "Respuesta inválida." };
  }
  const record = data as Record<string, unknown>;
  if (record.ok === false) {
    const code = typeof record.code === "string" ? record.code : "internal_error";
    if (code === "not_found") {
      return { ok: false, code: "not_found", message: "Resultado no encontrado." };
    }
    if (code === "test_worker_excluded") {
      return { ok: false, code: "forbidden", message: "Trabajador de prueba excluido." };
    }
    return { ok: false, code, message: "No se pudo exportar." };
  }

  const detail = mapResultDetail(record);
  if (!detail) {
    return { ok: false, code: "internal_error", message: "Detalle inválido." };
  }
  if (detail.status !== "completed") {
    return {
      ok: false,
      code: "invalid_payload",
      message: "Solo trabajadores con evaluación completada.",
    };
  }

  const worker = mapDetailToWorker(detail);
  if (!worker) {
    return { ok: false, code: "internal_error", message: "Usuario no disponible." };
  }

  const catEntries = Object.entries(worker.categoryScores);
  const domEntries = Object.entries(worker.domainScores);
  const charts = await renderIndividualCharts({
    categories: {
      labels: catEntries.map(([k]) => k),
      values: catEntries.map(([, v]) => v.score),
    },
    domains: {
      labels: domEntries.map(([k]) => k),
      values: domEntries.map(([, v]) => v.score),
    },
    categoryColors: catEntries.map(([, v]) => riskChartHex(v.riskLevel)),
    domainColors: domEntries.map(([, v]) => riskChartHex(v.riskLevel)),
  });

  let companyName = "—";
  try {
    const company = await getCompanySettings();
    if (company && typeof company === "object") {
      const rs =
        (company as { razonSocial?: string }).razonSocial ??
        (company as { razon_social?: string }).razon_social;
      if (rs) companyName = String(rs);
    }
  } catch {
    companyName = "—";
  }

  const buffer = await buildIndividualReportXlsxBuffer({
    worker,
    campaignName: detail.campaign.nombre,
    campaignStatus: detail.campaign.status,
    companyName,
    generatedAt: new Date().toISOString(),
    charts,
  });

  return {
    ok: true,
    buffer,
    filename: individualReportFilename(worker.username),
    generationMs: Date.now() - started,
  };
}
