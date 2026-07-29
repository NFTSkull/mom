# Changelog

## 2026-07-29 (B4.7 — push c6ec8a5+, Preview CSP, E2E staging 42)

- Push `c6ec8a5`; CI `30465305919` verde; Preview con CSP global observada.
- E2E staging 42/42 (Chromium desktop/móvil + Firefox); WebKit omitido en darwin (frozen).
- Rollback Preview A↔B con ready 200; cleanup sintéticos.
- `SUPABASE_DB_PASSWORD_ABSENT` → restore no ejecutado → **NO CERTIFICADO**.

## 2026-07-29 (B4.7 — CSP global + suite staging ampliada)

- `next.config.ts`: CSP + `X-Frame-Options: DENY` + `frame-ancestors 'none'` en `/:path*` y rutas sensibles; `unsafe-inline`/`unsafe-eval` residuales documentados (Next/hidratación/MFA).
- Scripts `staging:seed:fixtures` / `staging:cleanup:fixtures` (empresa, campaña, tokens, PDF, quejas, plan, política; solo `nom035-staging`).
- Suite `e2e-staging`: público, Auth/MFA/roles, módulos, seguridad, Chromium desktop/móvil, WebKit público, Firefox smoke.
- Regresión local con Supabase arriba: Vitest 189 (0 skip), pgTAP 517, Playwright 42.
- CI `a14d50b` run `30430479378` verde; veredicto sigue **NO CERTIFICADO** hasta E2E staging 100% + backup/restore + redeploy CSP.

## 2026-07-27 (B4.7 — Release Candidate / Staging prep)

- Rama `release/nom035-staging-rc1`, CI release, health `/api/health/live|ready`.
- Playwright staging config + scripts seed/cleanup sintéticos (fallan fuera de staging).
- Docs: CI_SECURITY_MODEL, STAGING_*, BACKUP/ROLLBACK, PRODUCTION_CHECKLIST_PRELIMINARY, B4_7.
- Enlace Cloud únicamente a proyecto nombre exacto `nom035-staging` (sin tocar otros).
- CI: `b4-3-concurrency` se omite en `quality` sin `.env.local`; corre en `database` tras `ci-write-local-env`.
- CI: `ci-write-local-env` ensambla nombres de env por partes (evita falso positivo del secret-scan).
- CI verde run `30429324801` @ `471592f`; Preview Vercel + smoke remoto; veredicto **NO CERTIFICADO** (falta E2E completo + backup restore).
- Sin Vercel Production, sin merge a main, sin usuarios/datos reales.

## 2026-07-27 (B4.6 — Auth, RBAC y MFA)

- Migración `005_auth_rbac_mfa.sql`: `app_permission`, `role_permissions`, perfil MFA, último admin, `require_admin_permission*`.
- RPCs admin ordinarias con autorización interna; EXECUTE a `authenticated`.
- Proxy Next 16 + `getClaims`; guards server-side; login/logout/MFA/password/users/audit.
- `NOM035_ADMIN_BACKEND_MODE=auth_rbac`; seed `@nom035.local` + cleanup.
- pgTAP `008_*`, Vitest B4.6, Playwright `e2e/auth-rbac.spec.ts`.
- Docs: AUTH_RBAC_MATRIX, AUTH_SECURITY_MODEL, MFA_OPERATIONS, USER_PROVISIONING_RUNBOOK, ACCESS_REVOCATION_RUNBOOK, B4_6_AUTH_RBAC_CERTIFICATION.
- Certificación local: Vitest 189, pgTAP 517, Playwright 42; audit 0.
- Sin remoto/link/push/deploy; sin usuarios reales; sin commit/push.

## 2026-07-27 (B4.5 — módulos secundarios + Storage privado)

- Migración `004_secondary_modules_and_storage.sql`: plan/evidencias/quejas/políticas + bucket `nom035-evidence` privado.
- RPCs `admin_*` / `public_submit_confidential_complaint` (service_role).
- APIs admin + pública; UI migrada sin localStorage; dashboard/reportes con agregados.
- Validación magic bytes, compensación Storage↔DB, signed downloads, rate limit/honeypot.
- pgTAP `007_*`, Vitest B4.5, Playwright `e2e/secondary-modules.spec.ts`.
- Docs: ACTION_PLAN_API, EVIDENCE_STORAGE_SECURITY, COMPLAINTS_PRIVACY_MODEL, POLICY_VERSIONING, B4_5_SECONDARY_MODULES_CERTIFICATION.
- Sin Auth, sin remoto, sin scoring/Guía III, sin commit/push.

## 2026-07-24 (B4.4 — panel administrativo central)

- Migración `003_admin_core_backend.sql`: columnas admin, una campaña active, RPCs `admin_*`.
- Guard local-only (`admin-access-guard`) + API `/api/admin/nom035/*` (Zod, server-only).
- UI migrada: dashboard, configuración, trabajadores (+CSV), campañas (tokens one-time), resultados, reportes.
- Módulos fuera de alcance siguen en localStorage (plan-acción, evidencias, quejas, política).
- pgTAP `006_*`, Vitest B4.4, Playwright `e2e/admin-core.spec.ts`.
- Docs: `ADMIN_CORE_API.md`, `ADMIN_CORE_LOCAL_SECURITY.md`, `B4_4_ADMIN_CORE_CERTIFICATION.md`.
- Sin Auth, sin remoto, sin scoring/Guía III, sin commit/push.

## 2026-05-05

- Se inicializo base `Next.js + TypeScript + Tailwind` para el portal interno NOM-035.
- Se creo estructura App Router para rutas admin y evaluacion publica por token.
- Se agregaron tipos de dominio, datos mock y capa `localStorage` para MVP local.
- Se incorporo motor de scoring inicial desacoplado de componentes React.
- Se agregaron pruebas unitarias base para reglas de guias y scoring inicial.
- Se implemento la Guia de Referencia I con preguntas oficiales, flujo condicional y resultado automatico oficial.
- Se actualizo la pantalla de evaluacion por token para aplicar reglas de salto por Seccion I.
- Se actualizaron resultados admin con conteo de alertas y estado por trabajador.
- Se agregaron pruebas unitarias de umbrales oficiales para `calculateGuiaIResult`.
- Se corrigio contraste y legibilidad visual en admin y evaluacion, eliminando estilos lavados por herencia global.
- Se fortalecio `/admin/campanas` como centro de distribucion de evaluaciones con resumen operativo, tabla por trabajador y acciones de copiado.
- Se agrego bienvenida con accion "Iniciar evaluacion" en `/evaluacion/[token]` para clarificar el inicio del cuestionario.
- Se agregaron datos oficiales de Guia II (reactivos, compuertas, grupos y umbrales) en capa de dominio local.
- Se implementaron `scoreGuiaIIAnswer`, `getRiskLevelFromThresholds` y `calculateGuiaIIResult` con calculo por dimension, dominio, categoria y resultado final.
- Se agregaron pruebas unitarias de scoring, compuertas condicionales y niveles de riesgo para Guia II.
- Se integro Guia II al flujo de trabajador por pasos en `/evaluacion/[token]` para empresas de 16 a 50 trabajadores.
- Se amplio `storage-local` para persistir respuestas/resultados de Guia I y Guia II, estado y fecha de completado.
- Se actualizo `/admin/resultados` para mostrar resumen de Guia II, puntaje, riesgo y dominios criticos por trabajador.
- Se evito hydration mismatch en `/admin/campanas` y `/admin/resultados` leyendo datos de `localStorage` solo tras montar en cliente (skeleton estable en SSR y primer paint).
- Se implemento dashboard ejecutivo en `/admin/resultados` con cards clave, distribucion de riesgo Guia II, analisis por departamento, dominios prioritarios y filtros operativos.
- Se agregaron helpers puros en `src/lib/nom035/results-analytics.ts` y pruebas unitarias de agregados.
- Se creo `/admin/reportes` como informe imprimible profesional NOM-035 con portada, alcance, resultados agregados, conclusiones y plan de intervencion.
- Se agrego `report-generator.ts` con pruebas unitarias para conclusiones, recomendaciones y plan de intervencion.
- Se creo `/admin/plan-accion` para registrar y dar seguimiento a acciones preventivas/correctivas de forma local.
- Se implemento CRUD local de `ActionPlanItem` y generacion automatica de acciones sugeridas desde resultados agregados.
- Se agrego `action-plan-generator.ts` con pruebas unitarias para sugerencias, vencimientos y estadisticas del plan.
- Se creo `/admin/evidencias` para registrar y organizar evidencias documentales NOM-035 en almacenamiento local/mock.
- Se agregaron tipos, CRUD local y analytics de evidencias (stats/checklist/etiquetas) con pruebas unitarias.
- Se creo el canal publico `/queja-confidencial` para registrar reportes confidenciales anonimos o identificados con folio autogenerado.
- Se creo `/admin/quejas` para administrar reportes con filtros, detalle reservado, cambio de estado, asignacion y notas de resolucion.
- Se agregaron `ConfidentialComplaint`, CRUD local de quejas y helper `complaint-analytics` (stats, etiquetas, folios) con pruebas unitarias.
- Se incorporo el acceso "Quejas" en navegacion admin y se mantuvo privacidad al no exponer datos de contacto en tablas.
- Se creo `/admin/politica` para generar, editar, versionar, publicar e imprimir la Politica de Prevencion NOM-035 en almacenamiento local/mock.
- Se agrego `PolicyDocument`, CRUD local de politicas y helper `policy-generator` para texto base institucional y etiquetas de estado.
- Se incorporo historial de versiones con acciones editar/duplicar/publicar/eliminar y vista imprimible con controles ocultos en impresion.
- Se agrego enlace "Politica" en navegacion admin y nota de integracion documental hacia el modulo Evidencias.
- Se mejoro `/admin/trabajadores` con formulario completo (alta/edicion/desactivacion/eliminacion) y carga CSV para trabajadores reales.
- Se ampliaron tipos de trabajador y `storage-local` con CRUD de trabajadores y asignaciones de campana (`getCampaignAssignments`, `saveCampaignAssignment`, `updateCampaignAssignment`).
- Se actualizo `/admin/campanas` para listar trabajadores activos, detectar estado "Sin link" y generar enlaces faltantes sin duplicar.
- Los enlaces individuales se construyen con `window.location.origin` y se mantiene copiado de link/mensaje para envio operativo.
- Se realizo auditoria final del MVP local con mejoras de navegacion admin (resaltado de ruta activa y etiquetas con acentos).
- Se transformo `/admin` en dashboard ejecutivo de demo con resumen transversal de modulos y accesos rapidos.
- Se agregaron herramientas demo locales: cargar datos demo, limpiar solo llaves NOM-035 y refrescar estado.
- Se creo `src/lib/nom035/demo-data.ts` y pruebas unitarias para estado de datos locales.
- Se corrigio riesgo de hydration mismatch en `/admin/configuracion` cargando datos tras `mounted` con skeleton estable.

## 2026-06-22

- Se corrigio ortografia y acentos del cuestionario oficial en `guia-i.ts` y `guia-ii.ts` segun NOM-035-STPS-2018 (DOF).
- Se ajusto la pregunta 15 de Guia I al texto oficial: "¿Se ha sobresaltado fácilmente por cualquier cosa?".
- Se muestra el encabezado de cada seccion de Guia I una sola vez (II, III y IV ya no se repiten por pregunta).
- Se actualizaron textos visibles de `/evaluacion/[token]` con ortografia correcta y opciones "Sí"/"No".

## 2026-07-24

- **B4.3 CERTIFICADO** — evaluación pública centralizada por token (Supabase local).
- Migración `002_public_evaluation_backend.sql`: drafts, sessions, rate_limits, submission_id, trigger monótono y RPCs atómicas.
- Módulos server-only: token HMAC, sesión HttpOnly, rate-limit, scoring server-side.
- Route handlers `/api/public/evaluations/{session,start,draft,submit}`.
- UI: `/evaluacion/[token]` (intercambio) + `/evaluacion/contestar` + `/evaluacion/gracias`.
- Cabeceras de privacidad + CSP en `next.config.ts`.
- Script `db:seed:evaluation` (solo localhost).
- pgTAP 247 assertions; Vitest 118; Playwright Chromium 10/10.
- Overrides adicionales `minimatch@10.2.5` / `brace-expansion@5.0.8` (dev, audit 0).
- Docs: `PUBLIC_EVALUATION_API.md`, `PUBLIC_EVALUATION_THREAT_MODEL.md`, `B4_3_PUBLIC_EVALUATION_CERTIFICATION.md`.

## 2026-07-24 (prev)

- Auditoria formal de produccion documentada en `docs/PRODUCTION_READINESS_AUDIT.md` (veredicto NO-GO).
- Bloque B4.0: fundamentos seguros Supabase sin migrar pantallas fuera de localStorage.
- Se agrego linea base `docs/NPM_AUDIT_BASELINE.md` (sin `audit fix --force`).
- Se instalaron `@supabase/supabase-js@2.109.0`, `@supabase/ssr@0.12.0` y `server-only` (compatibles con Node 20).
- Se creo `.env.example`, `src/lib/env.ts` y clientes `src/lib/supabase/{client,server,admin}.ts`.
- Se agrego migracion revisable `supabase/migrations/001_nom035_initial_schema.sql` con RLS force, revoke anon/authenticated y token_hash.
- Se documentaron `docs/DATABASE_SECURITY_MODEL.md` y el adaptador `Nom035Repository` fijo en modo `local`.
- Se agregaron pruebas estaticas de seguridad/esquema en `b4-security-foundation.test.ts`.
- `.gitignore` ahora excluye secretos env y permite versionar `.env.example`.

## 2026-07-24 (B4.2.1 — CERTIFICADO)

- Se demostró que el high atribuido a `next@16.2.11` era una metavulnerabilidad
  inducida por `postcss@8.4.31` y `sharp@0.34.5`, no un advisory residual propio.
- Se documentaron GHSA/CVE/rangos/parches exactos en
  `docs/B4_2_1_DEPENDENCY_REMEDIATION.md`.
- Overrides estables: `postcss@8.5.23` y `sharp@0.35.3`; árbol final único,
  sharp nativo con libvips 8.18.3 e instalación limpia reproducible.
- Audits completo y producción: **0 vulnerabilidades**.
- Pruebas de no-regresión de lockfile y resize sharp en memoria.
- Regresión: lint/typecheck/build PASS, **99 pruebas Vitest**, **170 pgTAP**,
  smoke HTTP 11/11.
- Scripts `db:*` corregidos para invocar Supabase CLI mediante `npx --yes`.
- Veredicto de reevaluación: **CERTIFICADO**.

## 2026-07-24 (B4.2 — NO CERTIFICADO por deps de producción)

- Certificación local de base de datos y seguridad de dependencias (sin remoto/link/push).
- `next`/`eslint-config-next` `16.2.4 → 16.2.11` (última estable); `npm audit fix` (sin `--force`) limpió highs/low de desarrollo.
- Audit final: 0 critical, **3 high de producción** (`next`/`postcss`/`sharp`) **sin fix estable** (rango vulnerable llega a `16.3.0-preview.7`). Documentado en `docs/DEPENDENCY_SECURITY_CERTIFICATION.md`.
- Supabase local real (Docker): 10 contenedores healthy; puertos desplazados a 55321-55324 para coexistir con otra instancia; migración aplicada desde cero **dos veces** (reproducible).
- `config.toml` ampliado (puertos, analytics/pooler off). Migración: se añadieron CHECK de coherencia (`completed`/`revoked`/`published`/queja anónima).
- pgTAP en PostgreSQL real: `supabase/tests/database/00{1..4}` → **170 assertions, PASS** (estructura, RLS/permisos, integridad, transiciones).
- Tipos generados `src/types/database.generated.ts` (12 tablas) + alias `src/types/database.ts`.
- Scripts `db:start/stop/status/reset/test/types`; guía `docs/LOCAL_DATABASE_WORKFLOW.md`.
- Pruebas estáticas B4.2 (`b4-2-database-hardening.test.ts`); regresión: lint/typecheck OK, **95 tests**, build OK; smoke HTTP 12/12 rutas → 200.
- Veredicto B4.2 **NO CERTIFICADO** (`docs/B4_2_DATABASE_CERTIFICATION.md`): único bloqueo = highs de producción sin versión estable.

## 2026-07-24 (B4.1 — CERTIFICADO)

- Fuente canónica verificada: `docs/source/NOM-035-STPS-2018-oficial.txt` (220837 bytes, SHA-256 `8d5c2c63…7a76`).
- Manifiesto único Guía II (`guia-ii-manifest.ts`) como fuente de reactivos, scoring, cat/dom/dim, gates y umbrales.
- Motor de scoring con validación estricta (falla duro ante respuestas faltantes/inválidas) y metadatos `scoringVersion` / `questionnaireVersion`.
- Política de fronteras tipográficas documentada en `docs/SCORING_BOUNDARY_POLICY.md`.
- UI de revisión final del trabajador (sin puntajes), confirmación y protección anti doble envío.
- 10 fixtures golden + suite de certificación; aviso de “versión no registrada” en admin/resultados.
- Veredicto **CERTIFICADO** en `docs/SCORING_CERTIFICATION.md` tras lint/typecheck/test/build en verde.
- Restricciones respetadas: sin Supabase remoto, SQL, login, Guía III, deploy, commit ni push.
