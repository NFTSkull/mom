import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLocalBanner } from "@/components/admin/admin-local-banner";
import { LegacyLocalDataNotice } from "@/components/admin/legacy-local-data-notice";
import { requireAdminAuth } from "@/lib/nom035/server/require-admin-auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isMfa =
    pathname === "/admin/seguridad/mfa" || pathname.startsWith("/admin/seguridad/mfa/");

  const auth = await requireAdminAuth();
  if (!auth.ok) {
    if (auth.code === "account_disabled") redirect("/cuenta-deshabilitada");
    if (auth.code === "profile_missing") redirect("/no-autorizado");
    redirect("/login");
  }

  const { ctx } = auth;
  if (ctx.mfaRequired && ctx.aal !== "aal2" && !isMfa) {
    redirect("/admin/seguridad/mfa?mode=verify");
  }

  const showChrome = !ctx.mfaRequired || ctx.aal === "aal2";

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminLocalBanner />
      {showChrome ? (
        <AdminNav nombre={ctx.nombre} role={ctx.role} permissions={ctx.permissions} />
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-6 text-slate-800">
        {showChrome ? <LegacyLocalDataNotice /> : null}
        {children}
      </main>
    </div>
  );
}
