# Modelo de seguridad del CI (Release Candidate)

## Alcance

Workflow: `.github/workflows/release-candidate.yml`

Se ejecuta en ramas `release/**` y PRs hacia esas ramas.

## Jobs

| Job | Qué hace | Qué no hace |
|---|---|---|
| quality | npm ci, audit, lint, typecheck, vitest (sin stack DB), build, SHA fuente, scoringVersion, secret scan | No despliega; no crea `.env.local` |
| database | Supabase local, `ci-write-local-env`, reset, Vitest concurrencia B4.3, pgTAP, diff de tipos | No `db push` remoto |
| e2e | `ci-write-local-env`, Playwright Chromium local + seed/cleanup | No apunta a Cloud |
| security | audit + secret scan; falla si `.env`/`.env.local` están versionados | No imprime valores |

Notas:

- `b4-3-concurrency` usa `describe.skipIf` sin Supabase local; en CI corre en el job `database`.
- `.env.local` de CI se genera en runtime y no se versiona.

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
