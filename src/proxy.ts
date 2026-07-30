import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy Next.js 16: refresca sesión y hace redirecciones preliminares.
 * NO es la única barrera: cada página/endpoint revalida en servidor.
 */
export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const { pathname } = request.nextUrl;

  response.headers.set("x-pathname", pathname);

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");
  const isAuthApi = pathname.startsWith("/api/auth/");
  const isAdminApi = pathname.startsWith("/api/admin/");
  const isTrabajadorApi = pathname.startsWith("/api/trabajador/");
  const isTrabajador =
    pathname === "/trabajador" || pathname.startsWith("/trabajador/");
  const isTrabajadorLogin =
    pathname === "/trabajador/login" || pathname.startsWith("/trabajador/login/");

  const hasIdentity = Boolean(
    claims && typeof (claims as { sub?: string }).sub === "string"
  );
  const appMeta = (claims as { app_metadata?: { role?: string } } | null)?.app_metadata;
  const isWorker = appMeta?.role === "worker";

  if (isAdminApi || isAuthApi || isTrabajadorApi) {
    return response;
  }

  if (isAdmin && isWorker) {
    const url = request.nextUrl.clone();
    url.pathname = "/trabajador";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAdmin && !hasIdentity) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && hasIdentity && !isWorker) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isTrabajador && !isTrabajadorLogin && !hasIdentity) {
    const url = request.nextUrl.clone();
    url.pathname = "/trabajador/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isTrabajadorLogin && hasIdentity && isWorker) {
    const url = request.nextUrl.clone();
    url.pathname = "/trabajador";
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
