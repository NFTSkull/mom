/**
 * Guardas anti-Cloud / anti-ConCasa para scripts masivos B4.11.
 * Por defecto solo localhost. Nunca imprimir secrets.
 */

const FORBIDDEN =
  /supabase\.co|agbl|fvtq|concasa|charolais|nom035-production|vercel\.app|production/i;

export function assertLocalSupabaseOnly(url: string, label = "URL"): void {
  if (!url || typeof url !== "string") {
    throw new Error(`ABORT: ${label} vacía`);
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url)) {
    throw new Error(`ABORT: ${label} no es localhost`);
  }
  if (FORBIDDEN.test(url)) {
    throw new Error(`ABORT: ${label} apunta a host/proyecto prohibido`);
  }
  if (process.env.ALLOW_CLOUD_B411 === "1") {
    throw new Error("ABORT: ALLOW_CLOUD_B411 no está soportado; B411 solo local");
  }
}

export function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    if (existsSync(".env.local")) {
      for (const line of readFileSync(".env.local", "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) out[m[1]!] = m[2]!.trim();
      }
    }
  } catch {
    // ignore
  }
  return { ...out, ...(process.env as Record<string, string>) };
}
