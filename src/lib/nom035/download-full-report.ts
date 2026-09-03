/** Descarga cliente del XLSX consolidado NOM-035 (mismo endpoint B4.24/B4.26). */

export const FULL_REPORT_DOWNLOAD_NAME = "reporte-completo-nom035-2026.xlsx";

export async function downloadFullReportExcelFromBrowser(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const res = await fetch("/api/admin/nom035/reports/full", {
      credentials: "same-origin",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      return {
        ok: false,
        message: json?.message ?? "No se pudo descargar el reporte completo.",
      };
    }
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? FULL_REPORT_DOWNLOAD_NAME;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, message: "No se pudo descargar el reporte completo." };
  }
}
