/**
 * Aviso permanente del entorno administrativo local (B4.4).
 * No se puede ocultar: sin clase de ocultamiento, sin dismiss, role=status.
 */
export function AdminLocalBanner() {
  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="admin-local-banner"
      className="sticky top-0 z-40 border-b-2 border-amber-700 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950 shadow-sm"
      style={{ display: "block", visibility: "visible", opacity: 1 }}
    >
      <p className="mx-auto max-w-6xl leading-relaxed">
        Entorno administrativo local conectado a Supabase. El acceso permanecerá
        deshabilitado en producción hasta implementar autenticación y roles.
      </p>
    </aside>
  );
}
