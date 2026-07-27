# B4.7 — Certificación Cloud Staging

## Veredicto

**NO CERTIFICADO**

## Completado

- Regresión local: audit 0, Vitest 189, pgTAP 517, Playwright 42.
- Rama `release/nom035-staging-rc1` con commits RC + tag local `nom035-local-certified-rc1`.
- CI workflow preparado (push remoto bloqueado: PAT sin scope `workflow`).
- Health `/api/health/live|ready`, Playwright staging, scripts seed/cleanup staging, docs.
- Identificación: único proyecto nombre exacto `nom035-staging` (ref `agbl…kubf`, us-east-1, ACTIVE_HEALTHY).
- `supabase link` exclusivo a ese ref (no ConCasa CRM).

## Bloqueo duro (db push NO ejecutado)

El proyecto enlazado **no está vacío**. Tablas `public` existentes (legado):

- `admins` (1 fila)
- `categories` (5 filas)
- `products` (23 filas)
- `product_variants` (0 filas)

Historial de migraciones NOM-035 remotas: vacío (001–005 solo locales).  
Criterio del bloque: *si hay tablas o datos inesperados → detenerse*.

## Push Git

Detenido por GitHub: el token no tiene scope `workflow` para subir `.github/workflows/release-candidate.yml`.

## Confirmaciones

- ConCasa CRM: **intacto / no enlazado**
- Nombre `charolais-db`: ya no aparece en la lista; el ref renombrado a `nom035-staging` conserva esquema legado → **no se aplicaron migraciones**
- Sin Production / sin merge a main / sin usuarios reales / sin `db push`
