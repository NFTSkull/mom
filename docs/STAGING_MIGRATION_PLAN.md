# Plan de migración Staging (B4.7)

## Destino

| Campo | Valor |
|---|---|
| Nombre | `nom035-staging` |
| Región | `us-east-1` |
| Estado al plan | `ACTIVE_HEALTHY` |
| Project ref | `agbl…kubf` (censurado) |
| Prohibidos | `ConCasa CRM`, cualquier otro ref |

**Nota de procedencia:** el ref coincidió históricamente con un proyecto listado como `charolais-db` y fue renombrado a `nom035-staging`. Antes de aplicar migraciones se exige verificación de vacío (sin tablas NOM-035 / sin datos).

## Migraciones (orden)

1. `001_nom035_initial_schema.sql`
2. `002_public_evaluation_backend.sql`
3. `003_admin_core_backend.sql`
4. `004_secondary_modules_and_storage.sql`
5. `005_auth_rbac_mfa.sql`

Sin gaps. Sin modificar migraciones certificadas.

## Efectos

- Esquema NOM-035 + RLS FORCE.
- RPCs públicas (evaluación/queja) y admin con `require_admin_permission`.
- Storage bucket privado `nom035-evidence` (15 MB, PDF/JPEG/PNG).
- Matriz `role_permissions` + MFA flags.

## Validaciones previas

1. Nombre exacto `nom035-staging`.
2. Un solo match.
3. Proyecto activo.
4. Sin migraciones NOM-035 remotas.
5. Sin tablas de dominio inesperadas.
6. `npx supabase db push --dry-run` limpio.
7. Escaneo: sin DROP/TRUNCATE/anon público/bucket público/token claro.

## Rollback por migración

Preferir **forward-fix** (nueva migración). No down improvisado.

Si corrupción: restaurar desde backup lógico (ver `BACKUP_RESTORE_RUNBOOK.md`) tras abortar tráfico Preview.

## Abortar si

- dry-run muestra migraciones inesperadas;
- aparecen datos reales;
- el ref enlazado deja de ser staging;
- falla cualquier prueba local previa.

## Responsable / hora

- Responsable: operador del release candidate.
- Hora de aplicación: se registra en la entrega B4.7 al ejecutar.
