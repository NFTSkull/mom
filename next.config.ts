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
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/evaluacion/:path*", headers: PRIVACY_HEADERS },
      { source: "/api/public/evaluations/:path*", headers: PRIVACY_HEADERS },
    ];
  },
};

export default nextConfig;
