import type { NextConfig } from "next";

/**
 * Cabeceras de privacidad para el flujo público de evaluación.
 * CSP compatible con Next (sin romper estilos/scripts propios).
 * Verificado en smoke/E2E: no rompe /evaluacion/* ni /api/public/evaluations/*.
 */
const PRIVACY_HEADERS = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Preview/staging: cliente público puede hablar con Supabase Auth/REST.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

/** Cabeceras globales (framing + CSP). Residuales unsafe-inline/eval documentados en cert. */
const APP_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/nom035/reports/full": ["./src/lib/nom035/fonts/**/*"],
    "/api/admin/nom035/results/[id]/report": ["./src/lib/nom035/fonts/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: APP_SECURITY_HEADERS },
      { source: "/evaluacion/:path*", headers: PRIVACY_HEADERS },
      { source: "/api/public/evaluations/:path*", headers: PRIVACY_HEADERS },
      { source: "/queja-confidencial", headers: PRIVACY_HEADERS },
      { source: "/api/public/complaints", headers: PRIVACY_HEADERS },
      { source: "/api/admin/:path*", headers: PRIVACY_HEADERS },
      { source: "/login", headers: PRIVACY_HEADERS },
      { source: "/admin/:path*", headers: PRIVACY_HEADERS },
    ];
  },
};

export default nextConfig;
