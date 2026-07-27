# Plan de migración Staging (B4.7)

## Destino

| Campo | Valor |
|---|---|
| Nombre | `nom035-staging` |
| Región | `us-east-1` |
| Estado | `ACTIVE_HEALTHY` |
| Project ref | `agbl…kubf` (censurado) |
| Prohibidos | `ConCasa CRM`, cualquier otro ref |

## Wipe legado (autorizado)

- Inicio: `2026-07-27T20:06:39Z`
- Fin: `2026-07-27T20:06:43Z`
- Eliminado: `admins`, `categories`, `products`, `product_variants` (+ FK/sequence dependientes)
- Respaldo fuera de repo: `~/Desktop/nom035-staging-legacy-backup/`

## Migraciones aplicadas

Orden exacto:

1. `001_nom035_initial_schema.sql`
2. `002_public_evaluation_backend.sql`
3. `003_admin_core_backend.sql`
4. `004_secondary_modules_and_storage.sql`
5. `005_auth_rbac_mfa.sql`

- Dry-run: limpio (solo esas 5).
- Push inicio: `2026-07-27T20:07:32Z`
- Push fin: `2026-07-27T20:08:36Z`
- Historial remoto: 001–005 presentes.

## Nota TRUNCATE

`005` incluye `truncate public.role_permissions` para reseeding determinista de la matriz RBAC. No es TRUNCATE de datos de negocio.

## Validaciones post-aplicación

- 16 tablas public + FORCE RLS en las 16
- `role_permissions` = 73
- bucket `nom035-evidence` privado, 15 MB, PDF/JPEG/PNG
- 0 políticas storage para anon
- 0 columnas `token`/`password`/`totp_secret` en public

## Tipos

Diff local vs staging: solo metadata `__InternalSupabase.PostgrestVersion` + newline final. Sin diferencias estructurales de tablas/RPC. Código **no** adaptado silenciosamente.

## Abortar / siguiente

Detener antes de Vercel Preview / seed remoto / E2E staging hasta revisión humana.
