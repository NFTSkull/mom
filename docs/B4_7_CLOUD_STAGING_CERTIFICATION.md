# B4.7 — Certificación Cloud Staging

## Veredicto

**NO CERTIFICADO**

Motivo principal: E2E remoto completo (evaluación pública, Auth/MFA, roles, módulos, WebKit) no está implementado/aprobado; solo smoke. Backup lógico post-NOM-035 no restaurado (sin password DB en sesión; PITR/backups físicos vacíos en plan).

## Completado

- Push `release/nom035-staging-rc1` → remoto `471592f`
- CI verde run `30429324801` (quality/security/database/e2e)
- Supabase `nom035-staging` / `agbl…kubf` con migraciones 001–005
- Vercel proyecto `mom` (repo NFTSkull/mom); variables **solo Preview** rama RC
- SSO Preview desactivado (antes bloqueaba E2E)
- Auth Site URL + allow list → Preview alias
- Health live/ready 200; admin→login; API admin 401
- Seed sintético `@nom035.staging.local` + cleanup
- Playwright staging smoke 6/6
- Rollback frontend: deployment anterior alcanzable; alias RC sigue healthy

## Pendiente / bloqueadores P0

1. Suite `e2e-staging` completa (público, Auth/MFA, roles, módulos, WebKit/Firefox)
2. Backup lógico + restore verificado (password DB staging / PITR no disponible)
3. Seed de datos ficticios de negocio (campaña/evaluaciones) + cleanup Storage
4. Headers CSP completos (HSTS sí; CSP no observado en HTML)

## Confirmaciones

- `main` intacto `b037cad…`
- Tag `nom035-local-certified-rc1` no empujado
- ConCasa CRM / otros proyectos no modificados
- Sin Vercel `--prod` / sin dominio final / sin datos reales
