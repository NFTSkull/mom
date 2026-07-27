# Modelo de seguridad del CI (Release Candidate)

## Alcance

Workflow: `.github/workflows/release-candidate.yml`

Se ejecuta en ramas `release/**` y PRs hacia esas ramas.

## Jobs

| Job | Qué hace | Qué no hace |
|---|---|---|
| quality | npm ci, audit, lint, typecheck, vitest, build, SHA fuente, scoringVersion, secret scan | No despliega |
| database | Supabase local, reset, pgTAP, diff de tipos | No `db push` remoto |
| e2e | Playwright Chromium local + seed/cleanup | No apunta a Cloud |
| security | audit + secret scan | No imprime valores |

## Permisos

- `contents: read` únicamente.
- Sin secrets de producción.
- Sin `db push` a Cloud desde CI.
- Sin deploy Vercel Production.
- Artifacts (traces) solo en fallo, retención 7 días.

## Fallos obligatorios

- vulnerabilidades audit (high+);
- cambio de SHA de fuente oficial;
- cambio de `scoringVersion`;
- diff en tipos generados;
- pgTAP / Playwright / lint / typecheck / build;
- hallazgos del escáner de secretos;
- presencia de `.env` / `.env.local` versionados.
