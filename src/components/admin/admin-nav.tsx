"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AppPermission, AdminRole } from "@/lib/nom035/auth/permissions";

type NavItem = {
  href: string;
  label: string;
  permission?: AppPermission;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Inicio", permission: "dashboard.view" },
  { href: "/admin/configuracion", label: "Configuración", permission: "company.read" },
  { href: "/admin/trabajadores", label: "Trabajadores", permission: "workers.read" },
  { href: "/admin/campanas", label: "Campañas", permission: "campaigns.read" },
  { href: "/admin/politica", label: "Política", permission: "policies.read" },
  { href: "/admin/resultados", label: "Resultados", permission: "results.aggregate.read" },
  { href: "/admin/plan-accion", label: "Plan de acción", permission: "action_plans.read" },
  { href: "/admin/evidencias", label: "Evidencias", permission: "evidence.read" },
  { href: "/admin/quejas", label: "Quejas", permission: "complaints.list" },
  { href: "/admin/reportes", label: "Reportes", permission: "reports.generate" },
  { href: "/admin/usuarios", label: "Usuarios", permission: "users.read" },
  { href: "/admin/auditoria", label: "Auditoría", permission: "audit.read" },
  { href: "/admin/seguridad/mfa", label: "Seguridad" },
];

export function AdminNav({
  nombre,
  role,
  permissions,
}: {
  nombre: string;
  role: AdminRole;
  permissions: AppPermission[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = new Set(permissions);

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const visible = NAV_ITEMS.filter(
    (item) => !item.permission || allowed.has(item.permission)
  );

  return (
    <nav className="admin-nav border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <ul className="flex flex-wrap gap-2 text-sm">
          {visible.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
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
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <span>
            {nombre} · {role}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </nav>
  );
}
