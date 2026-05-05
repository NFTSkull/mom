"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/trabajadores", label: "Trabajadores" },
  { href: "/admin/campanas", label: "Campañas" },
  { href: "/admin/politica", label: "Política" },
  { href: "/admin/resultados", label: "Resultados" },
  { href: "/admin/plan-accion", label: "Plan de acción" },
  { href: "/admin/evidencias", label: "Evidencias" },
  { href: "/admin/quejas", label: "Quejas" },
  { href: "/admin/reportes", label: "Reportes" },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="admin-nav border-b border-slate-200 bg-white shadow-sm">
      <ul className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-3 text-sm">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`rounded-md px-3 py-2 font-medium transition ${
                isActive(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
