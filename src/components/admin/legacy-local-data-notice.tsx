"use client";

import { useEffect, useState } from "react";

const NOTICE_KEY = "nom035_legacy_notice_shown_v1";

/**
 * Aviso único si hay datos demo en localStorage.
 * No importa ni mezcla esos datos con Supabase.
 */
export function LegacyLocalDataNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(NOTICE_KEY) === "1") return;
        const hasLegacy =
          Boolean(window.localStorage.getItem("nom035_local_data")) ||
          Boolean(window.localStorage.getItem("nom035_workers")) ||
          Boolean(window.localStorage.getItem("nom035_campaigns"));
        if (!hasLegacy) return;
        setVisible(true);
        window.sessionStorage.setItem(NOTICE_KEY, "1");
      } catch {
        // Storage bloqueado: no mostrar.
      }
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="legacy-local-data-notice"
      className="mb-4 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800"
    >
      Existen datos de demostración almacenados en este navegador. No se mezclan
      con los datos centrales de Supabase.
    </div>
  );
}
