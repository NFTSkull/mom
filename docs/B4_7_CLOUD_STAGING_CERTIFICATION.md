# B4.7 — Certificación Cloud Staging

## Veredicto

**NO CERTIFICADO** (en progreso — bloqueadores abiertos hasta completar Cloud/Preview/E2E remoto).

## Completado local/Git

- Línea base local previa: audit 0, Vitest 189, pgTAP 517, Playwright 42.
- Artefactos RC: CI, health, Playwright staging, scripts seed/cleanup staging, docs.
- Proyecto remoto identificado por nombre exacto: `nom035-staging`.

## Bloqueadores

1. Verificar vacío del proyecto (ref históricamente asociado a otro nombre).
2. Link + dry-run + `db push` controlado.
3. Auth/Storage/Preview Vercel + E2E remoto.
4. Backup/restore y rollback frontend.

## Confirmaciones

- No se enlazó `ConCasa CRM`.
- No se usó Vercel Production.
- No merge a `main`.
- Sin usuarios/datos reales.
