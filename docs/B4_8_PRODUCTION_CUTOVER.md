# B4.8 — Cutover controlado a producción

**Fecha UTC:** 2026-07-29  
**Veredicto:** **PRODUCCIÓN BLOQUEADA**

## 1. SHA y auditoría Git

| Campo | Valor |
|---|---|
| Rama | `release/nom035-staging-rc1` |
| Último SHA funcional certificado (CI + WebKit) | `0ff37fd` |
| Tip previo documental | `c3a253d` (solo `CHANGELOG.md` + `docs/B4_7_…`) |
| Cambios funcionales posteriores a `0ff37fd` antes de B4.8 | **ninguno** (solo docs) |
| Working tree al inicio | limpio vs remoto |

No se desplegó un SHA con cambios funcionales sin CI.

## 2. Dashboard mock / localStorage

| Señal buscada | Origen | Estado productivo |
|---|---|---|
| “MVP local” | `src/app/page.tsx`, metadata | **eliminado** del copy productivo |
| “Supabase local” | dashboard / trabajadores / config | **reemplazado** por “Supabase” / panel general |
| “Cargar datos demo” / “Limpiar datos locales” | solo histórico DEVLOG; no en UI admin actual | **ausente** |
| “Piloto NOM-035 Mayo 2026” | `src/data/nom035/mock-campaigns.ts` | solo legado local; admin **no** lo importa |
| 3 trabajadores | `mock-workers.ts` | no hardcodeado en dashboard; admin usa API Supabase |
| Banner “local” | `AdminLocalBanner` | **omitido** si `VERCEL_ENV=production` |
| Fuente admin | `adminApi.*` → Supabase service | sin fallback silencioso a mock |

`ACTIVE_REPOSITORY_MODE=local` permanece para el adaptador legado; las páginas admin migradas **no** lo usan.

## 3. Infraestructura

### Supabase

| Proyecto | Ref sanitizado | Región | Uso |
|---|---|---|---|
| ConCasa CRM | `fvtq…vwzy` | us-east-2 | **no tocado** |
| nom035-staging | `agbl…kubf` | us-east-1 | **no mutado** |
| nom035-production | — | — | **NO CREADO** |

**Bloqueo:** organización en plan `free` con límite de 2 proyectos activos (`ConCasa CRM` + `nom035-staging`). La API rechazó crear `nom035-production` (free y pro).

Secretos nuevos generados **fuera de Git** en `~/Desktop/nom035-production-secrets/` (password DB + peppers). No se imprimieron.

### Vercel

| Proyecto | Notas |
|---|---|
| `mom` | repo NOM-035; Preview staging; Production antigua — **no reutilizado como exclusivo** |
| `crmconcasa` / `charolais-store` / otros | **no tocados** |
| `nom035-production` | **creado** (vacío; sin deploy productivo aún) |

## 4. CSV 83 (validación local, sin import)

Ruta: `/Users/grecovillanuevaortiz/Downloads/trabajadores_nom035_83.csv` (fuera de Git).

| Métrica | Valor |
|---|---|
| UTF-8 BOM | sí |
| Encabezados | Número, Nombre Completo, Puesto, Departamento |
| Leídos | 83 |
| Válidos | 83 |
| Rechazados | 0 |
| Números únicos | 83 |
| Duplicados | 0 |
| Puestos truncados conservados | 4/4 presentes |

**Importación no ejecutada** (sin Supabase Production ni empresa real autorizada).

## 5. Bloqueadores restantes (requieren acción del usuario)

1. **Cupo Supabase:** subir la org a plan de pago **o** pausar/eliminar un proyecto free **ajeno a ConCasa y sin usar staging como Production**. Autorizado solo si el usuario elige explícitamente cómo liberar cupo.
2. **Datos de empresa reales** (razón social, RFC, domicilio, responsable, etc.) — no inventar; no importar a ACME mock.
3. **Correo real del administrador productivo** — no crear cuentas ficticias en Production.
4. Tras (1)–(3): migraciones versionadas, secrets Vercel Production, Auth Site URL, deploy SHA con CI+WebKit verdes, backup pre/post, import upsert idempotente, smoke.

## 6. Confirmaciones de no interferencia

- Staging intacto (solo lectura de listado).
- ConCasa intacto.
- Otros proyectos Vercel intactos.
- CSV y nombres reales fuera de Git.
- Sin secretos en Git.
- Cleanup **no** ejecutado sobre trabajadores reales (no hubo import).
- Sin campaña inventada; sin correos masivos.

## 7. Cambios de código en este bloque (pre-corte)

- Copy productivo sin “MVP local” / “local/mock”.
- Banner admin omitido en `VERCEL_ENV=production`.
- Pruebas estáticas de superficie productiva.
