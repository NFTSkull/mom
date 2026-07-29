# B4.8 — Cutover controlado a producción

**Fecha UTC:** 2026-07-29  
**Veredicto actual:** **PRODUCCIÓN BLOQUEADA** (deploy READY + health OK; pendiente empresa real + admin real + import 83 + CI del SHA con `vercel.json`)

## 1. Promoción del proyecto existente

| Campo | Valor |
|---|---|
| Nombre actual | `nom035-production` |
| Nombre anterior | `nom035-staging` |
| Ref sanitizado | `agbl…kubf` |
| Región | `us-east-1` |
| Estado | `ACTIVE_HEALTHY` |
| ConCasa | intacto (`fvtq…vwzy`) |
| Tercer proyecto | **no creado** |

El Project ID / URL / migraciones / Auth / Storage permanecen; solo cambió el nombre lógico.

## 2. SHA y CI

| Campo | Valor |
|---|---|
| Rama | `release/nom035-staging-rc1` |
| Prep B4.8 previa | `27e9d24` — RC Quality + WebKit **success** |
| Jobs RC | quality / security / database / e2e **success** |
| WebKit | `webkit-staging` **success** |

Cualquier SHA posterior con cambios funcionales requiere CI + WebKit verdes antes de Production.

## 3. Residuos staging

Inventario inicial (filtros `STAGING_TEST%` / sintéticos):

| Recurso | Cantidad |
|---|---|
| workers | 45 |
| campaigns | 26 |
| assignments | 30 |
| results | 12 |
| company sintética | 1 |
| auth `@nom035.staging.local` | 1 (+ perfil) |
| storage test | 0 |

Limpieza explícita (`CONFIRM_PRODUCTION_CLEANUP=YES`): eliminados. Re-auditoría: **cero residuos**, **0 auth users**, **0 workers**, **sin empresa**.

## 4. Rotaciones

Off-repo: `~/Desktop/nom035-production-secrets/rotation-registry.json`

| Secreto | Estado |
|---|---|
| `SUPABASE_DB_PASSWORD` | rotada |
| `NOM035_TOKEN_PEPPER` | nueva (Production) |
| `NOM035_SESSION_PEPPER` | nueva (Production) |
| `NOM035_RATE_LIMIT_PEPPER` | nueva (Production) |
| `SUPABASE_SECRET_KEY` | **no rotada** (limitación API; ligada al proyecto) |
| publishable key | **no rotada** (ligada al proyecto) |

No se reutilizaron valores STAGING_* como peppers productivos.

## 5. Backup pre-importación

Ruta: `~/Desktop/nom035-production-backups/2026-07-29T19-37-35-730Z-pre-import/`

| Archivo | Bytes | SHA-256 |
|---|---|---|
| 00-roles.sql | 297 | `25873cec…89776ecd` |
| 01-schema-public.sql | 241832 | `c1caca13…7236f15d` |
| 02-data-public.sql | 52557 | `ec0332c0…7d43ef3283c` |

Ref del dump: `agbl…kubf`. Sin password en documentación.

## 6. Vercel

| Campo | Valor |
|---|---|
| Proyecto | `nom035-production` (team `viozs-projects`) |
| Variables Production | configuradas (env.ts) |
| Primer deploy | **falló** typecheck por scripts TS incluidos en `tsc` |
| Mitigación | `tsconfig.json` excluye `scripts` / `e2e-staging` |

## 7. Bloqueadores restantes

1. **Empresa real:** no existe fila en `company_settings` (obligatorio solo `razon_social`; opcionales RFC/domicilio/responsable/total).  
   Proporcionar al menos: razón social. Recomendados: RFC, domicilio, actividad, total trabajadores, responsable (nombre/email/teléfono).
2. **Administrador productivo:** 0 perfiles / 0 Auth. Falta **correo real** (no inventar).
3. **Deploy Production READY** del SHA con scripts + tsconfig + copy “Sin campaña activa”.
4. Auth Site URL / redirects al dominio Production definitivo.
5. Import 83 solo tras: deploy READY, health 200, empresa, admin, dry-run.

## 8. CSV

Validación previa intacta: 83 / 83 / 0 duplicados. **Sin import** (gates incompletos).

## 9. Confirmaciones

- ConCasa intacto; otros proyectos intactos.
- CSV / nombres / secretos / dumps fuera de Git.
- Sin cleanup de trabajadores reales (aún no importados).
- Sin campaña inventada.
