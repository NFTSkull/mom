# B4.29.1 — CI verde y seguridad post-B4.29

Sin cambios en datos NOM-035, scoring, thresholds, snapshots, workers, assignments ni campañas. Sin datos synthetic en Production.

## 1. pgTAP — `admin_list_results`

**Falla:** `006_admin_core_backend.test.sql:599` → `function public.admin_list_results(unknown, …, integer, integer) is not unique`.

**Causa:** `015_result_sort.sql` agregó `p_sort` con `CREATE OR REPLACE`. En Postgres, cambiar la lista de argumentos crea una **sobrecarga nueva**; la firma de 7 args (005/013) siguió viva. Toda llamada sin `p_sort` (incluida `admin_list_results()`) era ambigua.

**Evidencia previa en Production (`pg_proc`, transacción read-only):**

| oid | nargs | identidad | ACL |
|-----|-------|-----------|-----|
| 18930 | 7 | `…, p_page integer, p_page_size integer` | postgres, service_role, authenticated |
| 19702 | 8 | `…, p_page_size integer, p_sort text` | **PUBLIC**, **anon**, postgres, authenticated, service_role |

- Ninguna otra función SQL referencia `admin_list_results`.
- Único llamador de la app: `admin-core-service.listResults`, que siempre envía `p_sort`.
- `supabase_migrations.schema_migrations` registra hasta 014 (015 se aplicó fuera del CLI).

**Defecto adicional encontrado:** el `jsonb_agg(... order by t."sortKey", t.id)` externo de 015 reordenaba cada página en ascendente, invirtiendo `name_desc` y `recent` dentro de la página. Las pruebas B4.28.1 simulaban el orden en JS y no ejecutaban el SQL.

**Corrección (`016_admin_list_results_single_signature.sql`):**

- `DROP FUNCTION IF EXISTS` con la firma exacta de 7 args.
- Recrea la firma de 8 args con el mismo cuerpo; el agregado externo ordena por un ordinal (`row_number()` con el mismo `ORDER BY` de la página) que se elimina de la salida.
- `REVOKE` PUBLIC/anon; `GRANT EXECUTE` a authenticated, service_role.

**pgTAP nuevo (006):** firma única, identidad con `p_sort`, default `'name_asc'`, sin EXECUTE para anon/PUBLIC, orden real de las 4 variantes con dos resultados de prueba (local, transacción revertida), default, fallback de sort inválido y paginación.

## 2. npm audit

Antes (`npm audit --omit=dev`): critical 1, high 4, moderate 2. `npm audit` completo: critical 1, high 25, moderate 4.

| Paquete | Versión | Advisory | Severidad | Ruta | Fix mínimo | Acción |
|---------|---------|----------|-----------|------|------------|--------|
| next | 16.2.11 | GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4 (<16.3.3), GHSA-vcvr-r3jv-pc5j (<16.3.6) | critical | directa | 16.3.6 | → **16.3.8** (último parche 16.x) |
| sharp | 0.35.3 | GHSA-rgj7-g3m4-5g8c (<0.35.4), GHSA-wq5f-xc86-pv6w (<0.35.5) | high | `next → sharp` (opcional) | 0.35.5 | override → **0.35.5** (no es dependencia directa; charts usan pureimage) |
| brace-expansion | 5.0.9 | GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, GHSA-q2hr-2g5m-vwhr | high | `minimatch → brace-expansion` (prod: exceljs→archiver; dev: eslint) | 5.0.12 | override → **5.0.12** |
| source-map-js | 1.2.1 | GHSA-68fv-2mgg-jv7q | high | `postcss → source-map-js` | 1.2.2 | override → **1.2.2** |
| braces | 3.0.3 | GHSA-vfj7-8cjw-p6xm | high | dev: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` | **sin parche** | override `fast-glob` → `tinyglobby@0.2.17` (solo para el plugin; usa `globSync(…, {onlyDirectories})`, API compatible; ya estaba en el árbol) |
| vitest / @vitest/mocker | 4.1.5 | GHSA-82fw-gwwq-j7x9 | moderate | dev | 4.1.11 | → **^4.1.11** |
| uuid | 8.x | GHSA-w5hq-g745-h8pq (v3/v5/v6 con `buf`) | moderate | `exceljs → uuid` | solo bajando exceljs a 3.4.0 (major) | **sin acción**; exceljs solo usa `v4()` sin `buf` → no alcanzable |

Después: `npm audit --omit=dev` y `npm audit` → **critical 0, high 0**, moderate 2 (uuid/exceljs). El workflow usa `--audit-level=high` → pasa.

React 19.2.4 sin cambios. Lockfile: solo parches/minors (Next/SWC, sharp/libvips, vite 8.3.3, rolldown); salen `fast-glob`, `micromatch`, `braces` y `@nodelib/*`.

## 3. Regresión Next 16.2.11 → 16.3.8

`next build` (Turbopack) sin warnings; App Router, Proxy (middleware), route handlers dinámicos y páginas estáticas compilan. Vitest (XLSX, agregados, auth estática) en verde. E2E Chromium/Firefox/WebKit en CI con stack Supabase local.

## 3b. Gate «Types sin diff»

`npm run db:types` usaba `npx --yes supabase` (última versión). El CLI actual (2.120.0) emite TypeScript sin formato («Generated TypeScript is unformatted»), por lo que el diff fallaba aunque el esquema coincidiera. Se fija `supabase@2.116.0` (vigente en el último gate verde, 2026-09-03). Único cambio de esquema reflejado: `p_sort?: string` en `admin_list_results`.

## 4. Verificación

Local: lint, typecheck, Vitest, build, secret scan, PII scan. CI (runners aislados con Supabase local): npm audit, pgTAP completo, tipos sin diff, Playwright Chromium/Firefox, WebKit Guía III.
