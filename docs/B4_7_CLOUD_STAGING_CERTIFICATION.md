# B4.7 — Certificación Cloud Staging

## Veredicto

**NO CERTIFICADO**

Motivo principal: `SUPABASE_DB_PASSWORD_ABSENT` — no se ejecutó dump/restore real. Además WebKit no corre en macOS 14 arm64 (Playwright frozen / `PushAPIEnabled`); requiere runner compatible.

## Completado

- Push `c6ec8a5` → remoto; CI run `30465305919` quality/security/database/e2e **success**
- Preview `mom-r9v4rv87l` alias RC; CSP observada (`frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, nosniff); residuales `unsafe-inline`/`unsafe-eval`
- Health live/ready 200; admin 307→login; API admin 401
- Seed+cleanup auth/fixtures staging OK
- E2E staging **42/42** (Chromium desktop+móvil + Firefox smoke); WebKit omitido en darwin con justificación técnica
- Rollback Preview A↔B con ready 200 verificado
- Regresión local: Vitest 189, pgTAP 517, Playwright 42, audit 0

## Pendiente / P0

1. Password DB staging → dump lógico + restore verificado + manifest Storage
2. WebKit en runner compatible (Linux CI o macOS no frozen)
3. Ampliar cobertura staging a los 64 casos del checklist si se exige 1:1 (hoy suite condensada pero verde)

## Confirmaciones

- `main` intacto `b037cad…`
- Tag no empujado
- ConCasa / otros proyectos no tocados
- Sin Vercel `--prod` / sin dominio final / sin datos reales
- `GH_TOKEN` eliminado tras push; listo para revocación definitiva por el usuario
