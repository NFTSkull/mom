import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/configuracion", label: "Configuracion" },
  { href: "/admin/trabajadores", label: "Trabajadores" },
  { href: "/admin/campanas", label: "Campanas" },
  { href: "/admin/politica", label: "Politica" },
  { href: "/admin/resultados", label: "Resultados" },
  { href: "/admin/plan-accion", label: "Plan de accion" },
  { href: "/admin/evidencias", label: "Evidencias" },
  { href: "/admin/quejas", label: "Quejas" },
  { href: "/admin/reportes", label: "Reportes" },
];

export function AdminNav() {
  return (
    <nav className="admin-nav border-b border-slate-200 bg-white shadow-sm">
      <ul className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-3 text-sm">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="rounded-md px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
