# Plan de pruebas

| Capa | Herramienta | Bloque |
|------|-------------|--------|
| Scoring / dominio | Vitest | B4.1+ |
| Permanencia campaña | Vitest | B4.16.2 (`b4162-campaign-permanence`) |
| Seguridad estática | Vitest | B4.2–B4.6 |
| Esquema / RLS / RPC / RBAC | pgTAP | B4.2–B4.6 (`008_*`) |
| Concurrencia submit | Vitest + Supabase local | B4.3 |
| Flujo trabajador | Playwright Chromium | B4.3 |
| Panel admin central | Playwright Chromium | B4.4 (`e2e/admin-core.spec.ts`) |
| Módulos secundarios + Storage | Playwright Chromium | B4.5 (`e2e/secondary-modules.spec.ts`) |
| Auth / RBAC / MFA | Playwright Chromium | B4.6 (`e2e/auth-rbac.spec.ts`) |
| Staging remoto | Playwright (config separada) | B4.7 (`e2e-staging/`, Preview HTTPS) |
| CI release | GitHub Actions | `release/**` |

Comandos: `npm test`, `npm run db:test`, `npm run test:e2e`, `npm run test:e2e:staging`, `npm run auth:seed:test`, `npm run auth:cleanup:test`.

Meta mínima: Vitest ≥189, pgTAP ≥517, Playwright local ≥42; staging E2E tras Preview.
