import { NextResponse, type NextRequest } from "next/server";
import {
  updateSession,
} from "@/lib/supabase/proxy";

/**
 * Proxy Next.js 16: refresca sesión y hace redirecciones preliminares.
 * NO es la única barrera: cada página/endpoint revalida en servidor.
 */
export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Propagar pathname a Server Components (layout) sin consultar matriz.
  response.headers.set("x-pathname", pathname);

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");
  const isAuthApi = pathname.startsWith("/api/auth/");
  const isAdminApi = pathname.startsWith("/api/admin/");

  const hasIdentity = Boolean(claims && typeof (claims as { sub?: string }).sub === "string");

  // APIs admin: no redirigir HTML; el handler responde 401/403.
  if (isAdminApi || isAuthApi) {
    return response;
  }

  // Barrera preliminar: identidad requerida en /admin.
  // AAL2/MFA se exigen en layout + Route Handlers (no solo aquí).
  if (isAdmin && !hasIdentity) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && hasIdentity) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
