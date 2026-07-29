# B4.8 — Cutover controlado a producción

**Fecha UTC:** 2026-07-29  
**Veredicto:** **PRODUCCIÓN BLOQUEADA**

## Resumen ejecutivo

Proyecto Supabase promovido (`nom035-staging` → `nom035-production`, ref `agbl…kubf`).  
Vercel Production READY en `https://nom035-production.vercel.app` con health/CSP OK.  
**No** se importaron los 83: falta empresa real y correo de administrador.  
CI WebKit de staging reseedó momentáneamente el mismo ref; se limpió y se desactivaron seeds automáticos.

## 1. Promoción

| Campo | Valor |
|---|---|
| Nombre | `nom035-production` |
| Ref | `agbl…kubf` |
| Región | `us-east-1` |
| Tercer proyecto | no creado |
| ConCasa | intacto |

## 2. SHA / CI

| SHA | Notas |
|---|---|
| `27e9d24` | prep B4.8 — RC + WebKit success |
| `7bf4ed7` | scripts productivos — WebKit success; RC cancelado por supersede |
| `8e8aab7` | `vercel.json` Next.js — CI en curso al corte; deploy READY verificado |
| tip con bloqueo WebKit | commit de mitigación anti-reseed |

## 3. Residuos

Inventario inicial limpiado. Tras reseed CI: segunda limpieza (workers/campañas/auth/storage).  
Estado final auditado: **0 workers, 0 auth, 0 company, 0 storage test**.

## 4. Rotaciones

DB password + peppers nuevos (off-repo). service_role/publishable no rotados (limitación API).

## 5. Backup pre-import

`~/Desktop/nom035-production-backups/2026-07-29T19-37-35-730Z-pre-import/` (manifest con SHA-256).

## 6. Vercel

| Campo | Valor |
|---|---|
| Proyecto | `nom035-production` |
| URL | `https://nom035-production.vercel.app` |
| live / ready | **200** |
| `/login` | **200** |
| `/admin` | **307** → login |
| API admin | **401** |
| CSP / XFO DENY / HSTS / nosniff | OK |

## 7. Auth Supabase

Site URL y redirects apuntan solo a `https://nom035-production.vercel.app` (sin localhost/ConCasa).

## 8. Bloqueadores para OPERATIVA

1. **Empresa real** — `company_settings` vacío. Obligatorio: `razon_social`. Recomendados: RFC, domicilio, actividad, total trabajadores, responsable (nombre/email/teléfono).
2. **Correo admin productivo** — 0 usuarios Auth. No inventar.
3. Confirmar CI principal verde del tip anti-reseed.
4. Luego: backup fresco → dry-run CSV → import upsert 83 → backup post → smoke autenticado.

## 9. CSV

83/83/0 duplicados validados. **Import no ejecutada.**

## 10. Confirmaciones

ConCasa y otros proyectos intactos; CSV/nombres/secretos fuera de Git; sin campaña inventada; sin cleanup de los 83 (no importados).
