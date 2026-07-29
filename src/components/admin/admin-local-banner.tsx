import { isVercelProduction } from "@/lib/env";

/**
 * Aviso del entorno administrativo no productivo (local/preview).
 * En Production (VERCEL_ENV=production) no se renderiza.
 * No se puede ocultar con CSS cuando está activo: sin ocultamiento visual, sin dismiss.
 */
export function AdminLocalBanner() {
  if (isVercelProduction()) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="admin-local-banner"
      className="sticky top-0 z-40 border-b-2 border-amber-700 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm"
      style={{ display: "block", visibility: "visible", opacity: 1 }}
    >
      <p className="mx-auto max-w-6xl leading-relaxed">
        Entorno administrativo local o de preview conectado a Supabase. No es
        producción: no cargar trabajadores reales ni datos personales aquí.
      </p>
    </aside>
  );
}
